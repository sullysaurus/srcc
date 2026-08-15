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

type ReportingWindow = {
  from: string;
  to: string;
  compareFrom: string;
  compareTo: string;
};

type AdMetricRow = {
  entity_provider_id: string;
  impressions: number | string;
  clicks: number | string;
  cost_cents: number | string;
  conversions: number | string;
  conversion_value_cents: number | string;
  impression_share: number | string | null;
  date: string;
};

function summarizeAdRows(rows: AdMetricRow[]) {
  return rows.reduce(
    (sum, row) => ({
      impressions: sum.impressions + Number(row.impressions),
      clicks: sum.clicks + Number(row.clicks),
      spendCents: sum.spendCents + Number(row.cost_cents),
      reportedConversions: sum.reportedConversions + Number(row.conversions),
      reportedValueCents:
        sum.reportedValueCents + Number(row.conversion_value_cents),
    }),
    {
      impressions: 0,
      clicks: 0,
      spendCents: 0,
      reportedConversions: 0,
      reportedValueCents: 0,
    },
  );
}

export async function loadAdsSummary(range: ReportingWindow) {
  const context = await organizationContext();
  if (!context) return null;
  const [
    { data: metrics },
    { data: campaigns },
    { data: projects },
    { data: issues },
  ] = await Promise.all([
    context.supabase
      .from("google_ads_daily_metrics")
      .select(
        "entity_provider_id,impressions,clicks,cost_cents,conversions,conversion_value_cents,impression_share,date",
      )
      .eq("organization_id", context.organizationId)
      .eq("entity_type", "campaign")
      .gte("date", range.compareFrom)
      .lte("date", range.to),
    context.supabase
      .from("google_ads_campaigns")
      .select("provider_id,name,budget_cents,status")
      .eq("organization_id", context.organizationId),
    context.supabase
      .from("projects")
      .select(
        "id,created_at,booked_value_cents,collected_cents,lead_source,lead_attribution(gclid,gbraid,wbraid,utm_source,utm_medium,occurred_at)",
      )
      .eq("organization_id", context.organizationId)
      .gte("created_at", `${range.compareFrom}T00:00:00Z`)
      .lte("created_at", `${range.to}T23:59:59.999Z`),
    context.supabase
      .from("integration_health_issues")
      .select("issue_key,severity,title,detail")
      .eq("organization_id", context.organizationId)
      .eq("provider", "google_ads")
      .is("resolved_at", null)
      .limit(500),
  ]);
  const allMetrics = (metrics ?? []) as unknown as AdMetricRow[];
  const currentMetrics = allMetrics.filter(
    (row) => row.date >= range.from && row.date <= range.to,
  );
  const previousMetrics = allMetrics.filter(
    (row) => row.date >= range.compareFrom && row.date <= range.compareTo,
  );
  const campaignMap = new Map(
    (campaigns ?? []).map((campaign) => [campaign.provider_id, campaign]),
  );
  const grouped = new Map<
    string,
    {
      name: string;
      spendCents: number;
      impressions: number;
      clicks: number;
      reportedConversions: number;
      reportedValueCents: number;
      weightedImpressionShare: number;
      status: string;
    }
  >();
  for (const metric of currentMetrics) {
    const id = metric.entity_provider_id;
    const current = grouped.get(id) ?? {
      name: campaignMap.get(id)?.name ?? id,
      spendCents: 0,
      impressions: 0,
      clicks: 0,
      reportedConversions: 0,
      reportedValueCents: 0,
      weightedImpressionShare: 0,
      status: campaignMap.get(id)?.status ?? "UNKNOWN",
    };
    current.spendCents += Number(metric.cost_cents);
    current.impressions += Number(metric.impressions);
    current.clicks += Number(metric.clicks);
    current.reportedConversions += Number(metric.conversions);
    current.reportedValueCents += Number(metric.conversion_value_cents);
    current.weightedImpressionShare +=
      Number(metric.impression_share ?? 0) * Number(metric.impressions);
    grouped.set(id, current);
  }
  const totals = summarizeAdRows(currentMetrics);
  const previous = summarizeAdRows(previousMetrics);
  const projectRows = (projects ?? []) as Array<{
    created_at: string;
    booked_value_cents: number | string;
    collected_cents: number | string;
    lead_source: string | null;
    lead_attribution?: Array<{
      gclid?: string | null;
      gbraid?: string | null;
      wbraid?: string | null;
      utm_source?: string | null;
      utm_medium?: string | null;
    }>;
  }>;
  const googleProjects = projectRows.filter((project) => {
    const touches = project.lead_attribution ?? [];
    return (
      String(project.lead_source ?? "")
        .toLowerCase()
        .includes("google") ||
      touches.some(
        (touch) =>
          Boolean(touch.gclid || touch.gbraid || touch.wbraid) ||
          String(touch.utm_source ?? "")
            .toLowerCase()
            .includes("google"),
      )
    );
  });
  const projectPeriod = (from: string, to: string) => {
    const rows = googleProjects.filter((project) => {
      const date = project.created_at.slice(0, 10);
      return date >= from && date <= to;
    });
    const matched = rows.filter((project) =>
      (project.lead_attribution ?? []).some((touch) =>
        Boolean(touch.gclid || touch.gbraid || touch.wbraid),
      ),
    );
    return {
      selfReportedGoogleLeads: rows.length,
      matchedLeads: matched.length,
      unmatchedLeads: rows.length - matched.length,
      bookings: matched.filter(
        (project) => Number(project.booked_value_cents) > 0,
      ).length,
      bookedRevenueCents: matched.reduce(
        (sum, project) => sum + Number(project.booked_value_cents),
        0,
      ),
      collectedRevenueCents: matched.reduce(
        (sum, project) => sum + Number(project.collected_cents),
        0,
      ),
    };
  };
  const crm = projectPeriod(range.from, range.to);
  const previousCrm = projectPeriod(range.compareFrom, range.compareTo);
  const issueGroups = new Map<
    string,
    { severity: string; title: string; detail: string | null; count: number }
  >();
  for (const issue of issues ?? []) {
    const current = issueGroups.get(issue.issue_key) ?? {
      severity: issue.severity,
      title: issue.title,
      detail: issue.detail,
      count: 0,
    };
    current.count += 1;
    issueGroups.set(issue.issue_key, current);
  }
  const daily = new Map<
    string,
    { date: string; spendCents: number; clicks: number; conversions: number }
  >();
  for (const row of currentMetrics) {
    const day = daily.get(row.date) ?? {
      date: row.date,
      spendCents: 0,
      clicks: 0,
      conversions: 0,
    };
    day.spendCents += Number(row.cost_cents);
    day.clicks += Number(row.clicks);
    day.conversions += Number(row.conversions);
    daily.set(row.date, day);
  }
  return {
    ...range,
    ...totals,
    ...crm,
    previous: { ...previous, ...previousCrm },
    comparisonAvailable:
      new Set(previousMetrics.map((row) => row.date)).size >= 3,
    campaigns: [...grouped.values()]
      .map((row) => {
        const ctr = row.impressions ? row.clicks / row.impressions : 0;
        const costPerConversionCents = row.reportedConversions
          ? row.spendCents / row.reportedConversions
          : null;
        let recommendation = "Monitor";
        if (row.spendCents > 0 && !row.reportedConversions)
          recommendation = "Fix tracking";
        else if (row.reportedConversions >= 5 && ctr >= 0.04)
          recommendation = "Scale candidate";
        else if (row.clicks >= 20 && ctr < 0.03) recommendation = "Watch";
        return {
          ...row,
          ctr,
          cpcCents: row.clicks ? row.spendCents / row.clicks : 0,
          costPerConversionCents,
          impressionShare: row.impressions
            ? row.weightedImpressionShare / row.impressions
            : null,
          recommendation,
        };
      })
      .sort((a, b) => b.spendCents - a.spendCents),
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    trackingIssues: [...issueGroups.values()].sort((a, b) =>
      a.severity === b.severity
        ? b.count - a.count
        : a.severity === "critical"
          ? -1
          : 1,
    ),
  };
}

type SearchMetricRow = {
  query: string;
  page: string;
  clicks: number | string;
  impressions: number | string;
  average_position: number | string;
  date: string;
};

function summarizeSearchRows(data: SearchMetricRow[]) {
  const totals = data.reduce(
    (sum, row) => ({
      clicks: sum.clicks + Number(row.clicks),
      impressions: sum.impressions + Number(row.impressions),
      weightedPosition:
        sum.weightedPosition +
        Number(row.average_position) * Number(row.impressions),
    }),
    { clicks: 0, impressions: 0, weightedPosition: 0 },
  );
  return {
    ...totals,
    ctr: totals.impressions ? totals.clicks / totals.impressions : 0,
    position: totals.impressions
      ? totals.weightedPosition / totals.impressions
      : 0,
  };
}

export async function loadSearchSummary(range: ReportingWindow) {
  const context = await organizationContext();
  if (!context) return null;
  const [
    { data },
    { data: connection },
    { data: property },
    { data: sitemaps },
    { data: latestRun },
  ] = await Promise.all([
    context.supabase
      .from("search_console_daily_metrics")
      .select("query,page,clicks,impressions,average_position,date")
      .eq("organization_id", context.organizationId)
      .eq("search_appearance", "")
      .gte("date", range.compareFrom)
      .lte("date", range.to),
    context.supabase
      .from("sync_connections")
      .select("status,last_attempt_at,last_success_at,configuration")
      .eq("organization_id", context.organizationId)
      .eq("provider", "search_console")
      .maybeSingle(),
    context.supabase
      .from("search_console_properties")
      .select("property_uri,permission_level,last_success_at")
      .eq("organization_id", context.organizationId)
      .maybeSingle(),
    context.supabase
      .from("search_console_sitemaps")
      .select("path,status,submitted_at,last_downloaded_at,warnings,errors")
      .eq("organization_id", context.organizationId)
      .order("submitted_at", { ascending: false }),
    context.supabase
      .from("sync_runs")
      .select("status,processed_count,error_summary,completed_at,created_at")
      .eq("organization_id", context.organizationId)
      .eq("provider", "search_console")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const allRows = (data ?? []) as unknown as SearchMetricRow[];
  const currentRows = allRows.filter(
    (row) => row.date >= range.from && row.date <= range.to,
  );
  const previousRows = allRows.filter(
    (row) => row.date >= range.compareFrom && row.date <= range.compareTo,
  );
  const grouped = new Map<
    string,
    {
      query: string;
      clicks: number;
      impressions: number;
      weightedPosition: number;
    }
  >();
  for (const row of currentRows) {
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
  const pages = new Map<
    string,
    {
      page: string;
      clicks: number;
      impressions: number;
      weightedPosition: number;
    }
  >();
  const daily = new Map<
    string,
    { date: string; clicks: number; impressions: number }
  >();
  for (const row of currentRows) {
    if (row.page) {
      const page = pages.get(row.page) ?? {
        page: row.page,
        clicks: 0,
        impressions: 0,
        weightedPosition: 0,
      };
      page.clicks += Number(row.clicks);
      page.impressions += Number(row.impressions);
      page.weightedPosition +=
        Number(row.average_position) * Number(row.impressions);
      pages.set(row.page, page);
    }
    const day = daily.get(row.date) ?? {
      date: row.date,
      clicks: 0,
      impressions: 0,
    };
    day.clicks += Number(row.clicks);
    day.impressions += Number(row.impressions);
    daily.set(row.date, day);
  }
  const totals = summarizeSearchRows(currentRows);
  const previous = summarizeSearchRows(previousRows);
  return {
    ...range,
    clicks: totals.clicks,
    impressions: totals.impressions,
    ctr: totals.ctr,
    position: totals.position,
    previous,
    queries: queries.slice(0, 20),
    pages: [...pages.values()]
      .map((row) => ({
        ...row,
        ctr: row.impressions ? row.clicks / row.impressions : 0,
        position: row.impressions ? row.weightedPosition / row.impressions : 0,
      }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10),
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    connection: connection ?? null,
    property: property ?? null,
    sitemaps: sitemaps ?? [],
    latestRun: latestRun ?? null,
    dataState:
      connection?.status === "connected" && !currentRows.length
        ? "processing"
        : currentRows.length
          ? "ready"
          : (connection?.status ?? "not_configured"),
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
      .eq("search_appearance", "")
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
      .eq("entity_type", "campaign")
      .gte("date", monthStart.slice(0, 10)),
    context.supabase
      .from("search_console_daily_metrics")
      .select("clicks,impressions,ctr,average_position,date")
      .eq("organization_id", context.organizationId)
      .eq("search_appearance", "")
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
    { data: healthIssues },
  ] = await Promise.all([
    context.supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", context.organizationId)
      .eq("source_origin", "honeybook"),
    context.supabase
      .from("mapping_queue")
      .select("id,source_records!inner(source_type)", {
        count: "exact",
        head: true,
      })
      .eq("organization_id", context.organizationId)
      .eq("status", "pending")
      .neq("source_records.source_type", "google_sheet"),
    context.supabase
      .from("integration_health_issues")
      .select("provider,issue_key")
      .eq("organization_id", context.organizationId)
      .is("resolved_at", null),
  ]);
  return {
    pipelineCount: pipelineCount ?? 0,
    mappingCount: mappingCount ?? 0,
    healthWarnings: new Set(
      (healthIssues ?? []).map(
        (issue) => `${issue.provider}:${issue.issue_key}`,
      ),
    ).size,
  };
}
