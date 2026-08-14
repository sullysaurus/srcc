import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  honeyBookWebhookSchema,
  payloadDigest,
  safeWebhookPayload,
  verifySharedSecret,
} from "@/lib/integrations/honeybook-webhook";
import { processHoneyBookEvent } from "@/lib/integrations/honeybook-processor";
import { encryptSecret } from "@/lib/integrations/token-crypto";

export async function POST(request: Request) {
  if (
    !env.HONEYBOOK_WEBHOOK_SECRET ||
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.SUPABASE_SERVICE_ROLE_KEY ||
    !env.OAUTH_TOKEN_ENCRYPTION_KEY
  )
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (
    !verifySharedSecret(
      request.headers.get("x-webhook-secret"),
      env.HONEYBOOK_WEBHOOK_SECRET,
    )
  )
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const raw = await request.text();
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = honeyBookWebhookSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const organizationId = request.headers.get("x-organization-id");
  if (!organizationId)
    return NextResponse.json(
      { error: "missing_organization" },
      { status: 400 },
    );
  const receivedAt = Date.now();
  if (
    Math.abs(receivedAt - Date.parse(parsed.data.occurred_at)) >
    7 * 24 * 60 * 60 * 1000
  )
    return NextResponse.json(
      { error: "replay_window_exceeded" },
      { status: 409 },
    );
  const supabase = createAdminSupabaseClient();
  const { data: connection } = await supabase
    .from("sync_connections")
    .select("status,configuration")
    .eq("organization_id", organizationId)
    .eq("provider", "honeybook_zapier")
    .maybeSingle();
  const configuration = connection?.configuration as {
    enabled?: boolean;
  } | null;
  if (
    !connection ||
    connection.status === "disabled" ||
    configuration?.enabled !== true
  )
    return NextResponse.json({ error: "connection_disabled" }, { status: 503 });
  const { data: inserted, error } = await supabase
    .from("webhook_events")
    .insert({
      organization_id: organizationId,
      provider: "honeybook_zapier",
      provider_event_id: parsed.data.event_id,
      idempotency_key: `honeybook_zapier:${parsed.data.event_id}`,
      signature_verified: true,
      safe_payload: safeWebhookPayload(parsed.data),
      encrypted_payload: encryptSecret(raw, env.OAUTH_TOKEN_ENCRYPTION_KEY),
      retention_expires_at: new Date(
        Date.now() + 30 * 86_400_000,
      ).toISOString(),
      payload_digest: payloadDigest(raw),
      status: "running",
    })
    .select("id")
    .maybeSingle();
  let webhookId = inserted?.id as string | undefined;
  if (error?.code === "23505") {
    const { data: existing } = await supabase
      .from("webhook_events")
      .select("id,status")
      .eq("organization_id", organizationId)
      .eq("provider", "honeybook_zapier")
      .eq("provider_event_id", parsed.data.event_id)
      .single();
    if (existing?.status === "succeeded")
      return NextResponse.json({ accepted: true, duplicate: true });
    webhookId = existing?.id;
  } else if (error)
    return NextResponse.json({ error: "ingestion_failed" }, { status: 500 });
  if (!webhookId)
    return NextResponse.json({ error: "ingestion_failed" }, { status: 500 });
  try {
    await processHoneyBookEvent(organizationId, parsed.data);
    await Promise.all([
      supabase
        .from("webhook_events")
        .update({
          status: "succeeded",
          processed_at: new Date().toISOString(),
          error_summary: null,
        })
        .eq("id", webhookId),
      supabase.from("sync_connections").upsert(
        {
          organization_id: organizationId,
          provider: "honeybook_zapier",
          display_name: "HoneyBook via Zapier",
          status: "connected",
          configuration: {
            transport: "zapier_webhook",
            enabled: true,
            supportedEvents: [
              "new_inquiry",
              "client_created",
              "project_stage_changed",
              "project_booked",
              "payment_received",
              "meeting_scheduled",
            ],
          },
          last_attempt_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,provider" },
      ),
    ]);
    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch (processingError) {
    const summary =
      processingError instanceof Error
        ? processingError.message
        : "HoneyBook processing failed";
    await Promise.all([
      supabase
        .from("webhook_events")
        .update({ status: "failed", error_summary: summary.slice(0, 300) })
        .eq("id", webhookId),
      supabase.from("sync_connections").upsert(
        {
          organization_id: organizationId,
          provider: "honeybook_zapier",
          display_name: "HoneyBook via Zapier",
          status: "failed",
          configuration: { transport: "zapier_webhook", enabled: true },
          last_attempt_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,provider" },
      ),
    ]);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
