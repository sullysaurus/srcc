import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { buildOperationalInsights } from "./insights";
export async function generateOperationalInsights(organizationId: string) {
  const admin = createAdminSupabaseClient();
  const { data: projects, error } = await admin
    .from("projects")
    .select("id,name,next_follow_up_at,event_at,booked_value_cents")
    .eq("organization_id", organizationId);
  if (error) throw new Error("Operational insight source lookup failed");
  const generatedAt = new Date().toISOString();
  const insights = buildOperationalInsights(
    (projects ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      nextFollowUpAt: row.next_follow_up_at,
      eventAt: row.event_at,
      bookedValueCents: Number(row.booked_value_cents),
    })),
  );
  await admin
    .from("operational_alerts")
    .update({ resolved_at: generatedAt })
    .eq("organization_id", organizationId)
    .in("category", ["sales", "operations"])
    .is("resolved_at", null);
  for (const insight of insights) {
    await admin.from("operational_alerts").upsert(
      {
        organization_id: organizationId,
        alert_key: insight.key,
        severity: insight.severity,
        category: insight.category,
        title: insight.title,
        detail: insight.detail,
        entity_type: insight.entityId ? "project" : null,
        entity_id: insight.entityId ?? null,
        source: "Projects + Tasks",
        source_date_range: { asOf: generatedAt },
        last_detected_at: generatedAt,
        resolved_at: null,
        metadata: { suggestedAction: insight.suggestedAction },
      },
      { onConflict: "organization_id,alert_key,entity_id" },
    );
    await admin.from("recommendations").upsert(
      {
        organization_id: organizationId,
        recommendation_key: insight.key,
        category: insight.category,
        priority: insight.severity === "critical" ? 90 : 60,
        title: insight.title,
        rationale: insight.detail,
        suggested_action: insight.suggestedAction,
        source: "Projects + Tasks",
        source_date_range: { asOf: generatedAt },
        generated_at: generatedAt,
        metadata: { projectId: insight.entityId },
      },
      { onConflict: "organization_id,recommendation_key" },
    );
  }
  return { generated: insights.length };
}
