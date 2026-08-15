import { describe, expect, it } from "vitest";

import {
  isInPipelineDateRange,
  pipelineDateKey,
  pipelineYearEnd,
  shiftPipelineDate,
  validPipelineDateParam,
} from "./pipeline-date-range";

describe("pipeline event date ranges", () => {
  it("uses the command center Central time calendar date", () => {
    expect(pipelineDateKey("2026-08-15T02:00:00Z")).toBe("2026-08-14");
    expect(pipelineDateKey("2026-08-15T12:00:00Z")).toBe("2026-08-15");
  });

  it("includes both range boundaries", () => {
    expect(
      isInPipelineDateRange("2026-08-14T12:00:00Z", "2026-08-14", "2026-09-13"),
    ).toBe(true);
    expect(
      isInPipelineDateRange("2026-09-13T12:00:00Z", "2026-08-14", "2026-09-13"),
    ).toBe(true);
    expect(
      isInPipelineDateRange("2026-09-14T12:00:00Z", "2026-08-14", "2026-09-13"),
    ).toBe(false);
  });

  it("keeps undated projects only when no date window is active", () => {
    expect(isInPipelineDateRange(null, "", "")).toBe(true);
    expect(isInPipelineDateRange(null, "2026-08-14", "")).toBe(false);
  });

  it("builds valid quick ranges and rejects impossible dates", () => {
    expect(shiftPipelineDate("2026-08-14", 30)).toBe("2026-09-13");
    expect(pipelineYearEnd("2026-08-14")).toBe("2026-12-31");
    expect(validPipelineDateParam("2026-02-30")).toBe("");
    expect(validPipelineDateParam("not-a-date")).toBe("");
  });
});
