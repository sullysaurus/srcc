import { describe, expect, it } from "vitest";
import { inclusiveDays } from "./dates";
import { conversionUploadKey, idempotencyKey, shouldRetry } from "./idempotency";

describe("foundation safeguards", () => {
  it("calculates inclusive reporting ranges", () => expect(inclusiveDays("2026-08-01", "2026-08-31")).toBe(31));
  it("deduplicates webhook and conversion identities deterministically", () => {
    expect(idempotencyKey("HoneyBook", "evt-1")).toBe("honeybook:evt-1");
    expect(conversionUploadKey("project-1", "booking", 125000)).toBe("project-1:booking:125000");
  });
  it("retries only transient failures within a bounded attempt count", () => {
    expect(shouldRetry(2, 429)).toBe(true);
    expect(shouldRetry(2, 400)).toBe(false);
    expect(shouldRetry(5, 503)).toBe(false);
  });
});
