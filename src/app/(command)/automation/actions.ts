"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { conversionGateKeys } from "@/lib/conversions/core";
import { env } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
const inputSchema = z.object({
  gate: z.enum(conversionGateKeys),
  evidence: z.string().trim().min(8).max(500),
  intent: z.enum(["approve", "revoke"]),
});
export async function updateConversionGate(formData: FormData) {
  const parsed = inputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: membership } = await client
    .from("organization_memberships")
    .select("organization_id,role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership || membership.role !== "owner")
    throw new Error("Owner role required");
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const { gate, evidence, intent } = parsed.data;
  if (intent === "approve" && gate === "production_uploads_approved") {
    const { data: gates } = await admin
      .from("conversion_upload_gates")
      .select("gate,satisfied,approved_at")
      .eq("organization_id", membership.organization_id)
      .neq("gate", "production_uploads_approved");
    if (
      env.GOOGLE_ADS_UPLOADS_ENABLED !== "true" ||
      (gates ?? []).length !== 4 ||
      (gates ?? []).some((row) => !row.satisfied || !row.approved_at)
    )
      throw new Error("Production approval remains locked");
  }
  const values =
    intent === "approve"
      ? {
          satisfied: true,
          evidence,
          approved_by: user.id,
          approved_at: now,
          revoked_by: null,
          revoked_at: null,
        }
      : {
          satisfied: false,
          evidence,
          approved_by: null,
          approved_at: null,
          revoked_by: user.id,
          revoked_at: now,
        };
  const { data: gateRow, error } = await admin
    .from("conversion_upload_gates")
    .update(values)
    .eq("organization_id", membership.organization_id)
    .eq("gate", gate)
    .select("id")
    .single();
  if (error) throw new Error("Gate update failed");
  await admin
    .from("audit_log")
    .insert({
      organization_id: membership.organization_id,
      actor_user_id: user.id,
      action: `conversion_gate.${intent}`,
      entity_type: "conversion_upload_gate",
      entity_id: gateRow.id,
      new_value: { gate, satisfied: intent === "approve" },
      reason: evidence,
    });
  revalidatePath("/automation");
}
