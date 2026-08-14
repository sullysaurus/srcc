import { createHash } from "node:crypto";

import { dollarsToCents } from "./money";
import {
  normalizeEmail,
  normalizePhone,
  normalizeService,
} from "./normalization";
import { parseCsv } from "./historical-import";

const aliases = {
  projectId: ["project id", "honeybook project id", "project_id"],
  projectUrl: ["project url", "honeybook url", "workspace url", "project link"],
  clientId: ["client id", "honeybook client id", "client_id"],
  projectName: ["project name", "project", "name"],
  clientName: ["client name", "contact", "contacts", "contact name"],
  firstName: ["first name", "firstname"],
  lastName: ["last name", "lastname"],
  email: ["email", "email address", "client email"],
  phone: ["phone", "phone number", "mobile", "client phone"],
  stage: ["stage", "project stage", "pipeline stage", "status"],
  eventDate: ["service date", "event date", "project date", "date"],
  eventType: ["project type", "event type", "type"],
  service: ["service", "services", "service type", "package"],
  leadSource: ["lead source", "source"],
  venue: ["venue", "venue name"],
  city: ["city", "location", "event location"],
  region: ["state", "region"],
  estimatedValue: ["estimated value", "estimate", "project value"],
  proposalValue: ["proposal value", "proposal amount"],
  bookedValue: ["booked value", "contract value", "total value"],
  collected: ["collected", "amount paid", "paid"],
  recentActivityAt: [
    "recent activity date",
    "last communication",
    "last activity date",
  ],
  recentActivityType: [
    "recent activity type",
    "last communication type",
    "last activity type",
  ],
  proposalViewedAt: [
    "proposal viewed date",
    "proposal first viewed",
    "first viewed date",
  ],
} as const;

export const honeyBookStages = [
  { key: "proposal_sent", name: "Proposal sent", order: 1 },
  { key: "completed", name: "Completed", order: 2 },
  { key: "retainer_paid", name: "Retainer paid", order: 3 },
  { key: "planning", name: "Planning", order: 4 },
  { key: "inquiry", name: "Inquiry", order: 5 },
  { key: "follow_up", name: "Follow-up", order: 6 },
  { key: "proposal_signed", name: "Proposal signed", order: 7 },
  { key: "meeting", name: "Meeting", order: 8 },
  { key: "archived", name: "Archived", order: 9 },
] as const;

const stageByLabel = new Map(
  honeyBookStages.flatMap((stage) => [
    [stage.name.toLowerCase(), stage],
    [stage.key.replaceAll("_", " "), stage],
  ]),
);

function parseDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const timestamp = Date.parse(trimmed);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function parseCents(value: string) {
  if (!value.trim()) return null;
  try {
    const cents = dollarsToCents(value);
    return cents >= 0 ? cents : null;
  } catch {
    return null;
  }
}

function projectIdFromUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const queryId =
      url.searchParams.get("project_id") ?? url.searchParams.get("projectId");
    if (queryId) return queryId;
    const match = url.pathname.match(/\/(?:project|projects)\/([^/?#]+)/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(" ") || null,
  };
}

function normalizeServices(value: string) {
  if (!value.trim()) return [];
  const candidates = value
    .split(/[,;/|]+|\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const normalized = candidates.map((part) => normalizeService(part));
  const values = normalized.flatMap((service) =>
    service.value ? [service.value] : [],
  );
  return [...new Set(values)];
}

export type HoneyBookCsvRow = ReturnType<typeof previewHoneyBookCsv>[number];

export function previewHoneyBookCsv(csv: string) {
  const [headerRow, ...rows] = parseCsv(csv);
  if (!headerRow || !rows.length)
    throw new Error("CSV must include a header and at least one project row");
  const headers = headerRow.map((header) => header.trim());
  const normalizedHeaders = headers.map((header) => header.toLowerCase());
  const indexByField = Object.fromEntries(
    Object.entries(aliases).map(([field, names]) => [
      field,
      normalizedHeaders.findIndex((header) => names.includes(header as never)),
    ]),
  ) as Record<keyof typeof aliases, number>;
  const valueAt = (cells: string[], field: keyof typeof aliases) =>
    indexByField[field] >= 0 ? (cells[indexByField[field]] ?? "").trim() : "";

  return rows.map((cells, index) => {
    const rawValues = Object.fromEntries(
      headers.map((header, cellIndex) => [
        header || `Column ${cellIndex + 1}`,
        cells[cellIndex] ?? "",
      ]),
    );
    const projectUrl = valueAt(cells, "projectUrl") || null;
    const projectId =
      valueAt(cells, "projectId") || projectIdFromUrl(projectUrl ?? "");
    const clientName = valueAt(cells, "clientName");
    const names = splitName(clientName);
    const sourceStage = valueAt(cells, "stage");
    const stage = stageByLabel.get(sourceStage.toLowerCase()) ?? null;
    const serviceSource = valueAt(cells, "service");
    const services = normalizeServices(serviceSource);
    const validationErrors = [
      ...(!projectId
        ? ["A HoneyBook Project ID or Project URL is required"]
        : []),
      ...(sourceStage && !stage
        ? [`Unrecognized HoneyBook stage: ${sourceStage}`]
        : []),
      ...(serviceSource && !services.length
        ? [`Unrecognized service: ${serviceSource}`]
        : []),
    ];
    const normalizedValues = {
      projectId,
      projectUrl,
      clientId: valueAt(cells, "clientId") || null,
      projectName:
        valueAt(cells, "projectName") ||
        clientName ||
        `HoneyBook project · row ${index + 2}`,
      firstName: valueAt(cells, "firstName") || names.firstName,
      lastName: valueAt(cells, "lastName") || names.lastName,
      email: normalizeEmail(valueAt(cells, "email")),
      phone: normalizePhone(valueAt(cells, "phone")),
      stageKey: stage?.key ?? null,
      stageName: sourceStage || null,
      stageOrder: stage?.order ?? null,
      eventDate: parseDate(valueAt(cells, "eventDate")),
      eventType: valueAt(cells, "eventType") || null,
      services,
      serviceSource: serviceSource || null,
      leadSource: valueAt(cells, "leadSource") || null,
      venue: valueAt(cells, "venue") || null,
      city: valueAt(cells, "city") || null,
      region: valueAt(cells, "region") || null,
      estimatedValueCents: parseCents(valueAt(cells, "estimatedValue")),
      proposalValueCents: parseCents(valueAt(cells, "proposalValue")),
      bookedValueCents: parseCents(valueAt(cells, "bookedValue")),
      collectedCents: parseCents(valueAt(cells, "collected")),
      recentActivityAt: parseDate(valueAt(cells, "recentActivityAt")),
      recentActivityType: valueAt(cells, "recentActivityType") || null,
      proposalViewedAt: parseDate(valueAt(cells, "proposalViewedAt")),
    };
    return {
      rowNumber: index + 2,
      rawValues,
      normalizedValues,
      validationErrors,
      fingerprint: createHash("sha256")
        .update(JSON.stringify(rawValues))
        .digest("hex"),
    };
  });
}
