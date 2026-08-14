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

  it("maps unambiguous historical booking outcomes", () => {
    expect(normalizeStage("Booked!").value).toBe("Retainer Paid");
    expect(normalizeStage("No response yet").value).toBe("Follow-up");
    expect(normalizeStage("Priced too high").value).toBe("Lost");
    expect(normalizeStage("Will call 10/21/25").value).toBe("Follow-up");
  });
});
