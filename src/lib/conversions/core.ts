import { createHash } from "node:crypto";

export const conversionGateKeys = [
  "tracking_tested",
  "conversion_action_ownership_confirmed",
  "customer_data_terms_accepted",
  "deduplication_verified",
  "production_uploads_approved",
] as const;

export type ConversionGateKey = (typeof conversionGateKeys)[number];
export type ConversionOutcome =
  "qualified_lead" | "booked_event" | "revenue_collected";

export type ConversionGate = {
  gate: ConversionGateKey;
  satisfied: boolean;
  approvedAt?: string | null;
};

export type ConversionCandidateInput = {
  projectId: string;
  outcome: ConversionOutcome;
  occurredAt: string;
  valueCents: number;
  conversionActionId?: string | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  email?: string | null;
  phone?: string | null;
  eventId?: string | null;
};

export type PreparedConversionCandidate = {
  deduplicationKey: string;
  identifier: {
    type: "gclid" | "gbraid" | "wbraid" | "enhanced_lead";
    value: string;
  } | null;
  userDataHashes: { email?: string; phone?: string };
  errors: string[];
  status: "invalid" | "ready_for_dry_run";
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeEmailForAds(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

export function normalizePhoneForAds(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value.startsWith("+") && digits.length >= 8 ? `+${digits}` : null;
}

export function conversionCandidateKey(
  input: Pick<
    ConversionCandidateInput,
    "projectId" | "outcome" | "occurredAt" | "eventId"
  >,
) {
  const stableEvent =
    input.eventId?.trim() || new Date(input.occurredAt).toISOString();
  return `${input.projectId}:${input.outcome}:${stableEvent}`;
}

export function prepareConversionCandidate(
  input: ConversionCandidateInput,
): PreparedConversionCandidate {
  const errors: string[] = [];
  const occurred = Date.parse(input.occurredAt);
  if (!Number.isFinite(occurred) || occurred > Date.now() + 5 * 60_000)
    errors.push("invalid_conversion_time");
  if (!Number.isSafeInteger(input.valueCents) || input.valueCents < 0)
    errors.push("invalid_value_cents");
  if (!input.conversionActionId)
    errors.push("missing_conversion_action_mapping");

  const email = normalizeEmailForAds(input.email);
  const phone = normalizePhoneForAds(input.phone);
  const userDataHashes = {
    ...(email ? { email: sha256(email) } : {}),
    ...(phone ? { phone: sha256(phone) } : {}),
  };
  const identifier = input.gclid
    ? { type: "gclid" as const, value: input.gclid }
    : input.gbraid
      ? { type: "gbraid" as const, value: input.gbraid }
      : input.wbraid
        ? { type: "wbraid" as const, value: input.wbraid }
        : Object.keys(userDataHashes).length
          ? { type: "enhanced_lead" as const, value: "hashed_user_data" }
          : null;
  if (!identifier) errors.push("missing_attribution_identifier");

  return {
    deduplicationKey: conversionCandidateKey(input),
    identifier,
    userDataHashes,
    errors,
    status: errors.length ? "invalid" : "ready_for_dry_run",
  };
}

export function evaluateUploadGates(
  gates: ConversionGate[],
  runtimeEnabled: boolean,
) {
  const satisfied = new Map(
    gates.map((gate) => [
      gate.gate,
      gate.satisfied && Boolean(gate.approvedAt),
    ]),
  );
  const blockers: string[] = conversionGateKeys.filter(
    (gate) => !satisfied.get(gate),
  );
  if (!runtimeEnabled) blockers.push("runtime_kill_switch");
  return { allowed: blockers.length === 0, blockers };
}

export function dryRunConversion(input: ConversionCandidateInput) {
  const prepared = prepareConversionCandidate(input);
  return {
    ok: prepared.errors.length === 0,
    errors: prepared.errors,
    preview: {
      projectId: input.projectId,
      outcome: input.outcome,
      conversionActionId: input.conversionActionId ?? null,
      occurredAt: input.occurredAt,
      valueCents: input.valueCents,
      identifierType: prepared.identifier?.type ?? null,
      userDataFields: Object.keys(prepared.userDataHashes),
      deduplicationKey: prepared.deduplicationKey,
    },
  };
}
