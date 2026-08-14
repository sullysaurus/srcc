import { describe, expect, it } from "vitest";
import { honeyBookWebhookSchema, safeWebhookPayload, verifySharedSecret } from "./honeybook-webhook";

describe("HoneyBook webhook boundary", () => {
  it("accepts supported triggers and removes customer identifiers from retained payloads", () => {
    const payload = honeyBookWebhookSchema.parse({ event:"project_booked", event_id:"evt-1", occurred_at:"2026-08-13T12:00:00Z", project_id:"secret-id", data:{ email:"client@example.com" } });
    expect(safeWebhookPayload(payload)).toMatchObject({ project_id:"[present]", keys:["email"] });
  });
  it("performs constant-time shared secret validation", () => {
    expect(verifySharedSecret("correct", "correct")).toBe(true);
    expect(verifySharedSecret("wrong", "correct")).toBe(false);
  });
  it("rejects capabilities not exposed by the supported trigger list", () => {
    expect(honeyBookWebhookSchema.safeParse({ event:"proposal_viewed", event_id:"1", occurred_at:"2026-08-13T12:00:00Z" }).success).toBe(false);
  });
  it("normalizes Zapier's UTC timestamp format", () => {
    const payload = honeyBookWebhookSchema.parse({
      event: "new_inquiry",
      event_id: "evt-2",
      occurred_at: "2026-08-14 14:23:13",
    });
    expect(payload.occurred_at).toBe("2026-08-14T14:23:13Z");
  });
});
