import { describe, expect, it } from "vitest";
import type { LiveProject } from "@/lib/dashboard-data";
import {
  countPipelineViews,
  filterPipelineProjects,
  sortPipelineProjects,
} from "./pipeline-filtering";

const projects = [
  {
    name: "Carrington Open House",
    contactName: "Carrington Open House",
    venue: "Venue",
    location: "Austin, TX",
    services: [],
    eventDate: "2026-09-06T18:00:00Z",
    stageKey: "inquiry",
    lastContactAt: null,
    nextFollowUpAt: null,
    proposalSentAt: null,
    firstViewedAt: null,
    bookedCents: 0,
    temperature: null,
  },
  {
    name: "Booked Wedding",
    contactName: "Booked Wedding",
    venue: "Venue",
    location: "Austin, TX",
    services: [],
    eventDate: "2026-09-10T18:00:00Z",
    stageKey: "planning",
    lastContactAt: null,
    nextFollowUpAt: null,
    proposalSentAt: null,
    firstViewedAt: null,
    bookedCents: 500_000,
    temperature: null,
  },
] as unknown as LiveProject[];

describe("pipeline filter counts", () => {
  it("keeps chip counts consistent with the active search and date filters", () => {
    const counts = countPipelineViews(
      projects,
      ["all", "new", "booked"],
      "Carrington",
      "2026-09-01",
      "2026-09-30",
    );

    expect(counts.get("all")).toBe(1);
    expect(counts.get("new")).toBe(1);
    expect(counts.get("booked")).toBe(0);
  });

  it("sorts populated values while keeping missing values last", () => {
    const sortable = [
      { ...projects[0], lastContactAt: null },
      { ...projects[1], lastContactAt: "2026-08-13T12:00:00Z" },
    ];

    expect(
      sortPipelineProjects(sortable, "last-contact", "desc").map(
        (project) => project.name,
      ),
    ).toEqual(["Booked Wedding", "Carrington Open House"]);
    expect(
      sortPipelineProjects(projects, "lead", "asc").map(
        (project) => project.name,
      ),
    ).toEqual(["Booked Wedding", "Carrington Open House"]);
  });

  it("limits the attention view's first-response rule to inquiries", () => {
    expect(
      filterPipelineProjects(projects, "attention", "").map(
        (project) => project.name,
      ),
    ).toEqual(["Carrington Open House"]);
  });
});
