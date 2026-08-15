import { describe, expect, it } from "vitest";
import {
  formatReadableDate,
  formatReadableDateRange,
  percentChange,
  resolveReportingRange,
  validReportingDate,
} from "./reporting-date-range";

describe("reporting date ranges", () => {
  it("builds a preset range and matching comparison period", () => {
    expect(
      resolveReportingRange(
        { days: "7" },
        { now: new Date("2026-08-14T12:00:00Z"), lagDays: 1 },
      ),
    ).toEqual({
      from: "2026-08-07",
      to: "2026-08-13",
      compareFrom: "2026-07-31",
      compareTo: "2026-08-06",
      days: 7,
      preset: "7",
    });
  });

  it("accepts an inclusive custom range", () => {
    expect(
      resolveReportingRange({ from: "2026-07-01", to: "2026-07-31" }),
    ).toMatchObject({
      from: "2026-07-01",
      to: "2026-07-31",
      compareFrom: "2026-05-31",
      compareTo: "2026-06-30",
      days: 31,
      preset: "custom",
    });
  });

  it("rejects impossible dates and calculates deltas safely", () => {
    expect(validReportingDate("2026-02-30")).toBe("");
    expect(percentChange(15, 10)).toBe(0.5);
    expect(percentChange(15, 0)).toBeNull();
  });

  it("formats dates and ranges for people instead of databases", () => {
    expect(formatReadableDate("2026-08-14")).toBe("Aug 14, 2026");
    expect(formatReadableDate("2026-08-14", false)).toBe("Aug 14");
    expect(formatReadableDateRange("2026-08-01", "2026-08-14")).toBe(
      "Aug 1–14, 2026",
    );
    expect(formatReadableDateRange("2026-07-15", "2026-08-14")).toBe(
      "Jul 15–Aug 14, 2026",
    );
    expect(formatReadableDateRange("2025-12-15", "2026-01-14")).toBe(
      "Dec 15, 2025–Jan 14, 2026",
    );
  });
});
