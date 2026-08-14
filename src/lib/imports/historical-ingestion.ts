import type { SupabaseClient } from "@supabase/supabase-js";

import { previewHistoricalCsv } from "@/lib/domain/historical-import";

type HistoricalRow = ReturnType<typeof previewHistoricalCsv>[number];

const stageKeyByName: Record<string, string> = {
  Inquiry: "inquiry",
  Contacted: "contacted",
  Qualified: "qualified",
  "Proposal Sent": "proposal_sent",
  "Follow-up": "follow_up",
  "Proposal Signed": "proposal_signed",
  "Retainer Paid": "retainer_paid",
  Planning: "planning",
  Completed: "completed",
  Lost: "lost",
  Archived: "archived",
};

type IngestionInput = {
  organizationId: string;
  userId: string;
  spreadsheetId: string;
  tab: string;
  rows: HistoricalRow[];
};

export type IngestionResult = {
  processed: number;
  created: number;
  updated: number;
  unchanged: number;
  mappingIssues: number;
};

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) => item !== null && item !== undefined && item !== "",
    ),
  );
}

export async function ingestHistoricalRows(
  client: SupabaseClient,
  input: IngestionInput,
): Promise<IngestionResult> {
  const [
    { data: stages, error: stageError },
    { data: services, error: serviceError },
    { data: mappingRules, error: mappingRuleError },
  ] = await Promise.all([
    client
      .from("pipeline_stages")
      .select("id,key,name")
      .eq("organization_id", input.organizationId),
    client
      .from("services")
      .select("id,name")
      .eq("organization_id", input.organizationId),
    client
      .from("mapping_rules")
      .select("field_name,source_value,canonical_value,status")
      .eq("organization_id", input.organizationId)
      .eq("source_type", "google_sheet"),
  ]);
  if (stageError || serviceError || mappingRuleError)
    throw new Error("Canonical mappings could not be loaded");

  const stageIds = new Map(
    (stages ?? []).map((stage) => [stage.key, stage.id]),
  );
  const serviceIds = new Map(
    (services ?? []).map((service) => [service.name, service.id]),
  );
  const ruleMap = new Map(
    (mappingRules ?? []).map((rule) => [
      `${rule.field_name}:${rule.source_value}`,
      rule,
    ]),
  );
  const result: IngestionResult = {
    processed: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    mappingIssues: 0,
  };

  for (const row of input.rows) {
    result.processed += 1;
    const serviceIssue = row.mappingIssues.find(
      (issue) => issue.field === "service",
    );
    const statusIssue = row.mappingIssues.find(
      (issue) => issue.field === "status",
    );
    const serviceRule = serviceIssue
      ? ruleMap.get(`service:${serviceIssue.sourceValue}`)
      : null;
    const statusRule = statusIssue
      ? ruleMap.get(`status:${statusIssue.sourceValue}`)
      : null;
    const effectiveService =
      row.normalizedValues.service ??
      (serviceRule?.status === "mapped" ? serviceRule.canonical_value : null);
    const effectiveStage =
      row.normalizedValues.stage ??
      (statusRule?.status === "mapped" ? statusRule.canonical_value : null);
    const mappingDecisions = compact({
      service: serviceRule
        ? {
            sourceValue: serviceIssue?.sourceValue,
            canonicalValue: serviceRule.canonical_value,
            status: serviceRule.status,
          }
        : null,
      status: statusRule
        ? {
            sourceValue: statusIssue?.sourceValue,
            canonicalValue: statusRule.canonical_value,
            status: statusRule.status,
          }
        : null,
    });
    const { data: insertedSource, error: sourceError } = await client
      .from("source_records")
      .upsert(
        {
          organization_id: input.organizationId,
          source_type: "google_sheet",
          source_spreadsheet_id: input.spreadsheetId,
          source_tab: input.tab,
          source_row_number: row.rowNumber,
          raw_values: row.rawValues,
          normalized_values: row.normalizedValues,
          mapping_decisions: mappingDecisions,
          validation_errors: [],
          import_fingerprint: row.fingerprint,
        },
        {
          onConflict: "organization_id,source_type,import_fingerprint",
          ignoreDuplicates: true,
        },
      )
      .select("id")
      .maybeSingle();
    if (sourceError)
      throw new Error(`Row ${row.rowNumber} could not be retained`);

    const sourceRecord =
      insertedSource ??
      (
        await client
          .from("source_records")
          .select("id")
          .eq("organization_id", input.organizationId)
          .eq("source_type", "google_sheet")
          .eq("import_fingerprint", row.fingerprint)
          .single()
      ).data;
    if (!sourceRecord)
      throw new Error(`Row ${row.rowNumber} source record is unavailable`);

    const { error: sourceRefreshError } = await client
      .from("source_records")
      .update({
        normalized_values: row.normalizedValues,
        mapping_decisions: mappingDecisions,
        validation_errors: [],
      })
      .eq("organization_id", input.organizationId)
      .eq("id", sourceRecord.id);
    if (sourceRefreshError)
      throw new Error(`Row ${row.rowNumber} normalization could not be refreshed`);

    const normalized = row.normalizedValues;
    const { data: existingProject, error: existingError } = await client
      .from("projects")
      .select("id,primary_contact_id")
      .eq("organization_id", input.organizationId)
      .eq("source_spreadsheet_id", input.spreadsheetId)
      .eq("source_tab", input.tab)
      .eq("source_row_number", row.rowNumber)
      .maybeSingle();
    if (existingError)
      throw new Error(`Row ${row.rowNumber} could not be matched to a project`);

    let contactId = existingProject?.primary_contact_id ?? null;
    const contactValues = compact({
      first_name: normalized.firstName,
      last_name: normalized.lastName,
      email_normalized: normalized.email,
      phone_e164: normalized.phone,
      raw_provider_fields: {
        source: "google_sheet",
        latest_source_record_id: sourceRecord.id,
      },
    });
    if (contactId) {
      const { error } = await client
        .from("contacts")
        .update(contactValues)
        .eq("organization_id", input.organizationId)
        .eq("id", contactId);
      if (error)
        throw new Error(`Row ${row.rowNumber} contact could not be updated`);
    } else if (
      normalized.firstName ||
      normalized.lastName ||
      normalized.email ||
      normalized.phone
    ) {
      const { data: contact, error } = await client
        .from("contacts")
        .insert({ organization_id: input.organizationId, ...contactValues })
        .select("id")
        .single();
      if (error)
        throw new Error(`Row ${row.rowNumber} contact could not be created`);
      contactId = contact.id;
    }

    const stageKey = effectiveStage ? stageKeyByName[effectiveStage] : null;
    const projectValues = compact({
      primary_contact_id: contactId,
      pipeline_stage_id: stageKey ? stageIds.get(stageKey) : null,
      name: normalized.leadName || `Imported lead · row ${row.rowNumber}`,
      event_type: normalized.eventType,
      event_at: normalized.eventDate,
      venue_name: normalized.venue,
      city: normalized.location,
      lead_source: normalized.leadSource,
      estimated_value_cents: normalized.estimatedValueCents,
      booked_value_cents: normalized.bookedValueCents,
      collected_cents: normalized.collectedCents,
      next_follow_up_at: normalized.nextFollowUpAt,
      source_origin: "google_sheet",
      source_spreadsheet_id: input.spreadsheetId,
      source_tab: input.tab,
      source_row_number: row.rowNumber,
      raw_provider_fields: {
        source: "google_sheet",
        latest_source_record_id: sourceRecord.id,
        notes_present: Boolean(normalized.notes),
        phone_follow_up: normalized.phoneFollowUp,
        text_follow_up: normalized.textFollowUp,
      },
    });

    let projectId: string;
    if (existingProject) {
      const { error } = await client
        .from("projects")
        .update(projectValues)
        .eq("organization_id", input.organizationId)
        .eq("id", existingProject.id);
      if (error)
        throw new Error(`Row ${row.rowNumber} project could not be updated`);
      projectId = existingProject.id;
      if (insertedSource) result.updated += 1;
      else result.unchanged += 1;
    } else {
      const { data: project, error } = await client
        .from("projects")
        .insert({
          organization_id: input.organizationId,
          ...projectValues,
          created_at: normalized.leadDate ?? undefined,
        })
        .select("id")
        .single();
      if (error)
        throw new Error(`Row ${row.rowNumber} project could not be created`);
      projectId = project.id;
      result.created += 1;
    }

    if (effectiveService) {
      const serviceId = serviceIds.get(effectiveService);
      if (serviceId) {
        const originalValue = serviceIssue?.sourceValue ?? effectiveService;
        const { error } = await client
          .from("project_services")
          .upsert(
            {
              organization_id: input.organizationId,
              project_id: projectId,
              service_id: serviceId,
              source_origin: "google_sheet",
              original_value: String(originalValue),
            },
            { onConflict: "project_id,service_id" },
          );
        if (error)
          throw new Error(`Row ${row.rowNumber} service could not be linked`);
      }
    }

    for (const issue of row.mappingIssues.filter(
      (issue) => !ruleMap.has(`${issue.field}:${issue.sourceValue}`),
    )) {
      const { error } = await client
        .from("mapping_queue")
        .upsert(
          {
            organization_id: input.organizationId,
            source_record_id: sourceRecord.id,
            field_name: issue.field,
            source_value: issue.sourceValue,
            affected_count: 1,
          },
          { onConflict: "source_record_id,field_name", ignoreDuplicates: true },
        );
      if (error)
        throw new Error(
          `Row ${row.rowNumber} mapping issue could not be queued`,
        );
      result.mappingIssues += 1;
    }

    if (insertedSource) {
      const occurredAt = normalized.leadDate ?? new Date().toISOString();
      const { error } = await client.from("activity_events").upsert(
        {
          organization_id: input.organizationId,
          project_id: projectId,
          event_type: existingProject
            ? "source_row_updated"
            : "inquiry_received",
          title: existingProject
            ? "Google Sheet row imported again"
            : "Historical inquiry imported",
          detail:
            normalized.notes || `Source row ${row.rowNumber} from ${input.tab}`,
          source_origin: "google_sheet",
          provider_event_id: `sheet:${input.spreadsheetId}:${input.tab}:${row.rowNumber}:${row.fingerprint}`,
          occurred_at: occurredAt,
          metadata: {
            source_record_id: sourceRecord.id,
            source_row_number: row.rowNumber,
          },
        },
        {
          onConflict: "organization_id,source_origin,provider_event_id",
          ignoreDuplicates: true,
        },
      );
      if (error)
        throw new Error(`Row ${row.rowNumber} activity could not be recorded`);
    }
  }

  const { error: auditError } = await client.from("audit_log").insert({
    organization_id: input.organizationId,
    actor_user_id: input.userId,
    action: "historical_import.completed",
    entity_type: "source_records",
    new_value: result,
    reason: `Manual import from ${input.spreadsheetId} · ${input.tab}`,
  });
  if (auditError)
    throw new Error(
      "Import completed, but its audit event could not be recorded",
    );
  return result;
}
