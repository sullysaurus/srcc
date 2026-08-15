import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  inclusiveDays,
} from "@/lib/domain/dates";

export type ReportingRangeParams = {
  days?: string;
  from?: string;
  to?: string;
};

export type ReportingRange = {
  from: string;
  to: string;
  compareFrom: string;
  compareTo: string;
  days: number;
  preset: string;
};

export function validReportingDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? ""
    : value;
}

export function resolveReportingRange(
  params: ReportingRangeParams = {},
  options: {
    defaultDays?: number;
    lagDays?: number;
    now?: Date;
    timeZone?: string;
  } = {},
): ReportingRange {
  const defaultDays = options.defaultDays ?? 30;
  const lagDays = options.lagDays ?? 1;
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? "America/Chicago";
  const defaultTo = addDaysToDateKey(
    dateKeyInTimeZone(now, timeZone),
    -lagDays,
  );
  const from = validReportingDate(params.from);
  const to = validReportingDate(params.to);

  if (from && to && from <= to) {
    const days = inclusiveDays(from, to);
    return {
      from,
      to,
      compareFrom: addDaysToDateKey(from, -days),
      compareTo: addDaysToDateKey(from, -1),
      days,
      preset: "custom",
    };
  }

  const requestedDays = Number(params.days);
  const days = [7, 30, 90, 365].includes(requestedDays)
    ? requestedDays
    : defaultDays;
  const rangeFrom = addDaysToDateKey(defaultTo, -(days - 1));
  return {
    from: rangeFrom,
    to: defaultTo,
    compareFrom: addDaysToDateKey(rangeFrom, -days),
    compareTo: addDaysToDateKey(rangeFrom, -1),
    days,
    preset: String(days),
  };
}

export function percentChange(current: number, previous: number) {
  if (!previous) return current ? null : 0;
  return (current - previous) / previous;
}
