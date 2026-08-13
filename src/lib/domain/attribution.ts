export type Touch = {
  occurredAt: string;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
};

const isDirect = (touch: Touch) => !touch.source || touch.source.toLowerCase() === "direct";

export function selectAttribution(touches: Touch[]) {
  const ordered = [...touches].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const firstTouch = ordered[0] ?? null;
  const paidClick = [...ordered].reverse().find((touch) => touch.gclid || touch.gbraid || touch.wbraid) ?? null;
  const lastNonDirect = [...ordered].reverse().find((touch) => !isDirect(touch)) ?? firstTouch;
  return { firstTouch, lastNonDirect, paidClick };
}

export function stableLeadMatch(
  incoming: { providerId?: string; email?: string; phone?: string },
  candidates: Array<{ id: string; providerId?: string; email?: string; phone?: string }>,
) {
  if (incoming.providerId) {
    const match = candidates.find((candidate) => candidate.providerId === incoming.providerId);
    if (match) return { status: "matched" as const, id: match.id, key: "providerId" as const };
  }
  const normalizedEmail = incoming.email?.trim().toLowerCase();
  const normalizedPhone = incoming.phone?.replace(/\D/g, "");
  const matches = candidates.filter(
    (candidate) =>
      (normalizedEmail && candidate.email?.trim().toLowerCase() === normalizedEmail) ||
      (normalizedPhone && candidate.phone?.replace(/\D/g, "") === normalizedPhone),
  );
  return matches.length === 1
    ? { status: "matched" as const, id: matches[0].id, key: "controlledFallback" as const }
    : { status: "review" as const, candidates: matches.map((match) => match.id) };
}
