import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { signOAuthState, validateOAuthState } from "@/lib/domain/oauth-state";

export const googleProviderSchema = z.enum([
  "google_ads",
  "search_console",
  "gmail",
  "google_sheets",
]);
export type GoogleProvider = z.infer<typeof googleProviderSchema>;

const scopes: Record<GoogleProvider, string[]> = {
  google_ads: ["https://www.googleapis.com/auth/adwords"],
  search_console: ["https://www.googleapis.com/auth/webmasters.readonly"],
  gmail: ["https://www.googleapis.com/auth/gmail.metadata"],
  google_sheets: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
};

const statePayloadSchema = z.object({
  organizationId: z.string().uuid(),
  provider: googleProviderSchema,
  nonce: z.string().min(20),
  expiresAt: z.number().int(),
});

export const googleTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
  token_type: z.string().default("Bearer"),
});

export function createGoogleOAuthRequest(input: {
  organizationId: string;
  provider: GoogleProvider;
  clientId: string;
  redirectUri: string;
  stateSecret: string;
}) {
  const nonce = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      organizationId: input.organizationId,
      provider: input.provider,
      nonce,
      expiresAt: Date.now() + 10 * 60_000,
    }),
  ).toString("base64url");
  const state = signOAuthState(payload, input.stateSecret);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: scopes[input.provider].join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return { url, state, nonce, verifier };
}

export function parseGoogleOAuthState(state: string, stateSecret: string) {
  if (!validateOAuthState(state, stateSecret)) return null;
  const payload = state.slice(0, state.lastIndexOf("."));
  const parsed = statePayloadSchema.safeParse(
    JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
  );
  if (!parsed.success || parsed.data.expiresAt < Date.now()) return null;
  return parsed.data;
}

export const hashOAuthNonce = (nonce: string) =>
  createHash("sha256").update(nonce).digest("hex");
