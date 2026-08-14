import type { SupabaseClient } from "@supabase/supabase-js";

import type { HoneyBookCsvRow } from "@/lib/domain/honeybook-csv";

export type HoneyBookCsvIngestionResult = {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  mappingIssues: number;
};

type Input = {
  organizationId: string;
  userId: string;
  fileName: string;
  rows: HoneyBookCsvRow[];
};

function compact(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) => item !== null && item !== undefined && item !== "",
    ),
  );
}

async function queueIssue(
  client: SupabaseClient,
  organizationId: string,
  sourceRecordId: string,
  fieldName: string,
  sourceValue: string,
  suggestedValue?: string,
) {
  const { error } = await client.from("mapping_queue").upsert(
    {
      organization_id: organizationId,
      source_record_id: sourceRecordId,
      field_name: fieldName,
      source_value: sourceValue,
      suggested_value: suggestedValue ?? null,
    },
    { onConflict: "source_record_id,field_name" },
  );
  if (error)
    throw new Error("A HoneyBook CSV mapping issue could not be queued");
}

async function exactContactCandidates(
  client: SupabaseClient,
  organizationId: string,
  email: string | null,
  phone: string | null,
) {
  const ids = new Set<string>();
  if (email) {
    const { data, error } = await client
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email_normalized", email);
    if (error) throw new Error("HoneyBook contact matching failed");
    for (const row of data ?? []) ids.add(String(row.id));
  }
  if (phone) {
    const { data, error } = await client
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("phone_e164", phone);
    if (error) throw new Error("HoneyBook contact matching failed");
    for (const row of data ?? []) ids.add(String(row.id));
  }
  return [...ids];
}

export async function ingestHoneyBookCsv(
  client: SupabaseClient,
  input: Input,
): Promise<HoneyBookCsvIngestionResult> {
  const [
    { data: stages, error: stageError },
    { data: services, error: serviceError },
  ] = await Promise.all([
    client
      .from("pipeline_stages")
      .select("id,key")
      .eq("organization_id", input.organizationId),
    client
      .from("services")
      .select("id,name")
      .eq("organization_id", input.organizationId),
  ]);
  if (stageError || serviceError)
    throw new Error("HoneyBook mappings could not be loaded");
  const stageIds = new Map(
    (stages ?? []).map((stage) => [stage.key, stage.id]),
  );
  const serviceIds = new Map(
    (services ?? []).map((service) => [service.name, service.id]),
  );
  const result: HoneyBookCsvIngestionResult = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    mappingIssues: 0,
  };

  for (const row of input.rows) {
    result.processed += 1;
    const values = row.normalizedValues;
    const { data: source, error: sourceError } = await client
      .from("source_records")
      .upsert(
        {
          organization_id: input.organizationId,
          source_type: "honeybook_csv",
          provider_record_id: values.projectId,
          source_tab: input.fileName,
          source_row_number: row.rowNumber,
          raw_values: row.rawValues,
          normalized_values: values,
          validation_errors: row.validationErrors,
          import_fingerprint: row.fingerprint,
        },
        { onConflict: "organization_id,source_type,import_fingerprint" },
      )
      .select("id")
      .single();
    if (sourceError || !source)
      throw new Error(`HoneyBook row ${row.rowNumber} could not be retained`);

    if (!values.projectId) {
      await queueIssue(
        client,
        input.organizationId,
        source.id,
        "honeybook_project_id",
        "[missing]",
        "Export the Project ID or Project URL column from HoneyBook",
      );
      result.mappingIssues += 1;
      result.skipped += 1;
      continue;
    }
    if (values.stageName && !values.stageKey) {
      await queueIssue(
        client,
        input.organizationId,
        source.id,
        "pipeline_stage",
        values.stageName,
      );
      result.mappingIssues += 1;
    }
    if (values.serviceSource && !values.services.length) {
      await queueIssue(
        client,
        input.organizationId,
        source.id,
        "service",
        values.serviceSource,
      );
      result.mappingIssues += 1;
    }

    let contactId: string | null = null;
    if (values.clientId) {
      const { data: contact, error } = await client
        .from("contacts")
        .upsert(
          {
            organization_id: input.organizationId,
            honeybook_client_id: values.clientId,
            ...compact({
              first_name: values.firstName,
              last_name: values.lastName,
              email_normalized: values.email,
              phone_e164: values.phone,
              raw_provider_fields: { source: "honeybook_csv" },
            }),
          },
          { onConflict: "organization_id,honeybook_client_id" },
        )
        .select("id")
        .single();
      if (error || !contact)
        throw new Error(
          `HoneyBook row ${row.rowNumber} contact could not be stored`,
        );
      contactId = contact.id;
    } else {
      const candidates = await exactContactCandidates(
        client,
        input.organizationId,
        values.email,
        values.phone,
      );
      if (candidates.length === 1) contactId = candidates[0];
      else if (candidates.length > 1) {
        await queueIssue(
          client,
          input.organizationId,
          source.id,
          "contact_match",
          [values.email, values.phone].filter(Boolean).join(" / "),
          "Choose the correct exact-match contact",
        );
        result.mappingIssues += 1;
      } else if (
        values.firstName ||
        values.lastName ||
        values.email ||
        values.phone
      ) {
        const { data: contact, error } = await client
          .from("contacts")
          .insert({
            organization_id: input.organizationId,
            first_name: values.firstName,
            last_name: values.lastName,
            email_normalized: values.email,
            phone_e164: values.phone,
            raw_provider_fields: { source: "honeybook_csv" },
          })
          .select("id")
          .single();
        if (error || !contact)
          throw new Error(
            `HoneyBook row ${row.rowNumber} contact could not be created`,
          );
        contactId = contact.id;
      }
    }

    const { data: existing, error: existingError } = await client
      .from("projects")
      .select("id,raw_provider_fields")
      .eq("organization_id", input.organizationId)
      .eq("honeybook_project_id", values.projectId)
      .maybeSingle();
    if (existingError)
      throw new Error(`HoneyBook row ${row.rowNumber} could not be matched`);
    const projectValues = compact({
      primary_contact_id: contactId,
      pipeline_stage_id: values.stageKey ? stageIds.get(values.stageKey) : null,
      honeybook_url: values.projectUrl,
      name: values.projectName,
      event_type: values.eventType,
      event_at: values.eventDate,
      venue_name: values.venue,
      city: values.city,
      region: values.region,
      lead_source: values.leadSource,
      estimated_value_cents: values.estimatedValueCents,
      proposal_value_cents: values.proposalValueCents,
      booked_value_cents: values.bookedValueCents,
      collected_cents: values.collectedCents,
      last_communication_at: values.recentActivityAt,
      last_communication_channel: values.recentActivityType,
      source_origin: "honeybook",
      raw_provider_fields: {
        ...((existing?.raw_provider_fields as Record<string, unknown> | null) ??
          {}),
        source: "honeybook_csv",
        latest_source_record_id: source.id,
        honeybook_stage_name: values.stageName,
        honeybook_stage_order: values.stageOrder,
      },
    });
    let projectId: string;
    if (existing) {
      const { error } = await client
        .from("projects")
        .update(projectValues)
        .eq("organization_id", input.organizationId)
        .eq("id", existing.id);
      if (error)
        throw new Error(
          `HoneyBook row ${row.rowNumber} project could not be updated`,
        );
      projectId = existing.id;
      result.updated += 1;
    } else {
      const { data: project, error } = await client
        .from("projects")
        .insert({
          organization_id: input.organizationId,
          honeybook_project_id: values.projectId,
          ...projectValues,
        })
        .select("id")
        .single();
      if (error || !project)
        throw new Error(
          `HoneyBook row ${row.rowNumber} project could not be created`,
        );
      projectId = project.id;
      result.created += 1;
    }

    for (const service of values.services) {
      const serviceId = serviceIds.get(service);
      if (!serviceId) continue;
      const { error } = await client.from("project_services").upsert(
        {
          organization_id: input.organizationId,
          project_id: projectId,
          service_id: serviceId,
          source_origin: "honeybook",
          original_value: values.serviceSource ?? service,
        },
        { onConflict: "project_id,service_id" },
      );
      if (error)
        throw new Error(
          `HoneyBook row ${row.rowNumber} services could not be stored`,
        );
    }

    if (values.proposalViewedAt) {
      const proposalProviderId = `honeybook-csv:${values.projectId}`;
      const { data: proposal, error: proposalError } = await client
        .from("proposals")
        .upsert(
          {
            organization_id: input.organizationId,
            project_id: projectId,
            provider: "honeybook_csv",
            provider_id: proposalProviderId,
            status: "Viewed",
            amount_cents: values.proposalValueCents ?? 0,
            raw_provider_fields: { source: "honeybook_csv" },
          },
          { onConflict: "organization_id,provider,provider_id" },
        )
        .select("id")
        .single();
      if (proposalError || !proposal)
        throw new Error("Proposal view could not be stored");
      const { error: viewError } = await client.from("proposal_views").upsert(
        {
          organization_id: input.organizationId,
          proposal_id: proposal.id,
          provider_event_id: `${proposalProviderId}:${values.proposalViewedAt}`,
          viewed_at: values.proposalViewedAt,
          source_origin: "honeybook",
        },
        { onConflict: "organization_id,provider_event_id" },
      );
      if (viewError) throw new Error("Proposal view could not be stored");
    }

    const { error: activityError } = await client
      .from("activity_events")
      .upsert(
        {
          organization_id: input.organizationId,
          project_id: projectId,
          event_type: existing
            ? "honeybook_snapshot_updated"
            : "honeybook_project_imported",
          title: existing
            ? "HoneyBook project refreshed from CSV"
            : "HoneyBook project imported from CSV",
          source_origin: "honeybook",
          provider_event_id: `honeybook-csv:${values.projectId}:${row.fingerprint}`,
          occurred_at: new Date().toISOString(),
          metadata: { source_record_id: source.id, file_name: input.fileName },
        },
        { onConflict: "organization_id,source_origin,provider_event_id" },
      );
    if (activityError)
      throw new Error("HoneyBook import activity could not be recorded");
  }

  const now = new Date().toISOString();
  const { error: connectionError } = await client
    .from("sync_connections")
    .upsert(
      {
        organization_id: input.organizationId,
        provider: "honeybook_manual",
        display_name: "HoneyBook manual CSV",
        status: "connected",
        configuration: {
          transport: "manual_csv",
          last_file_name: input.fileName,
        },
        last_attempt_at: now,
        last_success_at: now,
      },
      { onConflict: "organization_id,provider" },
    );
  if (connectionError)
    throw new Error("HoneyBook manual sync status could not be updated");
  await client.from("audit_log").insert({
    organization_id: input.organizationId,
    actor_user_id: input.userId,
    action: "honeybook_csv.completed",
    entity_type: "source_records",
    new_value: result,
    reason: `Manual HoneyBook import from ${input.fileName}`,
  });
  return result;
}
