import "server-only";
import { env } from "@/lib/env";
import { encryptSecret } from "@/lib/integrations/token-crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  dryRunConversion,
  prepareConversionCandidate,
  type ConversionCandidateInput,
  type ConversionOutcome,
} from "./core";

type ProjectRow = {
  id: string;
  updated_at: string;
  booked_value_cents: number;
  primary_contact_id: string | null;
  pipeline_stages: { key: string } | null;
};
type AttributionRow = {
  project_id: string;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
};
type ContactRow = {
  id: string;
  email_normalized: string | null;
  phone_e164: string | null;
};

export async function stageConversionCandidates(organizationId: string) {
  const admin = createAdminSupabaseClient();
  const [
    { data: projects, error: projectsError },
    { data: payments, error: paymentsError },
    { data: attributions },
    { data: contacts },
    { data: actions },
  ] = await Promise.all([
    admin
      .from("projects")
      .select(
        "id,updated_at,booked_value_cents,primary_contact_id,pipeline_stages(key)",
      )
      .eq("organization_id", organizationId),
    admin
      .from("payments")
      .select("id,project_id,amount_cents,paid_at")
      .eq("organization_id", organizationId),
    admin
      .from("lead_attribution")
      .select("project_id,gclid,gbraid,wbraid,occurred_at")
      .eq("organization_id", organizationId)
      .order("occurred_at", { ascending: false }),
    admin
      .from("contacts")
      .select("id,email_normalized,phone_e164")
      .eq("organization_id", organizationId),
    admin
      .from("google_ads_conversion_actions")
      .select("id,business_outcome,status")
      .eq("organization_id", organizationId)
      .eq("status", "ENABLED"),
  ]);
  if (projectsError || paymentsError)
    throw new Error("Conversion candidate source lookup failed");
  const actionsByOutcome = new Map<string, string[]>();
  for (const row of actions ?? []) {
    if (!row.business_outcome || row.business_outcome === "unmapped") continue;
    actionsByOutcome.set(row.business_outcome, [
      ...(actionsByOutcome.get(row.business_outcome) ?? []),
      row.id,
    ]);
  }
  const actionByOutcome = new Map(
    [...actionsByOutcome].flatMap(([outcome, ids]) =>
      ids.length === 1 ? [[outcome, ids[0]] as const] : [],
    ),
  );
  const attributionByProject = new Map<string, AttributionRow>();
  for (const row of attributions ?? [])
    if (
      (row.gclid || row.gbraid || row.wbraid) &&
      !attributionByProject.has(row.project_id)
    )
      attributionByProject.set(row.project_id, row);
  const contactById = new Map(
    (contacts ?? []).map((row) => [row.id, row as ContactRow]),
  );
  const inputs: ConversionCandidateInput[] = [];
  const projectById = new Map(
    (projects ?? []).map((row) => [row.id, row as unknown as ProjectRow]),
  );
  for (const project of projectById.values()) {
    const stage = project.pipeline_stages?.key;
    if (stage && !["inquiry", "contacted", "lost", "archived"].includes(stage))
      inputs.push(
        candidate(
          project,
          "qualified_lead",
          0,
          project.updated_at,
          "qualified",
        ),
      );
    if (project.booked_value_cents > 0)
      inputs.push(
        candidate(
          project,
          "booked_event",
          Number(project.booked_value_cents),
          project.updated_at,
          "booked",
        ),
      );
  }
  for (const payment of payments ?? []) {
    const project = projectById.get(payment.project_id);
    if (project)
      inputs.push(
        candidate(
          project,
          "revenue_collected",
          Number(payment.amount_cents),
          payment.paid_at,
          payment.id,
        ),
      );
  }

  function candidate(
    project: ProjectRow,
    outcome: ConversionOutcome,
    valueCents: number,
    occurredAt: string,
    eventId?: string,
  ): ConversionCandidateInput {
    const attribution = attributionByProject.get(project.id);
    const contact = project.primary_contact_id
      ? contactById.get(project.primary_contact_id)
      : null;
    return {
      projectId: project.id,
      outcome,
      valueCents,
      occurredAt,
      eventId,
      conversionActionId: actionByOutcome.get(outcome),
      gclid: attribution?.gclid,
      gbraid: attribution?.gbraid,
      wbraid: attribution?.wbraid,
      email: contact?.email_normalized,
      phone: contact?.phone_e164,
    };
  }

  let staged = 0,
    invalid = 0;
  for (const input of inputs) {
    const prepared = prepareConversionCandidate(input);
    const dryRun = dryRunConversion(input);
    const rawIdentifier =
      prepared.identifier?.type === "enhanced_lead"
        ? null
        : prepared.identifier?.value;
    const clickCiphertext =
      rawIdentifier && env.OAUTH_TOKEN_ENCRYPTION_KEY
        ? encryptSecret(rawIdentifier, env.OAUTH_TOKEN_ENCRYPTION_KEY)
        : null;
    const errors = [...prepared.errors];
    if (rawIdentifier && !clickCiphertext)
      errors.push("encryption_key_not_configured");
    const status = errors.length ? "invalid" : "dry_run_passed";
    const { error } = await admin
      .from("google_ads_conversion_uploads")
      .upsert(
        {
          organization_id: organizationId,
          project_id: input.projectId,
          conversion_action: input.outcome,
          conversion_action_id: input.conversionActionId ?? null,
          value_cents: input.valueCents,
          deduplication_key: prepared.deduplicationKey,
          status,
          conversion_occurred_at: input.occurredAt,
          click_identifier_type: prepared.identifier?.type ?? null,
          click_identifier_ciphertext: clickCiphertext,
          user_data_hashes: prepared.userDataHashes,
          validation_result: { ...dryRun, ok: errors.length === 0, errors },
          dry_run_at: new Date().toISOString(),
        },
        {
          onConflict: "organization_id,deduplication_key",
          ignoreDuplicates: true,
        },
      );
    if (error) throw new Error("Conversion candidate staging failed");
    if (status === "invalid") invalid++;
    else staged++;
  }
  return {
    examined: inputs.length,
    staged,
    invalid,
    productionUploadAttempted: false,
  };
}
