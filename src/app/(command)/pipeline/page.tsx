import { CalendarDays, Columns3, List, Search } from "lucide-react";
import Link from "next/link";

import { loadPipelineProjects, type LiveProject } from "@/lib/dashboard-data";
import { formatCents } from "@/lib/domain/money";

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

function filterProjects(projects: LiveProject[], view: string, query: string) {
  const now = Date.now();
  return projects.filter((project) => {
    const searchable = [
      project.name,
      project.contactName,
      project.venue,
      project.location,
      project.services.map((service) => service.name).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    if (query && !searchable.includes(query.toLowerCase())) return false;
    if (view === "new") return project.stageKey === "inquiry";
    if (view === "response")
      return (
        !project.lastContactAt &&
        !["lost", "archived", "completed"].includes(project.stageKey ?? "")
      );
    if (view === "followup")
      return Boolean(
        project.nextFollowUpAt &&
        Date.parse(project.nextFollowUpAt) <= now &&
        !["lost", "archived", "completed"].includes(project.stageKey ?? ""),
      );
    if (view === "not-viewed")
      return project.proposalSentAt !== null && project.firstViewedAt === null;
    if (view === "viewed")
      return project.firstViewedAt !== null && project.bookedCents === 0;
    if (view === "hot") return project.temperature === "hot";
    if (view === "booked")
      return (
        project.bookedCents > 0 ||
        ["retainer_paid", "planning"].includes(project.stageKey ?? "")
      );
    if (view === "lost") return project.stageKey === "lost";
    if (view === "attention")
      return (
        !project.lastContactAt ||
        Boolean(
          project.nextFollowUpAt && Date.parse(project.nextFollowUpAt) <= now,
        )
      );
    return true;
  });
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; layout?: string }>;
}) {
  const params = await searchParams;
  const allProjects = await loadPipelineProjects();
  const activeView = params.view ?? "all";
  const projects = filterProjects(allProjects, activeView, params.q ?? "");
  const kanban = params.layout === "kanban";
  const counts = new Map(
    savedViews.map(([key]) => [
      key,
      filterProjects(allProjects, key, "").length,
    ]),
  );
  return (
    <div className="pb-20 lg:pb-0">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-mono text-[9px] font-bold tracking-[.15em] text-coral uppercase">
            Sales pipeline / {allProjects.length} live records
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-[-.04em] sm:text-5xl">
            Every lead, one clear next step.
          </h1>
          <p className="mt-3 text-sm text-ink/52">
            HoneyBook-owned values retain their source. Follow-ups and
            temperature are maintained in this workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/pipeline?view=${activeView}&layout=kanban`}
            className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-bold ${kanban ? "bg-ink text-white" : "bg-cream"}`}
          >
            <Columns3 className="size-4" /> Kanban
          </Link>
          <Link
            href={`/pipeline?view=${activeView}`}
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
            href={`/pipeline?view=${key}${kanban ? "&layout=kanban" : ""}`}
            key={key}
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
      <form className="paper mb-4 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
        <input type="hidden" name="view" value={activeView} />
        {kanban ? <input type="hidden" name="layout" value="kanban" /> : null}
        <label className="flex h-10 flex-1 items-center gap-2 rounded-lg border bg-white px-3">
          <Search className="size-4 text-ink/35" />
          <input
            name="q"
            defaultValue={params.q}
            aria-label="Search leads"
            placeholder="Search name, venue, service…"
            className="w-full bg-transparent text-xs outline-none"
          />
        </label>
        <button className="h-10 rounded-lg bg-ink px-4 text-xs font-bold text-white">
          Search
        </button>
        {params.q ? (
          <Link
            href={`/pipeline?view=${activeView}`}
            className="px-3 text-xs font-bold text-ink/45"
          >
            Clear
          </Link>
        ) : null}
      </form>
      {!projects.length ? (
        <section className="paper grid min-h-72 place-items-center rounded-xl border p-8 text-center">
          <div>
            <CalendarDays className="mx-auto size-8 text-ink/20" />
            <h2 className="mt-4 font-display text-2xl">
              No leads in this view
            </h2>
            <p className="mt-2 text-xs text-ink/45">
              Import historical leads, connect HoneyBook, or choose another
              saved view.
            </p>
            <Link
              href="/imports"
              className="mt-4 inline-block text-xs font-bold text-coral"
            >
              Open imports
            </Link>
          </div>
        </section>
      ) : kanban ? (
        <div className="grid gap-4 overflow-x-auto pb-4 lg:grid-cols-3 xl:grid-cols-4">
          {[...new Set(projects.map((project) => project.stage))].map(
            (stage) => (
              <section
                key={stage}
                className="min-w-72 rounded-xl border bg-ink/[.025] p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-bold">{stage}</h2>
                  <span className="rounded-full bg-ink px-2 py-1 font-mono text-[8px] text-white">
                    {
                      projects.filter((project) => project.stage === stage)
                        .length
                    }
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
            ),
          )}
        </div>
      ) : (
        <section className="paper overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left">
              <thead className="bg-ink/[.035] font-mono text-[8px] tracking-[.11em] text-ink/44 uppercase">
                <tr>
                  <th className="px-5 py-3">Lead</th>
                  <th className="px-3 py-3">Stage</th>
                  <th className="px-3 py-3">Services</th>
                  <th className="px-3 py-3">Event</th>
                  <th className="px-3 py-3">Value</th>
                  <th className="px-3 py-3">Last contact</th>
                  <th className="px-3 py-3">Proposal</th>
                  <th className="px-3 py-3">Next follow-up</th>
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
                      <span className="rounded-full border bg-white px-2.5 py-1 text-[9px] font-bold">
                        {project.stage}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex max-w-[180px] flex-wrap gap-1">
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
                            Needs mapping
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <p className="text-xs font-bold">
                        {dateLabel(project.eventDate)}
                      </p>
                      <p className="mt-1 text-[9px] text-ink/40">
                        {project.venue}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-mono text-xs font-bold">
                        {formatCents(
                          project.bookedCents || project.estimatedCents,
                        )}
                      </p>
                      <p className="mt-1 text-[9px] text-moss">
                        {project.bookedCents
                          ? `${formatCents(project.collectedCents)} collected`
                          : "Estimated"}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <p
                        className={`text-xs font-bold ${project.lastContactAt ? "" : "text-coral"}`}
                      >
                        {dateLabel(project.lastContactAt) === "—"
                          ? "Never"
                          : dateLabel(project.lastContactAt)}
                      </p>
                      <p className="mt-1 text-[9px] text-ink/40">
                        {project.lastContactChannel ?? "Needs response"}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`text-xs font-bold ${project.firstViewedAt ? "text-coral" : project.proposalStatus.toLowerCase().includes("signed") ? "text-moss" : ""}`}
                      >
                        {project.firstViewedAt
                          ? "Viewed"
                          : project.proposalStatus}
                      </span>
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
