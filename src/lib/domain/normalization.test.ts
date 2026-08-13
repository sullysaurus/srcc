import { describe, expect, it } from "vitest";
import { normalizeService, normalizeStage } from "./normalization";

describe("historical normalization", () => {
  it("maps known services while preserving the source value", () => {
    expect(normalizeService("  photobooth ")).toEqual({
      original: "photobooth",
      value: "Photo Booth",
      confidence: "exact",
      requiresReview: false,
    });
  });

  it("recognizes multi-service rows", () => {
    expect(normalizeService("360 booth + bar service").value).toBe("Multiple Services");
  });

  it("queues unknown values rather than inventing a mapping", () => {
    expect(normalizeService("party package deluxe").requiresReview).toBe(true);
    expect(normalizeStage("maybe booked").value).toBeNull();
  });
});
