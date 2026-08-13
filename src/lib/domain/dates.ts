export function inclusiveDays(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error("Invalid date range");
  return Math.round((end - start) / 86_400_000) + 1;
}

export function daysSince(iso: string | null, now = new Date()) {
  if (!iso) return null;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000));
}
