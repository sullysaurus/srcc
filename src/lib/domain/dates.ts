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

export function dateKeyInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type,part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function startOfDateInTimeZone(dateKey: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error("Invalid date key");
  const target = Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]));
  const guess = new Date(target);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23" }).formatToParts(guess);
  const value = Object.fromEntries(parts.map(part => [part.type,part.value]));
  const observed = Date.UTC(Number(value.year),Number(value.month)-1,Number(value.day),Number(value.hour),Number(value.minute),Number(value.second));
  return new Date(target-(observed-target)).toISOString();
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error("Invalid date key");
  return new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])+days)).toISOString().slice(0,10);
}
