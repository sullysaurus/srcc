"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { previewHoneyBookCsv } from "@/lib/domain/honeybook-csv";
import { ingestHoneyBookCsv } from "@/lib/imports/honeybook-csv-ingestion";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function setHoneyBookZapierState(formData: FormData) {
  const context = await requireOrganizationContext(["owner", "admin"]);
  const enabled = formData.get("enabled") === "true";
  const admin = createAdminSupabaseClient();
  const { data: existing } = await admin
    .from("sync_connections")
    .select("last_success_at")
    .eq("organization_id", context.organizationId)
    .eq("provider", "honeybook_zapier")
    .maybeSingle();
  const { error } = await admin.from("sync_connections").upsert(
    {
      organization_id: context.organizationId,
      provider: "honeybook_zapier",
      display_name: "HoneyBook via Zapier",
      status: enabled
        ? existing?.last_success_at
          ? "connected"
          : "not_configured"
        : "disabled",
      configuration: {
        transport: "zapier_webhook",
        enabled,
        supported_events: [
          "new_inquiry",
          "client_created",
          "project_stage_changed",
          "project_booked",
          "payment_received",
          "meeting_scheduled",
        ],
      },
      disconnected_at: enabled ? null : new Date().toISOString(),
    },
    { onConflict: "organization_id,provider" },
  );
  if (error) redirect("/integrations/honeybook?error=state_update_failed");
  await admin.from("audit_log").insert({
    organization_id: context.organizationId,
    actor_user_id: context.user.id,
    action: enabled ? "honeybook_zapier.enabled" : "honeybook_zapier.disabled",
    entity_type: "sync_connections",
    reason: "Administrator changed the HoneyBook automatic sync state",
  });
  revalidatePath("/integrations/honeybook");
  revalidatePath("/integrations");
  redirect(
    `/integrations/honeybook?zapier=${enabled ? "enabled" : "disabled"}`,
  );
}

export async function importHoneyBookCsv(formData: FormData) {
  const context = await requireOrganizationContext([
    "owner",
    "admin",
    "sales",
    "operations",
  ]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 10_000_000)
    redirect("/integrations/honeybook?error=invalid_upload");
  let rows;
  try {
    rows = previewHoneyBookCsv(await file.text());
  } catch {
    redirect("/integrations/honeybook?error=invalid_csv");
  }
  const result = await ingestHoneyBookCsv(createAdminSupabaseClient(), {
    organizationId: context.organizationId,
    userId: context.user.id,
    fileName: file.name.slice(0, 180),
    rows,
  });
  revalidatePath("/pipeline");
  revalidatePath("/");
  revalidatePath("/integrations/honeybook");
  redirect(
    `/integrations/honeybook?imported=${result.processed}&created=${result.created}&updated=${result.updated}&skipped=${result.skipped}&mappings=${result.mappingIssues}`,
  );
}
