import type { LiveProject } from "@/lib/dashboard-data";
import { isInPipelineDateRange } from "@/lib/domain/pipeline-date-range";

export function filterPipelineProjects(
  projects: LiveProject[],
  view: string,
  query: string,
  fromDate = "",
  toDate = "",
) {
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
    if (!isInPipelineDateRange(project.eventDate, fromDate, toDate))
      return false;
    if (view === "new") return project.stageKey === "inquiry";
    if (view === "response")
      return project.stageKey === "inquiry" && !project.lastContactAt;
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

export function countPipelineViews(
  projects: LiveProject[],
  views: readonly string[],
  query: string,
  fromDate = "",
  toDate = "",
) {
  return new Map(
    views.map((view) => [
      view,
      filterPipelineProjects(projects, view, query, fromDate, toDate).length,
    ]),
  );
}
