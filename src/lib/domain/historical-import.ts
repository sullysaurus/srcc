import { createHash } from "node:crypto";
import { z } from "zod";
import { normalizeService, normalizeStage } from "./normalization";

export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (char === '"' && quoted && csv[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(value); if (row.some(cell => cell.length)) rows.push(row); row = []; value = "";
    } else value += char;
  }
  if (value.length || row.length) { row.push(value); rows.push(row); }
  return rows;
}

const aliases = {
  service: ["service", "service requested", "services"],
  status: ["status", "booking status", "stage"],
} as const;

export function previewHistoricalCsv(csv: string) {
  const [headerRow, ...rows] = parseCsv(csv);
  if (!headerRow || !rows.length) throw new Error("CSV must include a header and at least one data row");
  const headers = headerRow.map(header => header.trim());
  const canonicalHeaders = headers.map(header => header.toLowerCase());
  const findIndex = (values: readonly string[]) => canonicalHeaders.findIndex(header => values.includes(header));
  const serviceIndex = findIndex(aliases.service);
  const statusIndex = findIndex(aliases.status);
  return rows.map((cells, index) => {
    const rawValues = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? ""]));
    const service = normalizeService(serviceIndex >= 0 ? cells[serviceIndex] : "");
    const stage = normalizeStage(statusIndex >= 0 ? cells[statusIndex] : "");
    const fingerprint = createHash("sha256").update(JSON.stringify(rawValues)).digest("hex");
    return {
      rowNumber: index + 2,
      rawValues,
      normalizedValues: { service: service.value, stage: stage.value },
      mappingIssues: [
        ...(service.requiresReview ? [{ field: "service", sourceValue: service.original }] : []),
        ...(stage.requiresReview ? [{ field: "status", sourceValue: stage.original }] : []),
      ],
      fingerprint,
    };
  });
}

export const importFormSchema = z.object({
  spreadsheetId: z.string().min(10),
  tab: z.string().min(1).default("Leads"),
});
