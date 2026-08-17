import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Database,
  Search,
} from "lucide-react";
import Link from "next/link";

import { ReportingDateRange } from "@/components/command-center/reporting-date-range";
import { loadCommandCenter } from "@/lib/dashboard-data";
import { formatCents } from "@/lib/domain/money";
import {
  formatReadableDateRange,
  resolveReportingRange,
  type ReportingRangeParams,
} from "@/lib/domain/reporting-date-range";

function channelLabel(value: string | null) {
  if (!value) return "No channel recorded";
  if (value.toLowerCase() === "sms") return "SMS";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<ReportingRangeParams>;
}) {
  const reportingRange = resolveReportingRange(await searchParams, {
    lagDays: 0,
  });
  const data = await loadCommandCenter(reportingRange);
  if (!data) return null;
  const range = formatReadableDateRange(data.range.start, data.range.end);
  const metrics = [
    [
      "New leads",
      data.metrics.newLeads.toLocaleString(),
      `${range} · Inquiry date`,
    ],
    [
      "Needs response",
      data.metrics.needsResponse.toLocaleString(),
      `As of now · Communications`,
    ],
    [
      "Follow-ups due",
      data.metrics.followUpsDue.toLocaleString(),
      `Today · Tasks`,
    ],
    ["Overdue", data.metrics.overdue.toLocaleString(), `As of now · Tasks`],
    [
      "Proposals sent",
      data.metrics.proposalsSent.toLocaleString(),
      `${range} · Proposals`,
    ],
    [
      "Proposals viewed",
      data.metrics.proposalsViewed.toLocaleString(),
      `${range} · Confirmed activity`,
    ],
    [
      "Bookings",
      data.metrics.bookings.toLocaleString(),
      `${range} · Booking date`,
    ],
    [
      "Booked revenue",
      formatCents(data.metrics.bookedCents),
      `${range} · Booking date`,
    ],
    [
      "Collected",
      formatCents(data.metrics.collectedCents),
      `All retained · Project totals`,
    ],
    [
      "Outstanding",
      formatCents(data.metrics.outstandingCents),
      `All open · Projects`,
    ],
    [
      "Ad spend",
      formatCents(data.metrics.adSpendCents),
      `${range} · Google Ads`,
    ],
    [
      "Organic clicks",
      data.metrics.organicClicks.toLocaleString(),
      `${range} · Search Console`,
    ],
  ];
  return (
    <div className="reveal pb-20 lg:pb-0">
      <section className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mb-3 flex items-center gap-2 font-mono text-[9px] font-bold tracking-[.2em] text-marigold uppercase">
            <span className="h-px w-8 bg-marigold" /> Owner overview / Live ledger
          </p>
          <h1 className="max-w-3xl font-display text-5xl leading-[.86] tracking-[-.055em] sm:text-7xl xl:text-[5.6rem]">
            Make the next
            <br className="hidden sm:block" /> <span className="text-coral italic">right move.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-ink/58">
            {data.metrics.needsResponse
              ? `${data.metrics.needsResponse} leads need a first response.`
              : "No leads are waiting for a first response."}{" "}
            {data.metrics.overdue
              ? `${data.metrics.overdue} follow-ups are overdue.`
              : "No follow-ups are overdue."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex h-10 items-center gap-2 rounded-lg border bg-cream px-3 text-xs font-bold">
            <CalendarDays className="size-4" /> {range}
          </span>
          <Link
            href="/pipeline?view=attention"
            className="inline-flex h-10 items-center gap-2 rounded-[3px] bg-marigold px-4 text-xs font-bold text-void shadow-[3px_3px_0_#ff6547] transition hover:-translate-y-0.5"
          >
            Open today’s worklist <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
      <div className="mb-5">
        <ReportingDateRange
          action="/"
          range={reportingRange}
          lagLabel="HoneyBook through today"
        />
      </div>
      <section
        aria-label="Key metrics"
        className="mb-5 grid overflow-hidden rounded-[5px] border bg-cream sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6"
      >
        {metrics.map(([label, value, note], index) => (
          <div key={label} className="relative border-b border-r p-4">
            <span
              className={`absolute left-0 top-0 h-1 w-full ${index < 4 ? "bg-coral" : index < 8 ? "bg-moss" : "bg-turquoise"}`}
            />
            <p className="mt-1 text-[10px] font-bold text-ink/48">{label}</p>
            <p className="mt-2 font-display text-3xl leading-none tracking-[-.04em] text-ink">
              {value}
            </p>
            <p className="mt-3 font-mono text-[8px] leading-4 text-ink/38 uppercase">
              {note}
            </p>
          </div>
        ))}
      </section>
      {data.metrics.lifecycleCoverage.inquiryDates < data.projects.length ? (
        <section className="mb-5 rounded-xl border border-marigold/45 bg-marigold/[.08] px-4 py-3 text-[10px] leading-5 text-ink/60">
          <strong className="text-ink">
            Lifecycle dates are still filling.
          </strong>{" "}
          Monthly lead, booking, revenue, and cost-per-lead figures only include
          records carrying their actual HoneyBook inquiry or booking date. They
          no longer treat the CSV import date as a business event.
        </section>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-12">
        <section className="paper overflow-hidden rounded-xl border xl:col-span-8">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <p className="font-mono text-[8px] font-bold tracking-[.14em] text-coral uppercase">
                Revenue queue
              </p>
              <h2 className="mt-1 font-display text-2xl">
                Leads needing attention
              </h2>
            </div>
            <Link
              href="/pipeline?view=attention"
              className="flex items-center text-[11px] font-bold text-ink/55"
            >
              View pipeline <ChevronRight className="size-4" />
            </Link>
          </div>
          {data.attention.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left">
                <thead className="bg-ink/[.035] font-mono text-[8px] tracking-[.12em] text-ink/45 uppercase">
                  <tr>
                    <th className="px-5 py-3">Lead / event</th>
                    <th className="px-3 py-3">Contacts</th>
                    <th className="px-3 py-3">Location</th>
                    <th className="px-3 py-3">Stage</th>
                    <th className="px-3 py-3">Next move</th>
                    <th className="px-5 py-3 text-right">Potential</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.attention.map((project) => (
                    <tr key={project.id}>
                      <td className="px-5 py-4">
                        <Link
                          href={`/leads/${project.id}`}
                          className="font-display text-[17px] font-semibold hover:underline"
                        >
                          {project.name}
                        </Link>
                        <p className="mt-1 text-[10px] text-ink/45">
                          {project.eventType}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <p className="text-xs font-bold">
                          {project.contactName}
                        </p>
                        {project.email ? (
                          <a
                            href={`mailto:${project.email}`}
                            className="mt-1 block text-[9px] text-ink/45 hover:text-coral"
                          >
                            {project.email}
                          </a>
                        ) : null}
                        {project.phone ? (
                          <a
                            href={`tel:${project.phone}`}
                            className="mt-1 block text-[9px] text-ink/45 hover:text-coral"
                          >
                            {project.phone}
                          </a>
                        ) : null}
                      </td>
                      <td className="px-3 py-4">
                        <p className="text-xs font-bold">{project.venue}</p>
                        <p className="mt-1 text-[9px] text-ink/45">
                          {project.location}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <span className="rounded-full border bg-panel px-2.5 py-1 text-[10px] font-bold">
                          {project.stage}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <p className="text-xs font-bold text-coral">
                          {!project.lastContactAt
                            ? "Send first response"
                            : project.nextFollowUpAt
                              ? `Follow up ${new Date(project.nextFollowUpAt).toLocaleDateString()}`
                              : "Review next step"}
                        </p>
                        <p className="mt-1 text-[9px] text-ink/42">
                          {channelLabel(project.lastContactChannel)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-xs font-bold">
                        {formatCents(project.estimatedCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid place-items-center px-6 py-14 text-center">
              <Database className="size-7 text-ink/25" />
              <p className="mt-3 text-sm font-bold">
                Nothing needs attention yet
              </p>
              <p className="mt-1 text-[10px] text-ink/45">
                Import leads or connect HoneyBook to populate the worklist.
              </p>
              <Link
                href="/imports"
                className="mt-4 text-xs font-bold text-coral"
              >
                Open imports
              </Link>
            </div>
          )}
        </section>
        <section className="paper rounded-xl border xl:col-span-4">
          <div className="border-b px-5 py-4">
            <p className="font-mono text-[8px] font-bold tracking-[.14em] text-moss uppercase">
              Live ledger
            </p>
            <h2 className="mt-1 font-display text-2xl">Latest activity</h2>
          </div>
          {data.activities.length ? (
            <div className="divide-y px-5">
              {data.activities.map((activity) => (
                <div
                  key={activity.id}
                  className="grid grid-cols-[12px_1fr] gap-3 py-4"
                >
                  <span className="mt-1.5 size-2 rounded-full bg-turquoise" />
                  <div>
                    <p className="text-xs font-bold">{activity.title}</p>
                    <p className="mt-1 text-[11px] leading-5 text-ink/52">
                      {activity.detail ?? "No additional detail"}
                    </p>
                    <p className="mt-1.5 font-mono text-[8px] text-ink/35 uppercase">
                      {new Date(activity.occurred_at).toLocaleString("en-US", {
                        timeZone: "America/Chicago",
                      })}{" "}
                      · {activity.source_origin}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-xs text-ink/45">
              Activity will appear after the first import or webhook.
            </p>
          )}
        </section>
        <section className="paper rounded-xl border p-5 xl:col-span-5">
          <p className="font-mono text-[8px] font-bold tracking-[.14em] text-ink/40 uppercase">
            Advertising · {range}
          </p>
          <h2 className="mt-1 font-display text-2xl">Spend to celebration</h2>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] text-ink/45">Spend</p>
              <p className="mt-1 font-display text-2xl">
                {formatCents(data.metrics.adSpendCents)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-ink/45">Cost / lead</p>
              <p className="mt-1 font-display text-2xl">
                {data.metrics.cplCents === null
                  ? "—"
                  : formatCents(data.metrics.cplCents)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-ink/45">Data source</p>
              <p className="mt-1 text-xs font-bold">Google Ads</p>
            </div>
          </div>
        </section>
        <section className="paper rounded-xl border p-5 xl:col-span-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[8px] font-bold tracking-[.14em] text-ink/40 uppercase">
                Organic search · {range}
              </p>
              <h2 className="mt-1 font-display text-2xl">Search visibility</h2>
            </div>
            <Search className="size-5 text-turquoise" />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div>
              <p className="font-display text-2xl">
                {data.metrics.organicClicks.toLocaleString()}
              </p>
              <p className="text-[9px] text-ink/42">Clicks</p>
            </div>
            <div>
              <p className="font-display text-2xl">
                {data.metrics.organicImpressions.toLocaleString()}
              </p>
              <p className="text-[9px] text-ink/42">Impressions</p>
            </div>
            <div>
              <p className="font-display text-2xl">
                {data.metrics.averagePosition
                  ? data.metrics.averagePosition.toFixed(1)
                  : "—"}
              </p>
              <p className="text-[9px] text-ink/42">Avg. position</p>
            </div>
          </div>
        </section>
        <section
          className={`rounded-xl border p-5 xl:col-span-3 ${data.issues.length || data.pendingMappings ? "border-[#d79f92] bg-coral/[.08]" : "border-moss/25 bg-moss/[.08]"}`}
        >
          <div className="flex items-center gap-2">
            <CircleAlert className="size-4" />
            <p className="font-mono text-[8px] font-bold uppercase">
              Integration health
            </p>
          </div>
          <p className="mt-3 font-display text-2xl">
            {data.issues.length + data.pendingMappings} items need review
          </p>
          <ul className="mt-4 space-y-2 text-[10px] leading-4 text-ink/60">
            {data.issues.slice(0, 3).map((issue, index) => (
              <li key={`${issue.provider}-${index}`}>
                {issue.provider}: {issue.title}
              </li>
            ))}
            {data.pendingMappings ? (
              <li>{data.pendingMappings} imported values need mapping</li>
            ) : null}
          </ul>
          <Link
            href="/integrations"
            className="mt-5 inline-flex items-center text-[10px] font-bold"
          >
            Review health <ChevronRight className="size-3.5" />
          </Link>
        </section>
      </div>
    </div>
  );
}
