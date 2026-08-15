import { describe, expect, it } from "vitest";

import { previewHoneyBookCsv } from "./honeybook-csv";

describe("HoneyBook CSV import", () => {
  it("preserves HoneyBook fields and mirrors pipeline labels", () => {
    const [row] = previewHoneyBookCsv(
      'Project ID,Project Name,Project Stage,Contacts,Service Date,Lead Source,Project Type,Service,Booked Value,Amount Paid\nhb_123,Elena\'s Project,Retainer paid,Elena Ruiz,2026-10-24,Google,Wedding,"Photo Booth, Bar Services","$2,500","$500"',
    );
    expect(row.normalizedValues).toMatchObject({
      projectId: "hb_123",
      projectName: "Elena's Project",
      firstName: "Elena",
      lastName: "Ruiz",
      stageKey: "retainer_paid",
      stageName: "Retainer paid",
      services: ["Photo Booth", "Bar Services"],
      bookedValueCents: 250000,
      collectedCents: 50000,
    });
    expect(row.validationErrors).toEqual([]);
  });

  it("extracts a stable project id from a HoneyBook project URL", () => {
    const [row] = previewHoneyBookCsv(
      "Project URL,Project Stage,Project Name\nhttps://www.honeybook.com/app/projects/abc-123,Inquiry,Carrington Open House",
    );
    expect(row.normalizedValues.projectId).toBe("abc-123");
  });

  it("normalizes lifecycle, owner, client, and money fields from a native project report", () => {
    const [row] = previewHoneyBookCsv(
      "Project ID,Project Name,Project Owner,Client Info,Project Creation Date,Booked Date,Total Project Value,Total Paid\nhb_99,Amanda Atcheson's Project - Classy Booth,Colton Cerday colton@example.com,Amanda Atcheson amanda@example.com,2026-01-03 22:42:14 UTC,2026-02-04 15:00:00 UTC,1998.00,999.00",
    );
    expect(row.normalizedValues).toMatchObject({
      inquiryAt: "2026-01-03T22:42:14.000Z",
      bookedAt: "2026-02-04T15:00:00.000Z",
      ownerName: "Colton Cerday",
      firstName: "Amanda",
      lastName: "Atcheson",
      email: "amanda@example.com",
      bookedValueCents: 199800,
      collectedCents: 99900,
    });
  });

  it("does not silently accept rows without a stable HoneyBook id", () => {
    const [row] = previewHoneyBookCsv(
      "Project Name,Project Stage\nA Project,Planning",
    );
    expect(row.validationErrors).toContain(
      "A HoneyBook Project ID or Project URL is required",
    );
  });

  it("flags unknown stages without changing the source value", () => {
    const [row] = previewHoneyBookCsv(
      "Project ID,Project Stage\nhb_1,Maybe someday",
    );
    expect(row.normalizedValues.stageName).toBe("Maybe someday");
    expect(row.normalizedValues.stageKey).toBeNull();
    expect(row.validationErrors[0]).toContain("Unrecognized HoneyBook stage");
  });

  it("recognizes every stage in the live Southern Revelry HoneyBook pipeline", () => {
    const csv = [
      "Project ID,Project Stage",
      "1,Proposal sent",
      "2,Proposal viewed",
      "3,Completed",
      "4,Retainer paid",
      "5,Planning",
      "6,Inquiry",
      "7,Follow-up",
      "8,Proposal signed",
      "9,Meeting",
      "10,Archived",
    ].join("\n");
    const rows = previewHoneyBookCsv(csv);
    expect(rows.map((row) => row.normalizedValues.stageKey)).toEqual([
      "proposal_sent",
      "proposal_viewed",
      "completed",
      "retainer_paid",
      "planning",
      "inquiry",
      "follow_up",
      "proposal_signed",
      "meeting",
      "archived",
    ]);
    expect(rows.flatMap((row) => row.validationErrors)).toEqual([]);
  });
});
