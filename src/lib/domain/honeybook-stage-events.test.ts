import { describe, expect, it } from "vitest";

import { honeyBookProposalMilestone } from "./honeybook-stage-events";

describe("HoneyBook proposal stage events", () => {
  it("recognizes the proposal lifecycle stages used by HoneyBook automations", () => {
    expect(honeyBookProposalMilestone("Proposal sent")).toBe("proposal_sent");
    expect(honeyBookProposalMilestone("Proposal viewed")).toBe(
      "proposal_viewed",
    );
    expect(honeyBookProposalMilestone("Proposal signed")).toBe(
      "proposal_signed",
    );
  });

  it("does not turn unrelated stage changes into proposal activity", () => {
    expect(honeyBookProposalMilestone("Planning")).toBeNull();
    expect(honeyBookProposalMilestone("Follow-up")).toBeNull();
  });
});
