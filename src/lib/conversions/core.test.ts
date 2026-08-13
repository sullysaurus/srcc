import { describe, expect, it, vi } from "vitest";
import {
  conversionCandidateKey,
  dryRunConversion,
  evaluateUploadGates,
  normalizePhoneForAds,
  prepareConversionCandidate,
} from "./core";

describe("conversion staging", () => {
  it("uses a stable business event in its deduplication key", () => {
    const input = {
      projectId: "project-1",
      outcome: "revenue_collected" as const,
      occurredAt: "2026-08-13T12:00:00.000Z",
      eventId: "payment-9",
    };
    expect(conversionCandidateKey(input)).toBe(
      "project-1:revenue_collected:payment-9",
    );
    expect(conversionCandidateKey(input)).toBe(conversionCandidateKey(input));
  });

  it("prefers click IDs and stores only normalized user-data hashes", () => {
    vi.setSystemTime(new Date("2026-08-14T00:00:00Z"));
    const result = prepareConversionCandidate({
      projectId: "p1",
      outcome: "booked_event",
      occurredAt: "2026-08-13T12:00:00Z",
      valueCents: 120000,
      conversionActionId: "a1",
      gclid: "click-1",
      email: " Test@Example.com ",
    });
    expect(result.status).toBe("ready_for_dry_run");
    expect(result.identifier).toEqual({ type: "gclid", value: "click-1" });
    expect(result.userDataHashes.email).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain("test@example.com");
    vi.useRealTimers();
  });

  it("rejects missing action mappings and identifiers", () => {
    const result = dryRunConversion({
      projectId: "p1",
      outcome: "qualified_lead",
      occurredAt: "2026-08-13T12:00:00Z",
      valueCents: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "missing_conversion_action_mapping",
        "missing_attribution_identifier",
      ]),
    );
  });

  it("requires every recorded gate plus the runtime kill switch", () => {
    const gates = [
      "tracking_tested",
      "conversion_action_ownership_confirmed",
      "customer_data_terms_accepted",
      "deduplication_verified",
      "production_uploads_approved",
    ].map((gate) => ({
      gate: gate as never,
      satisfied: true,
      approvedAt: "2026-08-13T12:00:00Z",
    }));
    expect(evaluateUploadGates(gates, false)).toEqual({
      allowed: false,
      blockers: ["runtime_kill_switch"],
    });
    expect(evaluateUploadGates(gates, true)).toEqual({
      allowed: true,
      blockers: [],
    });
  });

  it("normalizes US phone numbers for hashing", () => {
    expect(normalizePhoneForAds("(512) 555-0199")).toBe("+15125550199");
    expect(normalizePhoneForAds("123")).toBeNull();
  });
});
