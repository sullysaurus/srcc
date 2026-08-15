import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Network,
  Search,
  Sparkles,
} from "lucide-react";
import { ReportingDateRange } from "@/components/command-center/reporting-date-range";
import { loadSearchSummary } from "@/lib/dashboard-data";
import {
  formatReadableDate,
  percentChange,
  resolveReportingRange,
  type ReportingRangeParams,
} from "@/lib/domain/reporting-date-range";

function formatSyncTime(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).format(new Date(value));
}

function Metric({
  label,
  value,
  current,
  previous,
  ready,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  ready: boolean;
}) {
  const change = percentChange(current, previous);
  const up = (change ?? 0) >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="paper rounded-xl border p-4">
      <p className="font-mono text-[8px] font-bold tracking-[.12em] text-ink/40 uppercase">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl tracking-[-.03em]">
        {ready ? value : "—"}
      </p>
      <p className={`mt-2 text-[9px] ${up ? "text-moss" : "text-[#a44236]"}`}>
        {!ready ? (
          <span className="text-ink/38">Waiting for Google data</span>
        ) : change === null ? (
          <span className="text-ink/38">New in this period</span>
        ) : (
          <>
            <Icon className="mr-0.5 inline size-3" />
            {Math.abs(change * 100).toFixed(0)}% vs prior
          </>
        )}
      </p>
    </div>
  );
}

export default async function SeoPage({
  searchParams,
}: {
  searchParams: Promise<ReportingRangeParams>;
}) {
  const range = resolveReportingRange(await searchParams, { lagDays: 3 });
  const live = await loadSearchSummary(range);
  const clicks = live?.clicks ?? 0;
  const impressions = live?.impressions ?? 0;
  const ctr = live?.ctr ?? 0;
  const position = live?.position ?? 0;
  const previous = live?.previous ?? {
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
  };
  const ready = live?.dataState === "ready";
  const connected = live?.connection?.status === "connected";
  const propertyUri =
    live?.property?.property_uri ?? "sc-domain:southernrevelrytx.com";
  const gscUrl = `https://search.google.com/search-console?resource_id=${encodeURIComponent(propertyUri)}`;
  const opportunityQueries = (live?.queries ?? []).filter(
    (row) => row.position >= 4 && row.position <= 20,
  );
  const maxDailyImpressions = Math.max(
    1,
    ...(live?.daily ?? []).map((day) => day.impressions),
  );

  return (
    <div className="pb-20 lg:pb-0">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="font-mono text-[9px] font-bold tracking-[.15em] text-coral uppercase">
            Search Console / Organic demand desk
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-[-.04em] sm:text-5xl">
            Turn search visibility into a worklist.
          </h1>
          <p className="mt-3 text-sm text-ink/52">
            Track demand, pages within striking distance, and indexing health
            without pretending organic queries identify individual leads.
          </p>
        </div>
        <a
          href={gscUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-2 rounded-lg border bg-cream px-3 py-2 text-[10px] font-bold"
        >
          Open Search Console <ExternalLink className="size-3.5" />
        </a>
      </div>

      <ReportingDateRange
        action="/seo"
        range={range}
        lagLabel="Search Console allows a 2–3 day processing lag"
      />

      {live?.dataState === "processing" ? (
        <section className="mt-4 overflow-hidden rounded-2xl border border-turquoise/35 bg-[#e9f7f4]">
          <div className="grid gap-4 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
            <span className="grid size-11 place-items-center rounded-full bg-turquoise/25 text-[#285e59]">
              <Sparkles className="size-5" />
            </span>
            <div>
              <p className="font-display text-2xl">
                Connected. Google is processing the property.
              </p>
              <p className="mt-1 text-[10px] leading-5 text-ink/55">
                The sync is healthy, but Google currently returns zero
                performance rows. Metrics will appear automatically after Search
                Console finishes processing impressions and clicks.
              </p>
            </div>
            <span className="w-fit rounded-full border border-turquoise/35 bg-white/45 px-3 py-2 font-mono text-[8px] font-bold text-[#285e59] uppercase">
              Not an app error
            </span>
          </div>
        </section>
      ) : null}

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Clicks"
          value={clicks.toLocaleString()}
          current={clicks}
          previous={previous.clicks}
          ready={ready}
        />
        <Metric
          label="Impressions"
          value={impressions.toLocaleString()}
          current={impressions}
          previous={previous.impressions}
          ready={ready}
        />
        <Metric
          label="CTR"
          value={`${(ctr * 100).toFixed(2)}%`}
          current={ctr}
          previous={previous.ctr}
          ready={ready}
        />
        <Metric
          label="Average position"
          value={position.toFixed(1)}
          current={position}
          previous={previous.position}
          ready={ready}
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <section className="paper overflow-hidden rounded-xl border xl:col-span-8">
          <div className="flex items-center justify-between border-b p-5">
            <div>
              <h2 className="font-display text-2xl">Queries within reach</h2>
              <p className="mt-1 text-[10px] text-ink/45">
                High-impression terms ranking in positions 4–20.
              </p>
            </div>
            <Search className="size-5 text-turquoise" />
          </div>
          {opportunityQueries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left">
                <thead className="bg-ink/[.035] font-mono text-[8px] tracking-[.11em] text-ink/44 uppercase">
                  <tr>
                    <th className="px-5 py-3">Query</th>
                    <th className="px-3 py-3">Clicks</th>
                    <th className="px-3 py-3">Impressions</th>
                    <th className="px-3 py-3">CTR</th>
                    <th className="px-5 py-3 text-right">Position</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {opportunityQueries.map((row) => (
                    <tr
                      key={row.query}
                      className="transition hover:bg-white/45"
                    >
                      <td className="px-5 py-4 text-xs font-bold">
                        {row.query}
                      </td>
                      <td className="px-3 py-4 font-mono text-xs">
                        {row.clicks}
                      </td>
                      <td className="px-3 py-4 font-mono text-xs">
                        {row.impressions}
                      </td>
                      <td className="px-3 py-4 font-mono text-xs">
                        {(row.ctr * 100).toFixed(1)}%
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-xs font-bold">
                        {row.position.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid min-h-64 place-items-center p-8 text-center">
              <div className="max-w-sm">
                <FileSearch className="mx-auto size-7 text-ink/25" />
                <p className="mt-3 text-sm font-bold">
                  No query opportunities yet
                </p>
                <p className="mt-2 text-[10px] leading-5 text-ink/48">
                  Google has not released performance rows for this property.
                  This table will populate automatically when processing
                  completes.
                </p>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-5 xl:col-span-4">
          <section className="paper rounded-xl border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[8px] font-bold tracking-[.12em] text-ink/40 uppercase">
                  Visibility trend
                </p>
                <h2 className="mt-1 font-display text-2xl">
                  Daily impressions
                </h2>
              </div>
              <ArrowUpRight className="size-5 text-coral" />
            </div>
            {live?.daily.length ? (
              <>
                <div
                  className="mt-5 flex h-28 items-end gap-1"
                  aria-label="Daily organic impressions chart"
                >
                  {live.daily.map((day) => (
                    <div
                      key={day.date}
                      className="group flex h-full min-w-0 flex-1 items-end"
                      title={`${day.date}: ${day.impressions} impressions, ${day.clicks} clicks`}
                    >
                      <span
                        className="w-full rounded-t-sm bg-marigold/80 transition group-hover:bg-coral"
                        style={{
                          height: `${Math.max(4, (day.impressions / maxDailyImpressions) * 100)}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between font-mono text-[8px] text-ink/35">
                  <span>
                    {live.daily[0]?.date
                      ? formatReadableDate(live.daily[0].date, false)
                      : "—"}
                  </span>
                  <span>
                    {live.daily.at(-1)?.date
                      ? formatReadableDate(live.daily.at(-1)!.date, false)
                      : "—"}
                  </span>
                </div>
              </>
            ) : (
              <div className="mt-5 grid h-28 place-items-center rounded-lg border border-dashed bg-ink/[.02] text-[10px] text-ink/38">
                Awaiting performance data
              </div>
            )}
          </section>

          <section className="rounded-xl border border-moss/25 bg-[#edf6e9] p-5">
            <div className="flex items-start gap-3">
              {connected ? (
                <CheckCircle2 className="size-5 shrink-0 text-moss" />
              ) : (
                <AlertCircle className="size-5 shrink-0 text-coral" />
              )}
              <div>
                <p className="text-xs font-bold">
                  {connected
                    ? "Search Console connected"
                    : "Search Console needs attention"}
                </p>
                <p className="mt-1 text-[9px] leading-4 text-ink/48">
                  {propertyUri} ·{" "}
                  {live?.property?.permission_level ?? "permission pending"}
                </p>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 border-t border-moss/15 pt-4 text-[10px]">
              <div className="flex justify-between gap-4">
                <dt className="text-ink/45">Last successful sync</dt>
                <dd className="text-right font-bold">
                  {formatSyncTime(live?.connection?.last_success_at)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink/45">Latest run</dt>
                <dd className="text-right font-bold capitalize">
                  {live?.latestRun?.status ?? "None"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink/45">Rows processed</dt>
                <dd className="text-right font-bold">
                  {live?.latestRun?.processed_count ?? 0}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <section className="paper mt-5 overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="font-display text-2xl">
              Indexing and sitemap health
            </h2>
            <p className="mt-1 text-[10px] text-ink/45">
              Submission, download recency, warnings, and discovered URLs.
            </p>
          </div>
          <Network className="size-5 text-coral" />
        </div>
        <div className="grid gap-px bg-ink/10 md:grid-cols-2">
          {(live?.sitemaps ?? []).length ? (
            live?.sitemaps.map((sitemap) => {
              const healthy =
                Number(sitemap.errors) === 0 && Number(sitemap.warnings) === 0;
              return (
                <div key={sitemap.path} className="bg-cream p-5">
                  <div className="flex items-start gap-3">
                    {healthy ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-moss" />
                    ) : (
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-coral" />
                    )}
                    <div className="min-w-0">
                      <p className="break-all text-xs font-bold">
                        {sitemap.path}
                      </p>
                      <p className="mt-2 font-mono text-[8px] text-ink/40 uppercase">
                        Last read {formatSyncTime(sitemap.last_downloaded_at)}
                      </p>
                      <p className="mt-2 text-[9px] text-ink/48">
                        {sitemap.warnings ?? 0} warnings · {sitemap.errors ?? 0}{" "}
                        errors
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-cream p-5 text-[10px] text-ink/48 md:col-span-2">
              No sitemap records have synchronized yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
