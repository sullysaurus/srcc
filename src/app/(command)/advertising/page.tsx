import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  CheckCircle2,
  CircleDollarSign,
  Target,
} from "lucide-react";
import { ReportingDateRange } from "@/components/command-center/reporting-date-range";
import { loadAdsSummary } from "@/lib/dashboard-data";
import { formatCents } from "@/lib/domain/money";
import {
  formatReadableDate,
  percentChange,
  resolveReportingRange,
  type ReportingRangeParams,
} from "@/lib/domain/reporting-date-range";

function Delta({
  current,
  previous,
  available = true,
}: {
  current: number;
  previous: number;
  available?: boolean;
}) {
  if (!available)
    return <span className="text-ink/38">Prior period unavailable</span>;
  const change = percentChange(current, previous);
  if (change === null)
    return <span className="text-ink/38">New in this period</span>;
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={up ? "text-moss" : "text-[#a44236]"}>
      <Icon className="mr-0.5 inline size-3" aria-hidden="true" />
      {Math.abs(change * 100).toFixed(0)}% vs prior
    </span>
  );
}

function MetricCard({
  label,
  value,
  current,
  previous,
  detail,
  comparisonAvailable,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  detail: string;
  comparisonAvailable: boolean;
}) {
  return (
    <div className="paper rounded-xl border p-4">
      <p className="font-mono text-[8px] font-bold tracking-[.12em] text-ink/40 uppercase">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl tracking-[-.03em]">{value}</p>
      <p className="mt-1 text-[9px]">
        <Delta
          current={current}
          previous={previous}
          available={comparisonAvailable}
        />
      </p>
      <p className="mt-3 text-[9px] leading-4 text-ink/42">{detail}</p>
    </div>
  );
}

export default async function AdvertisingPage({
  searchParams,
}: {
  searchParams: Promise<ReportingRangeParams>;
}) {
  const range = resolveReportingRange(await searchParams, { lagDays: 1 });
  const live = await loadAdsSummary(range);
  const clicks = live?.clicks ?? 0;
  const impressions = live?.impressions ?? 0;
  const spendCents = live?.spendCents ?? 0;
  const reportedConversions = live?.reportedConversions ?? 0;
  const reportedValueCents = live?.reportedValueCents ?? 0;
  const matchedLeads = live?.matchedLeads ?? 0;
  const bookings = live?.bookings ?? 0;
  const bookedRevenueCents = live?.bookedRevenueCents ?? 0;
  const collectedRevenueCents = live?.collectedRevenueCents ?? 0;
  const previous = live?.previous ?? {
    clicks: 0,
    impressions: 0,
    spendCents: 0,
    reportedConversions: 0,
    reportedValueCents: 0,
    matchedLeads: 0,
    bookings: 0,
    bookedRevenueCents: 0,
    collectedRevenueCents: 0,
  };
  const comparisonAvailable = live?.comparisonAvailable ?? false;
  const ctr = impressions ? clicks / impressions : 0;
  const cpcCents = clicks ? spendCents / clicks : 0;
  const previousCpcCents = previous.clicks
    ? previous.spendCents / previous.clicks
    : 0;
  const costPerReportedLeadCents = reportedConversions
    ? spendCents / reportedConversions
    : 0;
  const previousCostPerReportedLeadCents = previous.reportedConversions
    ? previous.spendCents / previous.reportedConversions
    : 0;
  const closedLoopRoas = spendCents ? bookedRevenueCents / spendCents : 0;
  const previousRoas = previous.spendCents
    ? previous.bookedRevenueCents / previous.spendCents
    : 0;
  const maxDailySpend = Math.max(
    1,
    ...(live?.daily ?? []).map((day) => day.spendCents),
  );
  const trackingBroken =
    reportedConversions > 0 && reportedValueCents <= reportedConversions * 100;

  return (
    <div className="pb-20 lg:pb-0">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="font-mono text-[9px] font-bold tracking-[.15em] text-coral uppercase">
            Google Ads / Read-only decision desk
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-[-.04em] sm:text-5xl">
            Know what to scale—and what to fix.
          </h1>
          <p className="mt-3 text-sm text-ink/52">
            Provider activity and proven CRM outcomes stay separate. Revenue is
            counted only for leads with a captured Google click identifier in
            the same reporting window.
          </p>
        </div>
        <span className="w-fit rounded-full border border-moss/20 bg-moss/8 px-3 py-2 font-mono text-[9px] font-bold text-moss uppercase">
          Read only · uploads disabled
        </span>
      </div>

      <ReportingDateRange
        action="/advertising"
        range={range}
        lagLabel="Google Ads through yesterday"
      />

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Spend"
          value={formatCents(spendCents)}
          current={spendCents}
          previous={previous.spendCents}
          detail="Google Ads billed cost"
          comparisonAvailable={comparisonAvailable}
        />
        <MetricCard
          label="Clicks"
          value={clicks.toLocaleString()}
          current={clicks}
          previous={previous.clicks}
          detail={`${impressions.toLocaleString()} impressions · ${(ctr * 100).toFixed(1)}% CTR`}
          comparisonAvailable={comparisonAvailable}
        />
        <MetricCard
          label="Average CPC"
          value={formatCents(cpcCents)}
          current={cpcCents}
          previous={previousCpcCents}
          detail="Spend divided by provider clicks"
          comparisonAvailable={comparisonAvailable}
        />
        <MetricCard
          label="Reported cost / lead"
          value={
            reportedConversions ? formatCents(costPerReportedLeadCents) : "—"
          }
          current={costPerReportedLeadCents}
          previous={previousCostPerReportedLeadCents}
          detail={`${reportedConversions.toLocaleString()} Google-reported conversions`}
          comparisonAvailable={comparisonAvailable}
        />
      </section>

      <section className="mt-4 overflow-hidden rounded-2xl border bg-void text-white shadow-[0_18px_50px_rgba(23,25,21,.12)]">
        <div className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-5">
          {[
            [
              "Matched CRM leads",
              matchedLeads.toLocaleString(),
              "Captured click ID",
            ],
            ["Bookings", bookings.toLocaleString(), "Matched + booked"],
            [
              "Booked revenue",
              formatCents(bookedRevenueCents),
              "Matched cohort",
            ],
            ["Collected", formatCents(collectedRevenueCents), "Cash received"],
            [
              "Closed-loop ROAS",
              `${closedLoopRoas.toFixed(1)}×`,
              "Matched booked ÷ spend",
            ],
          ].map(([label, value, note]) => (
            <div key={label} className="bg-void p-5">
              <p className="font-mono text-[8px] tracking-[.12em] text-white/42 uppercase">
                {label}
              </p>
              <p className="mt-2 font-display text-3xl text-marigold">
                {value}
              </p>
              <p className="mt-2 text-[9px] text-white/42">{note}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 text-[10px] text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {live?.selfReportedGoogleLeads ?? 0} leads mentioned Google; only{" "}
            {matchedLeads} had a deterministic click match.
          </span>
          <Delta
            current={closedLoopRoas}
            previous={previousRoas}
            available={comparisonAvailable}
          />
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <section className="paper overflow-hidden rounded-xl border xl:col-span-8">
          <div className="flex items-start justify-between gap-4 border-b p-5">
            <div>
              <h2 className="font-display text-2xl">Campaign decision table</h2>
              <p className="mt-1 text-[10px] text-ink/45">
                Recommendations use provider performance only; CRM revenue is
                not assigned to a campaign without a proven mapping.
              </p>
            </div>
            <Target className="size-5 shrink-0 text-coral" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left">
              <thead className="bg-ink/[.035] font-mono text-[8px] tracking-[.1em] text-ink/44 uppercase">
                <tr>
                  <th className="px-5 py-3">Campaign</th>
                  <th className="px-3 py-3">Spend</th>
                  <th className="px-3 py-3">Impr.</th>
                  <th className="px-3 py-3">Clicks</th>
                  <th className="px-3 py-3">CTR</th>
                  <th className="px-3 py-3">CPC</th>
                  <th className="px-3 py-3">Conv.</th>
                  <th className="px-3 py-3">Cost / conv.</th>
                  <th className="px-5 py-3 text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(live?.campaigns ?? []).map((row) => (
                  <tr key={row.name} className="transition hover:bg-white/45">
                    <td className="px-5 py-4">
                      <p className="text-xs font-bold">{row.name}</p>
                      <p className="mt-1 font-mono text-[8px] text-ink/35 uppercase">
                        {row.status}
                      </p>
                    </td>
                    <td className="px-3 py-4 font-mono text-xs">
                      {formatCents(row.spendCents)}
                    </td>
                    <td className="px-3 py-4 font-mono text-xs">
                      {row.impressions.toLocaleString()}
                    </td>
                    <td className="px-3 py-4 font-mono text-xs">
                      {row.clicks.toLocaleString()}
                    </td>
                    <td className="px-3 py-4 font-mono text-xs">
                      {(row.ctr * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-4 font-mono text-xs">
                      {formatCents(row.cpcCents)}
                    </td>
                    <td className="px-3 py-4 font-mono text-xs">
                      {row.reportedConversions}
                    </td>
                    <td className="px-3 py-4 font-mono text-xs">
                      {row.costPerConversionCents === null
                        ? "—"
                        : formatCents(row.costPerConversionCents)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${row.recommendation === "Scale candidate" ? "border-moss/25 bg-moss/8 text-moss" : row.recommendation === "Fix tracking" ? "border-coral/30 bg-coral/8 text-[#9b4034]" : "bg-cream text-ink/55"}`}
                      >
                        {row.recommendation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-5 xl:col-span-4">
          <section className="paper rounded-xl border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[8px] font-bold tracking-[.12em] text-ink/40 uppercase">
                  Daily pace
                </p>
                <h2 className="mt-1 font-display text-2xl">Spend rhythm</h2>
              </div>
              <BadgeDollarSign className="size-5 text-turquoise" />
            </div>
            <div
              className="mt-5 flex h-36 items-end gap-1"
              aria-label="Daily ad spend chart"
            >
              {(live?.daily ?? []).map((day) => (
                <div
                  key={day.date}
                  className="group relative flex h-full min-w-0 flex-1 items-end"
                  title={`${day.date}: ${formatCents(day.spendCents)}, ${day.conversions} conversions`}
                >
                  <span
                    className="w-full rounded-t-sm bg-turquoise/75 transition group-hover:bg-coral"
                    style={{
                      height: `${Math.max(4, (day.spendCents / maxDailySpend) * 100)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[8px] text-ink/35">
              <span>
                {formatReadableDate(live?.daily[0]?.date ?? range.from, false)}
              </span>
              <span>
                {formatReadableDate(
                  live?.daily.at(-1)?.date ?? range.to,
                  false,
                )}
              </span>
            </div>
          </section>

          <section
            className={`rounded-xl border p-5 ${trackingBroken ? "border-[#d79f92] bg-coral/[.08]" : "border-moss/25 bg-moss/[.08]"}`}
          >
            {trackingBroken ? (
              <AlertTriangle className="size-5 text-[#a44236]" />
            ) : (
              <CheckCircle2 className="size-5 text-moss" />
            )}
            <h2 className="mt-3 font-display text-2xl">
              {trackingBroken
                ? "Conversion values need repair"
                : "Conversion values look usable"}
            </h2>
            <p className="mt-2 text-[10px] leading-5 text-ink/55">
              {trackingBroken
                ? `Google recorded ${reportedConversions} conversions but only ${formatCents(reportedValueCents)} in value. Provider ROAS is intentionally hidden until values are meaningful.`
                : `Google reported ${formatCents(reportedValueCents)} of conversion value for this period.`}
            </p>
          </section>

          {(live?.trackingIssues ?? []).slice(0, 4).map((issue) => (
            <section key={issue.title} className="paper rounded-xl border p-4">
              <div className="flex items-start gap-3">
                <CircleDollarSign className="mt-0.5 size-4 shrink-0 text-coral" />
                <div>
                  <p className="text-xs font-bold">{issue.title}</p>
                  <p className="mt-1 font-mono text-[8px] text-ink/35 uppercase">
                    {issue.count} affected · {issue.severity}
                  </p>
                  {issue.detail ? (
                    <p className="mt-2 text-[9px] leading-4 text-ink/50">
                      {issue.detail}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          ))}
        </aside>
      </div>
    </div>
  );
}
