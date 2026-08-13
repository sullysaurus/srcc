import { describe, expect, it } from "vitest";
import { buildOperationalInsights } from "./insights";
describe("operational insights", () => {
  it("surfaces overdue follow-ups and today's events with stable keys", () => {
    const rows = buildOperationalInsights(
      [
        {
          id: "p1",
          name: "Taylor wedding",
          nextFollowUpAt: "2026-08-12T12:00:00Z",
          eventAt: "2026-08-13T19:00:00Z",
          bookedValueCents: 100000,
        },
      ],
      new Date("2026-08-13T10:00:00Z"),
    );
    expect(rows.map((row) => row.key)).toEqual([
      "overdue-follow-up:p1",
      "event-today:p1",
    ]);
  });
});
