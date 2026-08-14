"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const decisionSchema = z.object({
  queueId: z.string().uuid(),
  canonicalValue: z.string().min(1).max(100),
});

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

export async function applyMappingDecision(formData: FormData) {
  const parsed = decisionSchema.safeParse({
    queueId: formData.get("queueId"),
    canonicalValue: formData.get("canonicalValue"),
  });
  if (!parsed.success) redirect("/mapping-queue?error=invalid_decision");
  const context = await requireOrganizationContext([
    "owner",
    "admin",
    "sales",
    "operations",
  ]);
  const admin = createAdminSupabaseClient();
  const { data: selected } = await admin
    .from("mapping_queue")
    .select("id,field_name,source_value,source_records!inner(source_type)")
    .eq("organization_id", context.organizationId)
    .eq("id", parsed.data.queueId)
    .maybeSingle();
  if (!selected) redirect("/mapping-queue?error=not_found");
  const source = Array.isArray(selected.source_records)
    ? selected.source_records[0]
    : selected.source_records;
  const sourceType = String(source?.source_type ?? "google_sheet");
  const excluded = parsed.data.canonicalValue === "__exclude__";
  const { data: rule, error: ruleError } = await admin
    .from("mapping_rules")
    .upsert(
      {
        organization_id: context.organizationId,
        source_type: sourceType,
        field_name: selected.field_name,
        source_value: selected.source_value,
        canonical_value: excluded ? null : parsed.data.canonicalValue,
        status: excluded ? "excluded" : "mapped",
        decided_by: context.user.id,
        decided_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,source_type,field_name,source_value" },
    )
    .select("id")
    .single();
  if (ruleError || !rule) redirect("/mapping-queue?error=save_failed");
  const { data: queues } = await admin
    .from("mapping_queue")
    .select(
      "id,source_record_id,source_records!inner(source_spreadsheet_id,source_tab,source_row_number,source_type)",
    )
    .eq("organization_id", context.organizationId)
    .eq("field_name", selected.field_name)
    .eq("source_value", selected.source_value)
    .eq("source_records.source_type", sourceType)
    .eq("status", "pending");
  if (!excluded)
    for (const queue of queues ?? []) {
      const record = Array.isArray(queue.source_records)
        ? queue.source_records[0]
        : queue.source_records;
      const projectQuery = admin
        .from("projects")
        .select("id")
        .eq("organization_id", context.organizationId)
        .eq("source_spreadsheet_id", record.source_spreadsheet_id)
        .eq("source_tab", record.source_tab)
        .eq("source_row_number", record.source_row_number);
      const { data: project } = await projectQuery.maybeSingle();
      if (!project) continue;
      if (selected.field_name === "status") {
        const stageKey = stageKeyByName[parsed.data.canonicalValue];
        const { data: stage } = stageKey
          ? await admin
              .from("pipeline_stages")
              .select("id")
              .eq("organization_id", context.organizationId)
              .eq("key", stageKey)
              .maybeSingle()
          : { data: null };
        if (stage)
          await admin
            .from("projects")
            .update({ pipeline_stage_id: stage.id })
            .eq("id", project.id);
      }
      if (selected.field_name === "service") {
        const { data: service } = await admin
          .from("services")
          .select("id")
          .eq("organization_id", context.organizationId)
          .eq("name", parsed.data.canonicalValue)
          .maybeSingle();
        if (service)
          await admin
            .from("project_services")
            .upsert(
              {
                organization_id: context.organizationId,
                project_id: project.id,
                service_id: service.id,
                source_origin: "google_sheet",
                original_value: selected.source_value,
              },
              { onConflict: "project_id,service_id" },
            );
      }
    }
  const queueIds = (queues ?? []).map((queue) => queue.id);
  if (queueIds.length)
    await admin
      .from("mapping_queue")
      .update({
        status: excluded ? "excluded" : "mapped",
        mapping_rule_id: rule.id,
        resolved_by: context.user.id,
        resolved_at: new Date().toISOString(),
      })
      .in("id", queueIds);
  await admin
    .from("audit_log")
    .insert({
      organization_id: context.organizationId,
      actor_user_id: context.user.id,
      action: "mapping_rule.applied",
      entity_type: "mapping_rule",
      entity_id: rule.id,
      new_value: {
        field: selected.field_name,
        source_value: selected.source_value,
        canonical_value: excluded ? null : parsed.data.canonicalValue,
        affected: queueIds.length,
      },
    });
  redirect(`/mapping-queue?resolved=${queueIds.length}`);
}
