import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const supportedHoneyBookEvent = z.enum([
  "new_inquiry", "client_created", "project_stage_changed", "project_booked", "payment_received", "meeting_scheduled",
]);

const zapierUtcTimestamp = z.preprocess((value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = trimmed.match(
      /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/,
    );
    if (match) return `${match[1]}T${match[2]}${match[3] ?? ""}Z`;
  }
  return value;
}, z.string().datetime());

export const honeyBookWebhookSchema = z.object({
  event: supportedHoneyBookEvent,
  event_id: z.string().min(1),
  occurred_at: zapierUtcTimestamp,
  project_id: z.string().optional(),
  client_id: z.string().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export function verifySharedSecret(provided: string | null, expected: string) {
  if (!provided) return false;
  const actual = Buffer.from(provided);
  const target = Buffer.from(expected);
  return actual.length === target.length && timingSafeEqual(actual, target);
}

export function safeWebhookPayload(payload: z.infer<typeof honeyBookWebhookSchema>) {
  return { event: payload.event, event_id: payload.event_id, occurred_at: payload.occurred_at, project_id: payload.project_id ? "[present]" : undefined, client_id: payload.client_id ? "[present]" : undefined, keys: Object.keys(payload.data) };
}

export const payloadDigest = (raw: string) => createHash("sha256").update(raw).digest("hex");
