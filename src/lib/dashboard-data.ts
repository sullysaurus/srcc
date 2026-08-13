import { env, hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function organizationContext() {
  if (!hasSupabaseEnv) return null;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return membership
    ? { supabase, organizationId: membership.organization_id, userId: user.id }
    : null;
}

export async function loadIntegrationState() {
  const context = await organizationContext();
  if (!context) return null;
  const [{ data: connections }, { data: issues }] = await Promise.all([
    context.supabase
      .from("sync_connections")
      .select("provider,status,last_success_at,last_attempt_at,configuration")
      .eq("organization_id", context.organizationId),
    context.supabase
      .from("integration_health_issues")
      .select("provider,severity,title,detail,last_detected_at")
      .eq("organization_id", context.organizationId)
      .is("resolved_at", null)
      .order("last_detected_at", { ascending: false }),
  ]);
  return { connections: connections ?? [], issues: issues ?? [] };
}

export async function loadAdsSummary() {
  const context = await organizationContext();
  if (!context) return null;
  const start = new Date(Date.now() - 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [{ data: metrics }, { data: campaigns }, { data: projects }] =
    await Promise.all([
      context.supabase
        .from("google_ads_daily_metrics")
        .select(
          "entity_provider_id,impressions,clicks,cost_cents,conversions,conversion_value_cents,date",
        )
        .eq("organization_id", context.organizationId)
        .eq("entity_type", "campaign")
        .gte("date", start),
      context.supabase
        .from("google_ads_campaigns")
        .select("provider_id,name,budget_cents,status")
        .eq("organization_id", context.organizationId),
      context.supabase
        .from("projects")
        .select(
          "id,booked_value_cents,collected_cents,pipeline_stage_id,lead_source",
        )
        .eq("organization_id", context.organizationId)
        .ilike("lead_source", "%google%"),
    ]);
  if (!metrics?.length) return null;
  const campaignMap = new Map(
    (campaigns ?? []).map((campaign) => [campaign.provider_id, campaign]),
  );
  const grouped = new Map<
    string,
    {
      name: string;
      spendCents: number;
      clicks: number;
      reportedConversions: number;
      reportedValueCents: number;
    }
  >();
  for (const metric of metrics) {
    const id = metric.entity_provider_id;
    const current = grouped.get(id) ?? {
      name: campaignMap.get(id)?.name ?? id,
      spendCents: 0,
      clicks: 0,
      reportedConversions: 0,
      reportedValueCents: 0,
    };
    current.spendCents += Number(metric.cost_cents);
    current.clicks += Number(metric.clicks);
    current.reportedConversions += Number(metric.conversions);
    current.reportedValueCents += Number(metric.conversion_value_cents);
    grouped.set(id, current);
  }
  return {
    start,
    end: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
    campaigns: [...grouped.values()],
    spendCents: [...grouped.values()].reduce(
      (sum, row) => sum + row.spendCents,
      0,
    ),
    reportedConversions: [...grouped.values()].reduce(
      (sum, row) => sum + row.reportedConversions,
      0,
    ),
    reportedValueCents: [...grouped.values()].reduce(
      (sum, row) => sum + row.reportedValueCents,
      0,
    ),
    attributedLeads: (projects ?? []).length,
    bookedRevenueCents: (projects ?? []).reduce(
      (sum, row) => sum + Number(row.booked_value_cents),
      0,
    ),
  };
}

export async function loadSearchSummary() {
  const context = await organizationContext();
  if (!context) return null;
  const start = new Date(Date.now() - 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data } = await context.supabase
    .from("search_console_daily_metrics")
    .select("query,clicks,impressions,ctr,average_position,date")
    .eq("organization_id", context.organizationId)
    .gte("date", start);
  if (!data?.length) return null;
  const grouped = new Map<
    string,
    {
      query: string;
      clicks: number;
      impressions: number;
      weightedPosition: number;
    }
  >();
  for (const row of data) {
    if (!row.query) continue;
    const current = grouped.get(row.query) ?? {
      query: row.query,
      clicks: 0,
      impressions: 0,
      weightedPosition: 0,
    };
    current.clicks += Number(row.clicks);
    current.impressions += Number(row.impressions);
    current.weightedPosition +=
      Number(row.average_position) * Number(row.impressions);
    grouped.set(row.query, current);
  }
  const queries = [...grouped.values()]
    .map((row) => ({
      ...row,
      ctr: row.impressions ? row.clicks / row.impressions : 0,
      position: row.impressions ? row.weightedPosition / row.impressions : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);
  const totals = queries.reduce(
    (sum, row) => ({
      clicks: sum.clicks + row.clicks,
      impressions: sum.impressions + row.impressions,
      weightedPosition: sum.weightedPosition + row.weightedPosition,
    }),
    { clicks: 0, impressions: 0, weightedPosition: 0 },
  );
  return {
    start,
    end: new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10),
    clicks: totals.clicks,
    impressions: totals.impressions,
    ctr: totals.impressions ? totals.clicks / totals.impressions : 0,
    position: totals.impressions
      ? totals.weightedPosition / totals.impressions
      : 0,
    queries: queries.slice(0, 20),
  };
}

export async function loadAttributionReport() {
  const context = await organizationContext();
  if (!context) return null;
  const [{ data: touches }, { data: searchRows }] = await Promise.all([
    context.supabase
      .from("lead_attribution")
      .select(
        "project_id,touch_type,utm_source,utm_medium,landing_page,gclid,gbraid,wbraid,projects(name,booked_value_cents,pipeline_stages(key))",
      )
      .eq("organization_id", context.organizationId)
      .eq("touch_type", "first_touch"),
    context.supabase
      .from("search_console_daily_metrics")
      .select("page,clicks,impressions")
      .eq("organization_id", context.organizationId)
      .gte(
        "date",
        new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10),
      ),
  ]);
  if (!touches?.length) return null;
  const pages = new Map<
    string,
    {
      page: string;
      leads: number;
      bookings: number;
      bookedRevenueCents: number;
      organicClicks: number;
      organicImpressions: number;
    }
  >();
  for (const touch of touches) {
    const project = touch.projects as unknown as {
      name: string;
      booked_value_cents: number;
      pipeline_stages: { key: string } | null;
    };
    const page = touch.landing_page ?? "Unknown landing page";
    const row = pages.get(page) ?? {
      page,
      leads: 0,
      bookings: 0,
      bookedRevenueCents: 0,
      organicClicks: 0,
      organicImpressions: 0,
    };
    row.leads += 1;
    if (Number(project?.booked_value_cents) > 0) {
      row.bookings += 1;
      row.bookedRevenueCents += Number(project.booked_value_cents);
    }
    pages.set(page, row);
  }
  for (const search of searchRows ?? []) {
    const row = pages.get(search.page);
    if (row) {
      row.organicClicks += Number(search.clicks);
      row.organicImpressions += Number(search.impressions);
    }
  }
  const all = [...pages.values()].sort(
    (a, b) => b.bookedRevenueCents - a.bookedRevenueCents,
  );
  const organic = (touches ?? []).filter((touch) => {
    const source = touch.utm_source?.toLowerCase();
    const medium = touch.utm_medium?.toLowerCase();
    return (
      medium === "organic" ||
      source === "organic" ||
      (source === "google" && medium !== "cpc" && !touch.gclid)
    );
  });
  const organicProjects = organic.map(
    (touch) =>
      touch.projects as unknown as {
        booked_value_cents: number;
        pipeline_stages: { key: string } | null;
      },
  );
  return {
    leads: touches.length,
    organicLeads: organic.length,
    organicQualified: organicProjects.filter(
      (project) =>
        !["inquiry", "contacted"].includes(
          project.pipeline_stages?.key ?? "inquiry",
        ),
    ).length,
    organicBookings: organicProjects.filter(
      (project) => Number(project.booked_value_cents) > 0,
    ).length,
    organicBookedRevenueCents: organicProjects.reduce(
      (sum, project) => sum + Number(project.booked_value_cents ?? 0),
      0,
    ),
    pages: all,
  };
}

export async function loadCommunicationsReport() {
  const context = await organizationContext();
  if (!context) return null;
  const [
    { data: communications },
    { count: pendingMappings },
    { data: connection },
  ] = await Promise.all([
    context.supabase
      .from("communications")
      .select(
        "id,direction,channel,subject,internal_summary,occurred_at,matched_by,projects(name)",
      )
      .eq("organization_id", context.organizationId)
      .order("occurred_at", { ascending: false })
      .limit(50),
    context.supabase
      .from("mapping_queue")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", context.organizationId)
      .eq("status", "pending"),
    context.supabase
      .from("sync_connections")
      .select("status,last_success_at,configuration")
      .eq("organization_id", context.organizationId)
      .eq("provider", "gmail")
      .maybeSingle(),
  ]);
  return {
    communications: communications ?? [],
    pendingMappings: pendingMappings ?? 0,
    connection,
  };
}

export async function loadAutomationReport() {
  const context = await organizationContext();
  if (!context) return null;
  const [
    { data: gates },
    { data: uploads },
    { data: alerts },
    { data: recommendations },
    { data: membership },
  ] = await Promise.all([
    context.supabase
      .from("conversion_upload_gates")
      .select("gate,satisfied,evidence,approved_at")
      .eq("organization_id", context.organizationId)
      .order("created_at"),
    context.supabase
      .from("google_ads_conversion_uploads")
      .select("status")
      .eq("organization_id", context.organizationId),
    context.supabase
      .from("operational_alerts")
      .select("id,severity,title,detail,source,last_detected_at")
      .eq("organization_id", context.organizationId)
      .is("resolved_at", null)
      .order("last_detected_at", { ascending: false })
      .limit(10),
    context.supabase
      .from("recommendations")
      .select("id,priority,title,rationale,suggested_action,source")
      .eq("organization_id", context.organizationId)
      .eq("status", "open")
      .order("priority", { ascending: false })
      .limit(10),
    context.supabase
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", context.organizationId)
      .eq("user_id", context.userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
  ]);
  const counts = (uploads ?? []).reduce(
    (all, row) => ({ ...all, [row.status]: (all[row.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );
  return {
    runtimeEnabled: env.GOOGLE_ADS_UPLOADS_ENABLED === "true",
    isOwner: membership?.role === "owner",
    gates: gates ?? [],
    queue: {
      dry_run_passed: counts.dry_run_passed ?? 0,
      invalid: counts.invalid ?? 0,
      uploaded: counts.uploaded ?? 0,
    },
    alerts: alerts ?? [],
    recommendations: recommendations ?? [],
  };
}
