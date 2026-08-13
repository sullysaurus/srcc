import { describe, expect, it } from "vitest";
import { selectAttribution, stableLeadMatch } from "./attribution";

describe("attribution", () => {
  it("keeps first touch and last non-direct touch distinct", () => {
    const result = selectAttribution([
      { occurredAt: "2026-01-01T00:00:00Z", source: "instagram" },
      { occurredAt: "2026-01-02T00:00:00Z", source: "google", gclid: "click-1" },
      { occurredAt: "2026-01-03T00:00:00Z", source: "direct" },
    ]);
    expect(result.firstTouch?.source).toBe("instagram");
    expect(result.lastNonDirect?.source).toBe("google");
    expect(result.paidClick?.gclid).toBe("click-1");
  });

  it("uses stable IDs before controlled fallback and queues ambiguity", () => {
    const candidates = [
      { id: "1", providerId: "hb-1", email: "a@example.com" },
      { id: "2", providerId: "hb-2", email: "a@example.com" },
    ];
    expect(stableLeadMatch({ providerId: "hb-2" }, candidates)).toMatchObject({ id: "2", key: "providerId" });
    expect(stableLeadMatch({ email: "a@example.com" }, candidates).status).toBe("review");
  });
});
