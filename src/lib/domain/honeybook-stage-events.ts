import { normalizeStage } from "./normalization";

export type HoneyBookProposalMilestone =
  "proposal_sent" | "proposal_viewed" | "proposal_signed";

export function honeyBookProposalMilestone(
  stage: unknown,
): HoneyBookProposalMilestone | null {
  const normalized = normalizeStage(stage).value;
  if (normalized === "Proposal Sent") return "proposal_sent";
  if (normalized === "Proposal Viewed") return "proposal_viewed";
  if (normalized === "Proposal Signed") return "proposal_signed";
  return null;
}
