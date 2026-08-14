import { describe, expect, it } from "vitest";
import { createGoogleOAuthRequest, parseGoogleOAuthState } from "./oauth";

describe("Google OAuth request", () => {
  it("uses provider-minimal scopes, PKCE, offline access, and signed expiring state", () => {
    const result = createGoogleOAuthRequest({ organizationId:"20000000-0000-4000-8000-000000000001", provider:"search_console", clientId:"client", redirectUri:"https://app.example.com/api/google/oauth/callback", stateSecret:"state-secret" });
    expect(result.url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/webmasters.readonly");
    expect(result.url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(result.url.searchParams.get("access_type")).toBe("offline");
    expect(parseGoogleOAuthState(result.state,"state-secret")?.provider).toBe("search_console");
    expect(parseGoogleOAuthState(`${result.state}x`,"state-secret")).toBeNull();
  });
  it("uses metadata-only Gmail access",()=>{const result=createGoogleOAuthRequest({organizationId:"20000000-0000-4000-8000-000000000001",provider:"gmail",clientId:"client",redirectUri:"https://app.example.com/api/google/oauth/callback",stateSecret:"state-secret"});expect(result.url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/gmail.metadata")});
  it("uses read-only Google Sheets access",()=>{const result=createGoogleOAuthRequest({organizationId:"20000000-0000-4000-8000-000000000001",provider:"google_sheets",clientId:"client",redirectUri:"https://app.example.com/api/google/oauth/callback",stateSecret:"state-secret"});expect(result.url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/spreadsheets.readonly")});
});
