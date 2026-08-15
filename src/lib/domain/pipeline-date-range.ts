const pipelineDateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Chicago",
});

export function pipelineDateKey(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
    pipelineDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function validPipelineDateParam(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? ""
    : value;
}

export function shiftPipelineDate(value: string, days: number) {
  const validValue = validPipelineDateParam(value);
  if (!validValue) return "";
  const [year, month, day] = validValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function pipelineYearEnd(value: string) {
  const validValue = validPipelineDateParam(value);
  return validValue ? `${validValue.slice(0, 4)}-12-31` : "";
}

export function isInPipelineDateRange(
  value: string | null,
  fromDate: string,
  toDate: string,
) {
  if (!fromDate && !toDate) return true;
  const eventDate = pipelineDateKey(value);
  if (!eventDate) return false;
  if (fromDate && eventDate < fromDate) return false;
  if (toDate && eventDate > toDate) return false;
  return true;
}
