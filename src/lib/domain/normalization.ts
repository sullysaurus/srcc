import { z } from "zod";

import type { PipelineStage, ServiceName } from "./types";

const clean = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[&+]/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const serviceAliases: Record<string, ServiceName> = {
  "photo booth": "Photo Booth",
  photobooth: "Photo Booth",
  booth: "Photo Booth",
  "360": "360 Booth",
  "360 booth": "360 Booth",
  glambot: "GlamBOT",
  "glam bot": "GlamBOT",
  "dance floor": "Dance Floor",
  dancefloor: "Dance Floor",
  bar: "Bar Services",
  "bar service": "Bar Services",
  "bar services": "Bar Services",
  margarita: "Margarita Machine",
  "margarita machine": "Margarita Machine",
};

const stageAliases: Record<string, PipelineStage> = {
  new: "Inquiry",
  inquiry: "Inquiry",
  "new inquiry": "Inquiry",
  contacted: "Contacted",
  qualified: "Qualified",
  "proposal sent": "Proposal Sent",
  proposal: "Proposal Sent",
  followup: "Follow-up",
  "follow up": "Follow-up",
  signed: "Proposal Signed",
  "proposal signed": "Proposal Signed",
  meeting: "Meeting",
  booked: "Retainer Paid",
  "retainer paid": "Retainer Paid",
  planning: "Planning",
  complete: "Completed",
  completed: "Completed",
  lost: "Lost",
  declined: "Lost",
  no: "Lost",
  "no booking": "Lost",
  "not going to book": "Lost",
  "priced too high": "Lost",
  "bride wants to go another direction": "Lost",
  "no response": "Follow-up",
  "no response yet": "Follow-up",
  "waiting for response": "Follow-up",
  "yes responded": "Contacted",
  "sent proposal file": "Proposal Sent",
  "looking at proposal file": "Proposal Sent",
  archived: "Archived",
};

export type NormalizedValue<T> = {
  original: string;
  value: T | null;
  confidence: "exact" | "rule" | "ambiguous";
  requiresReview: boolean;
};

export function normalizeService(input: unknown): NormalizedValue<ServiceName> {
  const original = String(input ?? "").trim();
  const normalized = clean(input);
  const direct = serviceAliases[normalized];
  if (direct)
    return {
      original,
      value: direct,
      confidence: "exact",
      requiresReview: false,
    };

  const matches = Object.entries(serviceAliases)
    .filter(([alias]) => normalized.includes(alias))
    .map(([, value]) => value)
    .filter((value, index, list) => list.indexOf(value) === index);

  if (matches.length > 1) {
    return {
      original,
      value: "Multiple Services",
      confidence: "rule",
      requiresReview: false,
    };
  }
  if (matches.length === 1) {
    return {
      original,
      value: matches[0],
      confidence: "rule",
      requiresReview: false,
    };
  }
  return {
    original,
    value: null,
    confidence: "ambiguous",
    requiresReview: true,
  };
}

export function normalizeStage(input: unknown): NormalizedValue<PipelineStage> {
  const original = String(input ?? "").trim();
  const normalized = clean(input);
  const value =
    stageAliases[normalized] ??
    (normalized.startsWith("will call ") ? "Follow-up" : undefined);
  return value
    ? { original, value, confidence: "exact", requiresReview: false }
    : { original, value: null, confidence: "ambiguous", requiresReview: true };
}

export const sourceRowSchema = z.object({
  sourceSpreadsheetId: z.string().min(1),
  sourceTab: z.string().min(1),
  sourceRowNumber: z.number().int().positive(),
  rawValues: z.record(z.string(), z.unknown()),
  importedAt: z.string().datetime(),
});

export function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

export function normalizePhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length ? `+${digits}` : null;
}
