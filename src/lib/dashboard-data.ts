import { getOrganizationContext } from "@/lib/auth/organization-context";
import { env } from "@/lib/env";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  startOfDateInTimeZone,
} from "@/lib/domain/dates";

async function organizationContext() {
  const context = await getOrganizationContext();
  return context
    ? {
        supabase: context.supabase,
        organizationId: context.organizationId,
        userId: context.user.id,
      }
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

export type LiveProject = {
  id: string;
  name: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  stage: string;
  stageKey: string | null;
  source: string;
  sourceOrigin: string;
  owner: string;
  eventType: string;
  eventDate: string | null;
  venue: string;
  location: string;
  services: Array<{
    name: string;
    origin: string;
    originalValue: string | null;
  }>;
  estimatedCents: number;
  proposalCents: number;
  bookedCents: number;
  collectedCents: number;
  outstandingCents: number;
  lastContactAt: string | null;
  lastContactChannel: string | null;
  nextFollowUpAt: string | null;
  temperature: string | null;
  proposalStatus: string;
  proposalSentAt: string | null;
  firstViewedAt: string | null;
  latestViewedAt: string | null;
  attribution: string;
  honeybookUrl: string | null;
  createdAt: string;
};

type ProjectRow = Record<string, unknown> & {
  contacts?: Record<string, unknown> | null;
  pipeline_stages?: Record<string, unknown> | null;
  users?: Record<string, unknown> | null;
  project_services?: Array<
    Record<string, unknown> & { services?: Record<string, unknown> | null }
  >;
  proposals?: Array<
    Record<string, unknown> & {
      proposal_views?: Array<Record<string, unknown>>;
    }
  >;
  lead_attribution?: Array<Record<string, unknown>>;
};

function one(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value))
    return (value[0] as Record<string, unknown> | undefined) ?? null;
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length ? value : null;
}

function mapProject(row: ProjectRow): LiveProject {
  const contact = one(row.contacts);
  const stage = one(row.pipeline_stages);
  const owner = one(row.users);
  const proposals = (row.proposals ?? []).toSorted((left, right) =>
    String(right.sent_at ?? "").localeCompare(String(left.sent_at ?? "")),
  );
  const proposal = proposals[0];
  const views = (proposal?.proposal_views ?? [])
    .map((view) => String(view.viewed_at))
    .filter(Boolean)
    .toSorted();
  const attribution =
    (row.lead_attribution ?? []).find(
      (touch) => touch.touch_type === "last_non_direct",
    ) ?? row.lead_attribution?.[0];
  const contactName = [contact?.first_name, contact?.last_name]
    .filter(Boolean)
    .join(" ");
  const sourceLabel =
    stringOrNull(row.lead_source) ??
    String(row.source_origin ?? "Unknown").replaceAll("_", " ");
  const attributionLabel = attribution
    ? [attribution.utm_source, attribution.utm_campaign]
        .filter(Boolean)
        .join(" · ") ||
      (attribution.gclid ? "Google Ads click" : attribution.landing_page)
    : sourceLabel;
  const bookedCents = Number(row.booked_value_cents ?? 0);
  const collectedCents = Number(row.collected_cents ?? 0);
  const rawProviderFields = one(row.raw_provider_fields) ?? {};
  return {
    id: String(row.id),
    name: stringOrNull(row.name) ?? (contactName || "Unnamed lead"),
    contactName: contactName || stringOrNull(row.name) || "Unnamed lead",
    email: stringOrNull(contact?.email_normalized),
    phone: stringOrNull(contact?.phone_e164),
    stage:
      stringOrNull(rawProviderFields.honeybook_stage_name) ??
      stringOrNull(stage?.name) ??
      "Needs mapping",
    stageKey: stringOrNull(stage?.key),
    source: sourceLabel,
    sourceOrigin: String(row.source_origin ?? "manual"),
    owner: stringOrNull(owner?.display_name) ?? "Unassigned",
    eventType: stringOrNull(row.event_type) ?? "Event type not set",
    eventDate: stringOrNull(row.event_at),
    venue: stringOrNull(row.venue_name) ?? "Venue not set",
    location:
      [row.city, row.region].filter(Boolean).join(", ") || "Location not set",
    services: (row.project_services ?? []).map((link) => ({
      name: String(one(link.services)?.name ?? "Unknown"),
      origin: String(link.source_origin ?? "manual"),
      originalValue: stringOrNull(link.original_value),
    })),
    estimatedCents: Number(row.estimated_value_cents ?? 0),
    proposalCents: Number(
      row.proposal_value_cents ?? proposal?.amount_cents ?? 0,
    ),
    bookedCents,
    collectedCents,
    outstandingCents: Math.max(0, bookedCents - collectedCents),
    lastContactAt: stringOrNull(row.last_communication_at),
    lastContactChannel: stringOrNull(row.last_communication_channel),
    nextFollowUpAt: stringOrNull(row.next_follow_up_at),
    temperature: stringOrNull(row.lead_temperature),
    proposalStatus: stringOrNull(proposal?.status) ?? "Not sent",
    proposalSentAt: stringOrNull(proposal?.sent_at),
    firstViewedAt: views[0] ?? null,
    latestViewedAt: views.at(-1) ?? null,
    attribution: String(attributionLabel || "Unattributed"),
    honeybookUrl: stringOrNull(row.honeybook_url),
    createdAt: String(row.created_at),
  };
}

const projectSelect =
  "id,name,event_type,event_at,venue_name,city,region,lead_source,source_origin,raw_provider_fields,estimated_value_cents,proposal_value_cents,booked_value_cents,collected_cents,last_communication_at,last_communication_channel,next_follow_up_at,lead_temperature,honeybook_url,created_at,contacts(first_name,last_name,email_normalized,phone_e164),pipeline_stages(key,name),users(display_name),project_services(source_origin,original_value,services(name)),proposals(status,amount_cents,sent_at,signed_at,proposal_views(viewed_at)),lead_attribution(touch_type,gclid,utm_source,utm_campaign,landing_page)";

export async function loadPipelineProjects() {
  const context = await organizationContext();
  if (!context) return [];
  const { data, error } = await context.supabase
    .from("projects")
    .select(projectSelect)
    .eq("organization_id", context.organizationId)
    .eq("source_origin", "honeybook")
    .order("created_at", { ascending: false });
  if (error) throw new Error("The live pipeline could not be loaded");
  return ((data ?? []) as unknown as ProjectRow[]).map(mapProject);
}

export async function loadProjectDetail(id: string) {
  const context = await organizationContext();
  if (!context) return null;
  const [
    { data: project, error },
    { data: activities },
    { data: tasks },
    { data: invoices },
    { data: payments },
  ] = await Promise.all([
    context.supabase
      .from("projects")
      .select(projectSelect)
      .eq("organization_id", context.organizationId)
      .eq("id", id)
      .maybeSingle(),
    context.supabase
      .from("activity_events")
      .select("id,event_type,title,detail,source_origin,occurred_at")
      .eq("organization_id", context.organizationId)
      .eq("project_id", id)
      .order("occurred_at", { ascending: false }),
    context.supabase
      .from("tasks")
      .select("id,title,due_at,completed_at,priority,source_origin")
      .eq("organization_id", context.organizationId)
      .eq("project_id", id)
      .order("due_at"),
    context.supabase
      .from("invoices")
      .select("id,amount_cents,paid_cents,due_at,status,provider")
      .eq("organization_id", context.organizationId)
      .eq("project_id", id),
    context.supabase
      .from("payments")
      .select("id,amount_cents,paid_at,provider")
      .eq("organization_id", context.organizationId)
      .eq("project_id", id)
      .order("paid_at", { ascending: false }),
  ]);
  if (error || !project) return null;
  return {
    project: mapProject(project as unknown as ProjectRow),
    activities: activities ?? [],
    tasks: tasks ?? [],
    invoices: invoices ?? [],
    payments: payments ?? [],
  };
}

export async function loadCommandCenter() {
  const context = await organizationContext();
  if (!context) return null;
  const now = new Date();
  const timeZone = "America/Chicago";
  const todayKey = dateKeyInTimeZone(now, timeZone);
  const monthStartKey = `${todayKey.slice(0, 7)}-01`;
  const monthStart = startOfDateInTimeZone(monthStartKey, timeZone);
  const todayStart = startOfDateInTimeZone(todayKey, timeZone);
  const todayEnd = startOfDateInTimeZone(
    addDaysToDateKey(todayKey, 1),
    timeZone,
  );
  const [
    projects,
    { data: activities },
    { count: pendingMappings },
    { data: issues },
    { data: adMetrics },
    { data: searchMetrics },
    { data: connections },
  ] = await Promise.all([
    loadPipelineProjects(),
    context.supabase
      .from("activity_events")
      .select("id,title,detail,source_origin,occurred_at,project_id")
      .eq("organization_id", context.organizationId)
      .order("occurred_at", { ascending: false })
      .limit(8),
    context.supabase
      .from("mapping_queue")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", context.organizationId)
      .eq("status", "pending"),
    context.supabase
      .from("integration_health_issues")
      .select("provider,severity,title,last_detected_at")
      .eq("organization_id", context.organizationId)
      .is("resolved_at", null)
      .order("last_detected_at", { ascending: false })
      .limit(5),
    context.supabase
      .from("google_ads_daily_metrics")
      .select(
        "cost_cents,clicks,impressions,conversions,conversion_value_cents,date",
      )
      .eq("organization_id", context.organizationId)
      .gte("date", monthStart.slice(0, 10)),
    context.supabase
      .from("search_console_daily_metrics")
      .select("clicks,impressions,ctr,average_position,date")
      .eq("organization_id", context.organizationId)
      .gte("date", monthStart.slice(0, 10)),
    context.supabase
      .from("sync_connections")
      .select("provider,status,last_success_at")
      .eq("organization_id", context.organizationId),
  ]);
  const activeProjects = projects.filter(
    (project) => !["lost", "archived"].includes(project.stageKey ?? ""),
  );
  const needsResponse = activeProjects.filter(
    (project) => !project.lastContactAt,
  );
  const followUpsDue = activeProjects.filter(
    (project) =>
      project.nextFollowUpAt &&
      project.nextFollowUpAt >= todayStart &&
      project.nextFollowUpAt < todayEnd,
  );
  const overdue = activeProjects.filter(
    (project) => project.nextFollowUpAt && project.nextFollowUpAt < todayStart,
  );
  const attention = [...needsResponse, ...overdue, ...followUpsDue]
    .filter(
      (project, index, list) =>
        list.findIndex((item) => item.id === project.id) === index,
    )
    .slice(0, 8);
  const bookedThisMonth = projects.filter(
    (project) => project.bookedCents > 0 && project.createdAt >= monthStart,
  );
  const ads = (adMetrics ?? []).reduce(
    (sum, row) => ({
      spendCents: sum.spendCents + Number(row.cost_cents),
      clicks: sum.clicks + Number(row.clicks),
      conversions: sum.conversions + Number(row.conversions),
    }),
    { spendCents: 0, clicks: 0, conversions: 0 },
  );
  const search = (searchMetrics ?? []).reduce(
    (sum, row) => ({
      clicks: sum.clicks + Number(row.clicks),
      impressions: sum.impressions + Number(row.impressions),
      weightedPosition:
        sum.weightedPosition +
        Number(row.average_position) * Math.max(1, Number(row.impressions)),
    }),
    { clicks: 0, impressions: 0, weightedPosition: 0 },
  );
  return {
    range: {
      start: monthStartKey,
      end: todayKey,
    },
    projects,
    attention,
    activities: activities ?? [],
    issues: issues ?? [],
    connections: connections ?? [],
    pendingMappings: pendingMappings ?? 0,
    metrics: {
      newLeads: projects.filter((project) => project.createdAt >= monthStart)
        .length,
      needsResponse: needsResponse.length,
      followUpsDue: followUpsDue.length,
      overdue: overdue.length,
      proposalsSent: projects.filter(
        (project) =>
          project.proposalSentAt && project.proposalSentAt >= monthStart,
      ).length,
      proposalsViewed: projects.filter(
        (project) =>
          project.firstViewedAt && project.firstViewedAt >= monthStart,
      ).length,
      bookings: bookedThisMonth.length,
      bookedCents: bookedThisMonth.reduce(
        (sum, project) => sum + project.bookedCents,
        0,
      ),
      collectedCents: projects.reduce(
        (sum, project) => sum + project.collectedCents,
        0,
      ),
      outstandingCents: projects.reduce(
        (sum, project) => sum + project.outstandingCents,
        0,
      ),
      upcomingEvents: activeProjects.filter(
        (project) => project.eventDate && project.eventDate >= todayStart,
      ).length,
      adSpendCents: ads.spendCents,
      cplCents: projects.length
        ? Math.round(
            ads.spendCents /
              Math.max(
                1,
                projects.filter((project) => project.createdAt >= monthStart)
                  .length,
              ),
          )
        : 0,
      organicClicks: search.clicks,
      organicImpressions: search.impressions,
      averagePosition: search.impressions
        ? search.weightedPosition / search.impressions
        : 0,
    },
  };
}

export async function loadShellState() {
  const context = await organizationContext();
  if (!context) return { pipelineCount: 0, mappingCount: 0, healthWarnings: 0 };
  const [
    { count: pipelineCount },
    { count: mappingCount },
    { count: healthWarnings },
  ] = await Promise.all([
    context.supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", context.organizationId),
    context.supabase
      .from("mapping_queue")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", context.organizationId)
      .eq("status", "pending"),
    context.supabase
      .from("integration_health_issues")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", context.organizationId)
      .is("resolved_at", null),
  ]);
  return {
    pipelineCount: pipelineCount ?? 0,
    mappingCount: mappingCount ?? 0,
    healthWarnings: healthWarnings ?? 0,
  };
}
