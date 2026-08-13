import { describe, expect, it } from "vitest";
import { signOAuthState, validateOAuthState } from "./oauth-state";

describe("OAuth state validation", () => {
  it("accepts an authentic state and rejects tampering", () => {
    const state = signOAuthState("org-1:nonce", "test-secret");
    expect(validateOAuthState(state, "test-secret")).toBe(true);
    expect(validateOAuthState(`${state}x`, "test-secret")).toBe(false);
  });
});
