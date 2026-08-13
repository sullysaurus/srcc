import { env } from "@/lib/env";
import { decryptSecret } from "@/lib/integrations/token-crypto";
import { googleTokenResponseSchema } from "./oauth";
import { providerFetch } from "./http";

export async function refreshGoogleAccessToken(encryptedRefreshToken: string) {
  if (!env.OAUTH_TOKEN_ENCRYPTION_KEY || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new Error("Google OAuth refresh is not configured");
  const refreshToken = decryptSecret(encryptedRefreshToken,env.OAUTH_TOKEN_ENCRYPTION_KEY);
  const response = await providerFetch("https://oauth2.googleapis.com/token",{ method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({ client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:refreshToken,grant_type:"refresh_token" }) },"google_oauth",2);
  const parsed = googleTokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Google OAuth returned an invalid token response");
  return parsed.data.access_token;
}
