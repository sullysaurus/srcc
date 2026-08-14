import { createHash } from "node:crypto";
import type { z } from "zod";
import { normalizeService, normalizeStage } from "@/lib/domain/normalization";
import { honeyBookWebhookSchema } from "./honeybook-webhook";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { verifyAttributionToken } from "@/lib/domain/attribution-token";

type Payload = z.infer<typeof honeyBookWebhookSchema>;
const stringValue = (data: Record<string, unknown>, key: string) =>
  typeof data[key] === "string" ? String(data[key]).trim() || null : null;
const centsValue = (data: Record<string, unknown>, key: string) =>
  Number.isInteger(data[key]) && Number(data[key]) >= 0
    ? Number(data[key])
    : null;

async function sourceRecord(organizationId: string, payload: Payload) {
  const admin = createAdminSupabaseClient();
  const fingerprint = createHash("sha256")
    .update(`honeybook_zapier:${payload.event_id}`)
    .digest("hex");
  const { data, error } = await admin
    .from("source_records")
    .upsert(
      {
        organization_id: organizationId,
        source_type: "honeybook_zapier",
        provider_record_id: payload.project_id ?? payload.event_id,
        raw_values: {
          event: payload.event,
          event_id: payload.event_id,
          occurred_at: payload.occurred_at,
          data_keys: Object.keys(payload.data),
        },
        normalized_values: {},
        import_fingerprint: fingerprint,
      },
      { onConflict: "organization_id,source_type,import_fingerprint" },
    )
    .select("id")
    .single();
  if (error) throw new Error("Unable to retain HoneyBook source record");
  return data.id as string;
}

async function queueMapping(
  organizationId: string,
  sourceRecordId: string,
  fieldName: string,
  sourceValue: string,
  suggestedValue?: string | null,
) {
  const admin = createAdminSupabaseClient();
  await admin.from("mapping_queue").upsert(
    {
      organization_id: organizationId,
      source_record_id: sourceRecordId,
      field_name: fieldName,
      source_value: sourceValue,
      suggested_value: suggestedValue ?? null,
    },
    { onConflict: "source_record_id,field_name" },
  );
}

async function findStageId(
  organizationId: string,
  sourceStage: string,
  sourceRecordId: string,
) {
  const normalized = normalizeStage(sourceStage);
  if (!normalized.value) {
    await queueMapping(
      organizationId,
      sourceRecordId,
      "pipeline_stage",
      sourceStage,
    );
    return null;
  }
  const key = normalized.value
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("pipeline_stages")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("key", key)
    .maybeSingle();
  return data?.id ?? null;
}

async function upsertContact(organizationId: string, payload: Payload) {
  if (!payload.client_id) return null;
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("contacts")
    .upsert(
      {
        organization_id: organizationId,
        honeybook_client_id: payload.client_id,
        first_name: stringValue(payload.data, "first_name"),
        last_name: stringValue(payload.data, "last_name"),
        email_normalized: stringValue(payload.data, "email")?.toLowerCase(),
        phone_e164: stringValue(payload.data, "phone"),
        raw_provider_fields: {
          source: "honeybook_zapier",
          last_event: payload.event,
        },
      },
      { onConflict: "organization_id,honeybook_client_id" },
    )
    .select("id")
    .single();
  if (error) throw new Error("Unable to store HoneyBook client");
  return data.id as string;
}

async function upsertProject(
  organizationId: string,
  payload: Payload,
  contactId: string | null,
  sourceRecordId: string,
) {
  if (!payload.project_id) return null;
  const admin = createAdminSupabaseClient();
  const sourceStage = stringValue(payload.data, "stage");
  const stageId = sourceStage
    ? await findStageId(organizationId, sourceStage, sourceRecordId)
    : null;
  const { data: existing } = await admin
    .from("projects")
    .select("id,raw_provider_fields")
    .eq("organization_id", organizationId)
    .eq("honeybook_project_id", payload.project_id)
    .maybeSingle();
  const values: Record<string, unknown> = {
    source_origin: "honeybook",
    raw_provider_fields: {
      ...((existing?.raw_provider_fields as Record<string, unknown> | null) ??
        {}),
      source: "honeybook_zapier",
      last_event: payload.event,
      honeybook_stage_name: sourceStage,
    },
  };
  const optionalFields = [
    ["project_url", "honeybook_url"],
    ["project_name", "name"],
    ["event_type", "event_type"],
    ["venue_name", "venue_name"],
    ["city", "city"],
    ["region", "region"],
    ["lead_source", "lead_source"],
    ["recent_activity_type", "last_communication_channel"],
  ] as const;
  for (const [source, column] of optionalFields) {
    const value = stringValue(payload.data, source);
    if (value) values[column] = value;
  }
  for (const [source, column] of [
    ["event_at", "event_at"],
    ["recent_activity_at", "last_communication_at"],
  ] as const) {
    const value = stringValue(payload.data, source);
    if (!value) continue;
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) values[column] = new Date(timestamp).toISOString();
  }
  if (contactId) values.primary_contact_id = contactId;
  if (stageId) values.pipeline_stage_id = stageId;
  for (const [key, column] of [
    ["estimated_value_cents", "estimated_value_cents"],
    ["proposal_value_cents", "proposal_value_cents"],
    ["booked_value_cents", "booked_value_cents"],
    ["collected_cents", "collected_cents"],
  ] as const) {
    const value = centsValue(payload.data, key);
    if (value !== null) values[column] = value;
  }
  if (existing) {
    const { error } = await admin
      .from("projects")
      .update(values)
      .eq("id", existing.id);
    if (error) throw new Error("Unable to update HoneyBook project");
    return existing.id as string;
  }
  const { data, error } = await admin
    .from("projects")
    .insert({
      ...values,
      organization_id: organizationId,
      honeybook_project_id: payload.project_id,
      name: values.name ?? "HoneyBook project",
    })
    .select("id")
    .single();
  if (error) throw new Error("Unable to store HoneyBook project");
  return data.id as string;
}

async function claimAttribution(
  organizationId: string,
  projectId: string,
  token: string,
) {
  if (!env.ATTRIBUTION_SIGNING_SECRET) return;
  const claim = verifyAttributionToken(token, env.ATTRIBUTION_SIGNING_SECRET);
  if (!claim || claim.organizationId !== organizationId) return;
  const admin = createAdminSupabaseClient();
  const { data: session } = await admin
    .from("attribution_sessions")
    .select("id,claimed_project_id,first_touch_at,last_touch_at")
    .eq("id", claim.sessionId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (
    !session ||
    (session.claimed_project_id && session.claimed_project_id !== projectId)
  )
    return;
  const { data: touches } = await admin
    .from("attribution_touch_events")
    .select(
      "gclid,gbraid,wbraid,utm_source,utm_medium,utm_campaign,utm_term,utm_content,landing_page,referrer,occurred_at",
    )
    .eq("session_id", session.id)
    .order("occurred_at");
  if (!touches?.length) return;
  const base = touches.map((touch) => ({
    organization_id: organizationId,
    project_id: projectId,
    touch_type: "captured",
    ...touch,
    first_touch_at: session.first_touch_at,
    last_touch_at: session.last_touch_at,
  }));
  const first = { ...base[0], touch_type: "first_touch" };
  const lastCandidate = [...base]
    .reverse()
    .find(
      (touch) =>
        touch.gclid ||
        touch.gbraid ||
        touch.wbraid ||
        (touch.utm_source && touch.utm_source.toLowerCase() !== "direct"),
    );
  const records = lastCandidate
    ? [...base, first, { ...lastCandidate, touch_type: "last_non_direct" }]
    : [...base, first];
  await admin
    .from("lead_attribution")
    .upsert(records, { onConflict: "project_id,touch_type,occurred_at" });
  await admin
    .from("attribution_sessions")
    .update({
      claimed_project_id: projectId,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", session.id);
}

async function syncServices(
  organizationId: string,
  projectId: string,
  payload: Payload,
  sourceRecordId: string,
) {
  const sourceValue =
    stringValue(payload.data, "services") ??
    stringValue(payload.data, "service");
  if (!sourceValue) return;
  const normalized = sourceValue
    .split(/[,;/|]+|\s+and\s+/i)
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .map((candidate) => ({ candidate, result: normalizeService(candidate) }));
  for (const item of normalized.filter((item) => !item.result.value))
    await queueMapping(
      organizationId,
      sourceRecordId,
      "service",
      item.candidate,
    );
  const names = [
    ...new Set(
      normalized.flatMap((item) =>
        item.result.value ? [item.result.value] : [],
      ),
    ),
  ];
  if (!names.length) return;
  const admin = createAdminSupabaseClient();
  const { data: services, error } = await admin
    .from("services")
    .select("id,name")
    .eq("organization_id", organizationId)
    .in("name", names);
  if (error) throw new Error("Unable to map HoneyBook services");
  for (const service of services ?? []) {
    const { error: linkError } = await admin.from("project_services").upsert(
      {
        organization_id: organizationId,
        project_id: projectId,
        service_id: service.id,
        source_origin: "honeybook",
        original_value: sourceValue,
      },
      { onConflict: "project_id,service_id" },
    );
    if (linkError) throw new Error("Unable to store HoneyBook services");
  }
}

export async function processHoneyBookEvent(
  organizationId: string,
  payload: Payload,
) {
  const admin = createAdminSupabaseClient();
  const sourceRecordId = await sourceRecord(organizationId, payload);
  const contactId = await upsertContact(organizationId, payload);
  let projectId: string | null = null;
  if (payload.project_id)
    projectId = await upsertProject(
      organizationId,
      payload,
      contactId,
      sourceRecordId,
    );
  if (projectId)
    await syncServices(organizationId, projectId, payload, sourceRecordId);
  const attributionToken =
    stringValue(payload.data, "attribution_token") ??
    stringValue(payload.data, "sr_attribution_token");
  if (projectId && attributionToken)
    await claimAttribution(organizationId, projectId, attributionToken);
  if (
    payload.event === "project_stage_changed" &&
    !stringValue(payload.data, "stage")
  )
    await queueMapping(
      organizationId,
      sourceRecordId,
      "pipeline_stage",
      "[missing stage]",
    );
  if (payload.event === "project_booked" && !stringValue(payload.data, "stage"))
    await queueMapping(
      organizationId,
      sourceRecordId,
      "pipeline_stage",
      "Booked trigger",
      "Confirm the canonical stage; no stage was guessed",
    );
  if (payload.event === "payment_received") {
    const paymentId = stringValue(payload.data, "payment_id");
    const amount = centsValue(payload.data, "amount_cents");
    if (projectId && paymentId && amount !== null) {
      const { error: paymentError } = await admin.from("payments").upsert(
        {
          organization_id: organizationId,
          project_id: projectId,
          provider: "honeybook_zapier",
          provider_id: paymentId,
          amount_cents: amount,
          paid_at: stringValue(payload.data, "paid_at") ?? payload.occurred_at,
          raw_provider_fields: { source: "honeybook_zapier" },
        },
        { onConflict: "organization_id,provider,provider_id" },
      );
      if (paymentError) throw new Error("Unable to store HoneyBook payment");
      const { data: payments, error: paymentsError } = await admin
        .from("payments")
        .select("amount_cents")
        .eq("organization_id", organizationId)
        .eq("project_id", projectId);
      if (paymentsError) throw new Error("Unable to total HoneyBook payments");
      const collectedCents = (payments ?? []).reduce(
        (sum, payment) => sum + Number(payment.amount_cents),
        0,
      );
      const { error: projectError } = await admin
        .from("projects")
        .update({ collected_cents: collectedCents })
        .eq("organization_id", organizationId)
        .eq("id", projectId);
      if (projectError) throw new Error("Unable to update collected revenue");
    } else
      await queueMapping(
        organizationId,
        sourceRecordId,
        "payment",
        "Incomplete payment payload",
      );
  }
  if (projectId)
    await admin.from("activity_events").upsert(
      {
        organization_id: organizationId,
        project_id: projectId,
        event_type: payload.event,
        title: payload.event.replaceAll("_", " "),
        source_origin: "honeybook",
        provider_event_id: payload.event_id,
        occurred_at: payload.occurred_at,
        metadata: { source: "honeybook_zapier" },
      },
      { onConflict: "organization_id,source_origin,provider_event_id" },
    );
  return { projectId, contactId, sourceRecordId };
}
