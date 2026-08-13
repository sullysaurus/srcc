export type InsightProject = {
  id: string;
  name: string;
  nextFollowUpAt: string | null;
  eventAt: string | null;
  bookedValueCents: number;
};
export type Insight = {
  key: string;
  severity: "info" | "warning" | "critical";
  category: string;
  title: string;
  detail: string;
  entityId?: string;
  suggestedAction: string;
};

export function buildOperationalInsights(
  projects: InsightProject[],
  now = new Date(),
): Insight[] {
  const insights: Insight[] = [];
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  for (const project of projects) {
    if (
      project.nextFollowUpAt &&
      Date.parse(project.nextFollowUpAt) < now.getTime()
    )
      insights.push({
        key: `overdue-follow-up:${project.id}`,
        severity: "critical",
        category: "sales",
        title: `Follow up with ${project.name}`,
        detail: `Follow-up was due ${new Date(project.nextFollowUpAt).toLocaleDateString("en-US")}.`,
        entityId: project.id,
        suggestedAction: "Contact the lead and set the next follow-up date.",
      });
    if (
      project.eventAt &&
      Date.parse(project.eventAt) >= now.getTime() &&
      Date.parse(project.eventAt) <= todayEnd.getTime()
    )
      insights.push({
        key: `event-today:${project.id}`,
        severity: "warning",
        category: "operations",
        title: `Event today: ${project.name}`,
        detail:
          "Confirm the operations checklist, staffing, and arrival window.",
        entityId: project.id,
        suggestedAction: "Open the project and complete the event-day check.",
      });
  }
  return insights;
}
