export const PIPELINE_STAGES = [
  "Inquiry",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Follow-up",
  "Proposal Signed",
  "Retainer Paid",
  "Planning",
  "Completed",
  "Lost",
  "Archived",
] as const;

export const SERVICES = [
  "Photo Booth",
  "360 Booth",
  "GlamBOT",
  "Dance Floor",
  "Bar Services",
  "Margarita Machine",
  "Multiple Services",
  "Unknown",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export type ServiceName = (typeof SERVICES)[number];
export type DataSource =
  | "HoneyBook"
  | "Derived"
  | "Manual"
  | "Google Sheet"
  | "Google Ads"
  | "Search Console"
  | "Email";

export interface ProjectSummary {
  id: string;
  name: string;
  eventType: string;
  stage: PipelineStage;
  services: ServiceName[];
  source: string;
  owner: string;
  eventDate: string;
  venue: string;
  location: string;
  estimatedCents: number;
  bookedCents: number;
  collectedCents: number;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  proposalStatus: "Not sent" | "Sent" | "Viewed" | "Signed";
  temperature: "Hot" | "Warm" | "Cool";
  attribution: string;
}
