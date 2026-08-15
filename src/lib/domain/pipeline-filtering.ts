import type { LiveProject } from "@/lib/dashboard-data";
import { isInPipelineDateRange } from "@/lib/domain/pipeline-date-range";

export const pipelineSortKeys = [
  "lead",
  "contacts",
  "location",
  "status",
  "last-contact",
  "proposal-viewed",
  "dollars",
  "event",
  "next-follow-up",
] as const;

export type PipelineSortKey = (typeof pipelineSortKeys)[number];
export type PipelineSortDirection = "asc" | "desc";

export function validPipelineSortKey(value: string | undefined) {
  return pipelineSortKeys.includes(value as PipelineSortKey)
    ? (value as PipelineSortKey)
    : null;
}

export function validPipelineSortDirection(value: string | undefined) {
  return value === "asc" || value === "desc" ? value : null;
}

export function defaultPipelineSortDirection(
  key: PipelineSortKey,
): PipelineSortDirection {
  return [
    "last-contact",
    "proposal-viewed",
    "dollars",
    "event",
    "next-follow-up",
  ].includes(key)
    ? "desc"
    : "asc";
}

const collator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

export function sortPipelineProjects(
  projects: LiveProject[],
  key: PipelineSortKey | null,
  direction: PipelineSortDirection = "asc",
) {
  if (!key) return projects;
  const value = (project: LiveProject): string | number | null => {
    if (key === "lead") return project.name;
    if (key === "contacts")
      return project.contactName || project.email || project.phone;
    if (key === "location") return project.venue || project.location;
    if (key === "status") return project.stage;
    if (key === "last-contact") return project.lastContactAt;
    if (key === "proposal-viewed") return project.latestViewedAt;
    if (key === "dollars")
      return (
        project.bookedCents || project.proposalCents || project.estimatedCents
      );
    if (key === "event") return project.eventDate;
    return project.nextFollowUpAt;
  };
  const dateKey = [
    "last-contact",
    "proposal-viewed",
    "event",
    "next-follow-up",
  ].includes(key);
  return projects.toSorted((left, right) => {
    const leftValue = value(left);
    const rightValue = value(right);
    if (leftValue === null && rightValue === null) return 0;
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;
    const comparison =
      typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : dateKey
          ? Date.parse(String(leftValue)) - Date.parse(String(rightValue))
          : collator.compare(String(leftValue), String(rightValue));
    return direction === "desc" ? -comparison : comparison;
  });
}

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
