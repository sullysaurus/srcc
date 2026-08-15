import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  CalendarRange,
  Columns3,
  List,
  Search,
} from "lucide-react";
import Link from "next/link";

import { loadPipelineProjects } from "@/lib/dashboard-data";
import {
  countPipelineViews,
  defaultPipelineSortDirection,
  filterPipelineProjects,
  sortPipelineProjects,
  validPipelineSortDirection,
  validPipelineSortKey,
  type PipelineSortDirection,
  type PipelineSortKey,
} from "@/lib/domain/pipeline-filtering";
import { formatCents } from "@/lib/domain/money";
import {
  pipelineDateKey,
  pipelineYearEnd,
  shiftPipelineDate,
  validPipelineDateParam,
} from "@/lib/domain/pipeline-date-range";

const savedViews = [
  ["all", "All leads"],
  ["new", "New inquiries"],
  ["response", "Needs response"],
  ["followup", "Follow-up due"],
  ["not-viewed", "Proposal not viewed"],
  ["viewed", "Viewed, not booked"],
  ["hot", "Hot leads"],
  ["booked", "Booked & planning"],
  ["lost", "Lost leads"],
] as const;

const honeyBookStageOrder = [
  "Proposal sent",
  "Proposal viewed",
  "Completed",
  "Retainer paid",
  "Planning",
  "Inquiry",
  "Follow-up",
  "Proposal signed",
  "Meeting",
  "Archived",
];

type PipelineSearchParams = {
  view?: string;
  q?: string;
  layout?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
};

function pipelineHref(
  params: PipelineSearchParams,
  changes: Partial<PipelineSearchParams>,
) {
  const next = { ...params, ...changes };
  const query = new URLSearchParams();
  if (next.view && next.view !== "all") query.set("view", next.view);
  if (next.q) query.set("q", next.q);
  if (next.layout === "kanban") query.set("layout", "kanban");
  if (next.from) query.set("from", next.from);
  if (next.to) query.set("to", next.to);
  if (next.sort) query.set("sort", next.sort);
  if (next.dir) query.set("dir", next.dir);
  const suffix = query.toString();
  return suffix ? `/pipeline?${suffix}` : "/pipeline";
}

function dateLabel(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "America/Chicago",
      })
    : "—";
}

function SortableColumnHeader({
  label,
  sortKey,
  activeSort,
  activeDirection,
  params,
  className = "px-3 py-3",
}: {
  label: string;
  sortKey: PipelineSortKey;
  activeSort: PipelineSortKey | null;
  activeDirection: PipelineSortDirection;
  params: PipelineSearchParams;
  className?: string;
}) {
  const selected = activeSort === sortKey;
  const nextDirection = selected
    ? activeDirection === "asc"
      ? "desc"
      : "asc"
    : defaultPipelineSortDirection(sortKey);
  const Icon = selected
    ? activeDirection === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;
  return (
    <th
      className={className}
      aria-sort={
        selected
          ? activeDirection === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <Link
        href={pipelineHref(params, {
          sort: sortKey,
          dir: nextDirection,
        })}
        className="inline-flex items-center gap-1.5 hover:text-ink"
      >
        {label}
        <Icon className={`size-3 ${selected ? "text-coral" : "opacity-35"}`} />
      </Link>
    </th>
  );
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<PipelineSearchParams>;
}) {
  const params = await searchParams;
  const allProjects = await loadPipelineProjects();
  const activeView = params.view ?? "all";
  const fromDate = validPipelineDateParam(params.from);
  const toDate = validPipelineDateParam(params.to);
  const activeSort = validPipelineSortKey(params.sort);
  const activeDirection =
    validPipelineSortDirection(params.dir) ??
    (activeSort ? defaultPipelineSortDirection(activeSort) : "asc");
  const activeParams = {
    ...params,
    view: activeView,
    from: fromDate,
    to: toDate,
    sort: activeSort ?? undefined,
    dir: activeSort ? activeDirection : undefined,
  };
  const projects = sortPipelineProjects(
    filterPipelineProjects(
      allProjects,
      activeView,
      params.q ?? "",
      fromDate,
      toDate,
    ),
    activeSort,
    activeDirection,
  );
  const kanban = params.layout === "kanban";
  const today = pipelineDateKey(new Date().toISOString()) ?? "";
  const thisYear = today.slice(0, 4);
  const hasDateRange = Boolean(fromDate || toDate);
  const counts = countPipelineViews(
    allProjects,
    savedViews.map(([key]) => key),
    params.q ?? "",
    fromDate,
    toDate,
  );
  const hasAnyFilter =
    activeView !== "all" || Boolean(params.q) || hasDateRange;
  const resetFiltersHref = pipelineHref(
    {
      layout: kanban ? "kanban" : undefined,
      sort: activeSort ?? undefined,
      dir: activeSort ? activeDirection : undefined,
    },
    {},
  );
  return (
    <div className="pb-20 lg:pb-0">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-mono text-[9px] font-bold tracking-[.15em] text-coral uppercase">
            Sales pipeline / {allProjects.length} HoneyBook records
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-[-.04em] sm:text-5xl">
            Every lead, one clear next step.
          </h1>
          <p className="mt-3 text-sm text-ink/52">
            Status, project details, and dollars mirror HoneyBook. Follow-ups
            and temperature are maintained in this workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={pipelineHref(activeParams, { layout: "kanban" })}
            className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-bold ${kanban ? "bg-ink text-white" : "bg-cream"}`}
          >
            <Columns3 className="size-4" /> Kanban
          </Link>
          <Link
            href={pipelineHref(activeParams, { layout: undefined })}
            className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-bold ${!kanban ? "bg-ink text-white" : "bg-cream"}`}
          >
            <List className="size-4" /> Table
          </Link>
        </div>
      </div>
      <nav
        aria-label="Saved pipeline views"
        className="mb-4 flex gap-2 overflow-x-auto pb-1"
      >
        {savedViews.map(([key, label]) => (
          <Link
            href={pipelineHref(activeParams, { view: key })}
            key={key}
            aria-current={activeView === key ? "page" : undefined}
            className={`whitespace-nowrap rounded-full border px-3 py-2 text-[10px] font-bold ${activeView === key ? "border-ink bg-ink text-white" : "bg-cream text-ink/55"}`}
          >
            {label}
            <span
              className={`ml-2 rounded-full px-1.5 ${activeView === key ? "bg-white/15" : "bg-ink/5"}`}
            >
              {counts.get(key)}
            </span>
          </Link>
        ))}
      </nav>
      <form
        action="/pipeline"
        method="get"
        className="paper mb-3 grid gap-3 rounded-xl border p-3 lg:grid-cols-[minmax(240px,1fr)_auto_auto] lg:items-end"
      >
        <input type="hidden" name="view" value={activeView} />
        {kanban ? <input type="hidden" name="layout" value="kanban" /> : null}
        {activeSort ? (
          <>
            <input type="hidden" name="sort" value={activeSort} />
            <input type="hidden" name="dir" value={activeDirection} />
          </>
        ) : null}
        <div>
          <label
            htmlFor="pipeline-search"
            className="mb-1.5 block font-mono text-[8px] font-bold tracking-[.12em] text-ink/40 uppercase"
          >
            Find a lead
          </label>
          <label className="flex h-11 items-center gap-2 rounded-lg border bg-white px-3 focus-within:border-ink/50">
            <Search className="size-4 text-ink/35" />
            <input
              id="pipeline-search"
              name="q"
              defaultValue={params.q}
              aria-label="Search leads"
              placeholder="Search name, venue, service…"
              className="w-full bg-transparent text-xs outline-none"
            />
          </label>
        </div>
        <fieldset>
          <legend className="mb-1.5 font-mono text-[8px] font-bold tracking-[.12em] text-ink/40 uppercase">
            Event date
          </legend>
          <div className="flex items-center rounded-lg border bg-white p-1">
            <label className="min-w-0">
              <span className="sr-only">Event date from</span>
              <input
                type="date"
                name="from"
                defaultValue={fromDate}
                max={toDate || undefined}
                className="h-9 min-w-0 rounded-md bg-transparent px-2 text-[11px] font-bold outline-none focus:bg-cream"
              />
            </label>
            <ArrowRight className="size-3.5 shrink-0 text-ink/25" />
            <label className="min-w-0">
              <span className="sr-only">Event date to</span>
              <input
                type="date"
                name="to"
                defaultValue={toDate}
                min={fromDate || undefined}
                className="h-9 min-w-0 rounded-md bg-transparent px-2 text-[11px] font-bold outline-none focus:bg-cream"
              />
            </label>
          </div>
        </fieldset>
        <button className="h-11 rounded-lg bg-ink px-5 text-xs font-bold text-white transition hover:bg-coral">
          Apply filters
        </button>
      </form>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <CalendarRange className="size-4 shrink-0 text-coral" />
          {[
            ["All dates", "", ""],
            ["Next 30 days", today, shiftPipelineDate(today, 30)],
            ["Next 90 days", today, shiftPipelineDate(today, 90)],
            [`Rest of ${thisYear}`, today, pipelineYearEnd(today)],
          ].map(([label, from, to]) => {
            const selected = fromDate === from && toDate === to;
            return (
              <Link
                key={label}
                href={pipelineHref(activeParams, { from, to })}
                aria-current={selected ? "page" : undefined}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[9px] font-bold transition ${selected ? "border-coral bg-coral text-white" : "bg-cream text-ink/50 hover:border-ink/30"}`}
              >
                {label}
              </Link>
            );
          })}
        </div>
        <p className="text-[10px] font-bold text-ink/45">
          Showing <span className="text-ink">{projects.length}</span> of{" "}
          {allProjects.length} leads
          {hasDateRange ? " in this event window" : " across all event dates"}
          {hasAnyFilter ? (
            <Link
              href={resetFiltersHref}
              className="ml-2 text-coral underline decoration-coral/30 underline-offset-2"
            >
              Reset all filters
            </Link>
          ) : null}
        </p>
      </div>
      {!projects.length ? (
        <section className="paper grid min-h-72 place-items-center rounded-xl border p-8 text-center">
          <div>
            <CalendarDays className="mx-auto size-8 text-ink/20" />
            <h2 className="mt-4 font-display text-2xl">
              No leads in this view
            </h2>
            <p className="mt-2 text-xs text-ink/45">
              {hasAnyFilter
                ? "No projects match this combination. Clear filters or try a broader search."
                : "Turn on the Zapier connection or upload a HoneyBook CSV to begin."}
            </p>
            {hasAnyFilter ? (
              <Link
                href={resetFiltersHref}
                className="mt-4 inline-block text-xs font-bold text-coral"
              >
                Reset all filters
              </Link>
            ) : null}
            {!hasAnyFilter ? (
              <Link
                href="/integrations/honeybook"
                className="mt-4 inline-block text-xs font-bold text-coral"
              >
                Open HoneyBook setup
              </Link>
            ) : null}
          </div>
        </section>
      ) : kanban ? (
        <div className="grid gap-4 overflow-x-auto pb-4 lg:grid-cols-3 xl:grid-cols-4">
          {[
            ...honeyBookStageOrder,
            ...[...new Set(projects.map((project) => project.stage))].filter(
              (stage) => !honeyBookStageOrder.includes(stage),
            ),
          ].map((stage) => (
            <section
              key={stage}
              className="min-w-72 rounded-xl border bg-ink/[.025] p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold">{stage}</h2>
                <span className="rounded-full bg-ink px-2 py-1 font-mono text-[8px] text-white">
                  {projects.filter((project) => project.stage === stage).length}
                </span>
              </div>
              <div className="space-y-3">
                {projects
                  .filter((project) => project.stage === stage)
                  .map((project) => (
                    <Link
                      href={`/leads/${project.id}`}
                      key={project.id}
                      className="paper block rounded-lg border p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <p className="font-display text-lg font-semibold">
                        {project.name}
                      </p>
                      <p className="mt-1 text-[9px] text-ink/45">
                        {project.eventType} · {dateLabel(project.eventDate)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {project.services.map((service) => (
                          <span
                            key={service.name}
                            className="rounded bg-turquoise/15 px-2 py-1 text-[8px] font-bold text-[#285e59]"
                          >
                            {service.name}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-between border-t pt-3 text-[9px]">
                        <span className="text-ink/45">Next follow-up</span>
                        <strong>{dateLabel(project.nextFollowUpAt)}</strong>
                      </div>
                    </Link>
                  ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="paper overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1780px] text-left">
              <thead className="bg-ink/[.035] font-mono text-[8px] tracking-[.11em] text-ink/44 uppercase">
                <tr>
                  <SortableColumnHeader
                    label="Lead"
                    sortKey="lead"
                    activeSort={activeSort}
                    activeDirection={activeDirection}
                    params={activeParams}
                    className="px-5 py-3"
                  />
                  <SortableColumnHeader
                    label="Contacts"
                    sortKey="contacts"
                    activeSort={activeSort}
                    activeDirection={activeDirection}
                    params={activeParams}
                  />
                  <SortableColumnHeader
                    label="Location"
                    sortKey="location"
                    activeSort={activeSort}
                    activeDirection={activeDirection}
                    params={activeParams}
                  />
                  <SortableColumnHeader
                    label="HoneyBook status"
                    sortKey="status"
                    activeSort={activeSort}
                    activeDirection={activeDirection}
                    params={activeParams}
                  />
                  <SortableColumnHeader
                    label="Last contact"
                    sortKey="last-contact"
                    activeSort={activeSort}
                    activeDirection={activeDirection}
                    params={activeParams}
                  />
                  <SortableColumnHeader
                    label="Proposal viewed"
                    sortKey="proposal-viewed"
                    activeSort={activeSort}
                    activeDirection={activeDirection}
                    params={activeParams}
                  />
                  <SortableColumnHeader
                    label="Dollars"
                    sortKey="dollars"
                    activeSort={activeSort}
                    activeDirection={activeDirection}
                    params={activeParams}
                  />
                  <th className="px-3 py-3">Type / services</th>
                  <SortableColumnHeader
                    label="Event"
                    sortKey="event"
                    activeSort={activeSort}
                    activeDirection={activeDirection}
                    params={activeParams}
                  />
                  <SortableColumnHeader
                    label="Next follow-up"
                    sortKey="next-follow-up"
                    activeSort={activeSort}
                    activeDirection={activeDirection}
                    params={activeParams}
                  />
                  <th className="px-5 py-3">Attribution</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-marigold/[.06]">
                    <td className="px-5 py-4">
                      <Link
                        href={`/leads/${project.id}`}
                        className="font-display text-[17px] font-semibold hover:underline"
                      >
                        {project.name}
                      </Link>
                      <p className="mt-1 text-[9px] text-ink/40">
                        {project.source} · {project.owner}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <p className="text-xs font-bold">{project.contactName}</p>
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
                      <p className="mt-1 text-[9px] text-ink/40">
                        {project.location}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <span className="rounded-full border bg-white px-2.5 py-1 text-[9px] font-bold">
                        {project.stage}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <p className="text-xs font-bold">
                        {project.lastContactAt
                          ? dateLabel(project.lastContactAt)
                          : "Not supplied"}
                      </p>
                      <p className="mt-1 text-[9px] text-ink/40">
                        {project.lastContactChannel ??
                          "HoneyBook/Zapier limitation"}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`text-xs font-bold ${project.firstViewedAt ? "text-coral" : project.proposalStatus.toLowerCase().includes("signed") ? "text-moss" : ""}`}
                      >
                        {project.firstViewedAt
                          ? dateLabel(project.firstViewedAt)
                          : project.proposalSentAt
                            ? "Not viewed"
                            : "Not available"}
                      </span>
                      <p className="mt-1 text-[9px] text-ink/40">
                        Supported source required
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[8px]">
                        <dt className="text-ink/40">Est.</dt>
                        <dd className="font-bold">
                          {formatCents(project.estimatedCents)}
                        </dd>
                        <dt className="text-ink/40">Booked</dt>
                        <dd className="font-bold">
                          {formatCents(project.bookedCents)}
                        </dd>
                        <dt className="text-ink/40">Collected</dt>
                        <dd className="font-bold text-moss">
                          {formatCents(project.collectedCents)}
                        </dd>
                        <dt className="text-ink/40">Due</dt>
                        <dd className="font-bold text-coral">
                          {formatCents(project.outstandingCents)}
                        </dd>
                      </dl>
                    </td>
                    <td className="px-3 py-4">
                      <p className="mb-2 text-[9px] font-bold text-ink/55">
                        {project.eventType}
                      </p>
                      <div className="flex max-w-[190px] flex-wrap gap-1">
                        {project.services.length ? (
                          project.services.map((service) => (
                            <span
                              className="rounded bg-turquoise/15 px-2 py-1 text-[9px] font-bold text-[#285e59]"
                              key={service.name}
                            >
                              {service.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[9px] text-coral">
                            Not supplied
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <p className="text-xs font-bold">
                        {dateLabel(project.eventDate)}
                      </p>
                      <p className="mt-1 text-[9px] text-ink/40">
                        {project.eventType}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <p className="text-xs font-bold">
                        {dateLabel(project.nextFollowUpAt)}
                      </p>
                    </td>
                    <td className="max-w-[170px] px-5 py-4 text-[10px] leading-4 text-ink/55">
                      {project.attribution}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
