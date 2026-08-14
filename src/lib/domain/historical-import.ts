import { createHash } from "node:crypto";
import { z } from "zod";
import { dollarsToCents } from "./money";
import {
  normalizeEmail,
  normalizePhone,
  normalizeService,
  normalizeStage,
} from "./normalization";

export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (char === '"' && quoted && csv[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.length)) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

const aliases = {
  name: ["name", "lead name", "client name", "contact name", "client"],
  firstName: ["first name", "firstname"],
  lastName: ["last name", "lastname"],
  email: ["email", "email address", "client email"],
  phone: ["phone", "phone number", "mobile", "cell", "client phone"],
  eventType: ["event type", "type of event", "project type", "type"],
  service: ["service", "service requested", "services", "booth wanted"],
  status: ["status", "booking status", "stage", "booked?"],
  leadDate: ["lead date", "inquiry date", "date received", "created date"],
  leadSource: ["lead source", "source", "how did you hear about us"],
  eventDate: ["event date", "date of event"],
  venue: ["venue", "venue name"],
  location: ["location", "event location", "city"],
  notes: [
    "notes",
    "note",
    "comments",
    "follow up notes",
    "follow-up notes",
    "other notes",
  ],
  phoneFollowUp: ["phone?", "phone follow up", "phone follow-up"],
  textFollowUp: ["text?", "text follow up", "text follow-up"],
  estimatedValue: ["estimated value", "estimate", "project value", "value"],
  bookedValue: ["booked value", "booking value", "contract value"],
  collected: ["collected", "amount paid", "paid"],
  nextFollowUp: [
    "next follow up",
    "next follow-up",
    "follow up date",
    "follow-up date",
  ],
} as const;

function parseDateValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const shortDate = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(trimmed);
  if (shortDate) {
    const year =
      shortDate[3].length === 2
        ? 2000 + Number(shortDate[3])
        : Number(shortDate[3]);
    const month = Number(shortDate[1]);
    const day = Number(shortDate[2]);
    const candidate = new Date(Date.UTC(year, month - 1, day, 12));
    if (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    )
      return candidate.toISOString();
    return null;
  }
  const timestamp = Date.parse(trimmed);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function parseMoneyValue(value: string) {
  if (!value.trim()) return null;
  try {
    return dollarsToCents(value);
  } catch {
    return null;
  }
}

export function previewHistoricalCsv(csv: string) {
  const [headerRow, ...rows] = parseCsv(csv);
  if (!headerRow || !rows.length)
    throw new Error("CSV must include a header and at least one data row");
  const headers = headerRow.map((header) => header.trim());
  const canonicalHeaders = headers.map((header) => header.toLowerCase());
  const findIndex = (values: readonly string[]) =>
    canonicalHeaders.findIndex((header) => values.includes(header));
  const indexes = Object.fromEntries(
    Object.entries(aliases).map(([key, values]) => [key, findIndex(values)]),
  ) as Record<keyof typeof aliases, number>;
  const valueAt = (cells: string[], field: keyof typeof aliases) =>
    indexes[field] >= 0 ? (cells[indexes[field]] ?? "").trim() : "";
  return rows.map((cells, index) => {
    const rawValues = Object.fromEntries(
      headers.map((header, cellIndex) => [header, cells[cellIndex] ?? ""]),
    );
    const service = normalizeService(valueAt(cells, "service"));
    const stage = normalizeStage(valueAt(cells, "status"));
    const leadName = valueAt(cells, "name");
    const splitName = leadName.split(/\s+/).filter(Boolean);
    const firstName = valueAt(cells, "firstName") || splitName[0] || "";
    const lastName = valueAt(cells, "lastName") || splitName.slice(1).join(" ");
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(rawValues))
      .digest("hex");
    return {
      rowNumber: index + 2,
      rawValues,
      normalizedValues: {
        leadName:
          leadName || [firstName, lastName].filter(Boolean).join(" ") || null,
        firstName: firstName || null,
        lastName: lastName || null,
        email: normalizeEmail(valueAt(cells, "email")),
        phone: normalizePhone(valueAt(cells, "phone")),
        eventType: valueAt(cells, "eventType") || null,
        service: service.value,
        stage: stage.value,
        leadDate: parseDateValue(valueAt(cells, "leadDate")),
        leadSource: valueAt(cells, "leadSource") || null,
        eventDate: parseDateValue(valueAt(cells, "eventDate")),
        venue: valueAt(cells, "venue") || null,
        location: valueAt(cells, "location") || null,
        notes: valueAt(cells, "notes") || null,
        estimatedValueCents: parseMoneyValue(valueAt(cells, "estimatedValue")),
        bookedValueCents: parseMoneyValue(valueAt(cells, "bookedValue")),
        collectedCents: parseMoneyValue(valueAt(cells, "collected")),
        nextFollowUpAt: parseDateValue(valueAt(cells, "nextFollowUp")),
        phoneFollowUp: valueAt(cells, "phoneFollowUp") || null,
        textFollowUp: valueAt(cells, "textFollowUp") || null,
      },
      mappingIssues: [
        ...(service.original && service.requiresReview
          ? [{ field: "service", sourceValue: service.original }]
          : []),
        ...(stage.original && stage.requiresReview
          ? [{ field: "status", sourceValue: stage.original }]
          : []),
      ],
      fingerprint,
    };
  });
}

export const importFormSchema = z.object({
  spreadsheetId: z.string().min(10),
  tab: z.string().min(1).default("Leads"),
});
