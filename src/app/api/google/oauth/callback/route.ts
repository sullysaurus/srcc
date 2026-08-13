import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { googleTokenResponseSchema, hashOAuthNonce, parseGoogleOAuthState } from "@/lib/integrations/google/oauth";
import { decryptSecret, encryptSecret } from "@/lib/integrations/token-crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const stateValue = requestUrl.searchParams.get("state");
  const code = requestUrl.searchParams.get("code");
  if (!stateValue || !code || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.APP_URL || !env.OAUTH_STATE_SECRET || !env.OAUTH_TOKEN_ENCRYPTION_KEY) return NextResponse.redirect(new URL("/integrations?error=oauth_configuration",requestUrl.origin));
  const state = parseGoogleOAuthState(stateValue,env.OAUTH_STATE_SECRET);
  if (!state) return NextResponse.redirect(new URL("/integrations?error=oauth_state",requestUrl.origin));
  const admin = createAdminSupabaseClient();
  const { data:stored } = await admin.from("oauth_states").select("id,code_verifier_ciphertext,expires_at,consumed_at").eq("organization_id",state.organizationId).eq("provider",state.provider).eq("nonce_hash",hashOAuthNonce(state.nonce)).maybeSingle();
  if (!stored || stored.consumed_at || Date.parse(stored.expires_at)<Date.now()) return NextResponse.redirect(new URL("/integrations?error=oauth_replay",requestUrl.origin));
  const verifier = decryptSecret(String(stored.code_verifier_ciphertext),env.OAUTH_TOKEN_ENCRYPTION_KEY);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token",{ method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({ code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:new URL("/api/google/oauth/callback",env.APP_URL).toString(),grant_type:"authorization_code",code_verifier:verifier }),cache:"no-store" });
  const token = googleTokenResponseSchema.safeParse(await tokenResponse.json());
  if (!tokenResponse.ok || !token.success) return NextResponse.redirect(new URL("/integrations?error=oauth_exchange",requestUrl.origin));
  const { data:existing } = await admin.from("sync_connections").select("encrypted_refresh_token").eq("organization_id",state.organizationId).eq("provider",state.provider).maybeSingle();
  const encryptedRefreshToken = token.data.refresh_token ? encryptSecret(token.data.refresh_token,env.OAUTH_TOKEN_ENCRYPTION_KEY) : existing?.encrypted_refresh_token;
  if (!encryptedRefreshToken) return NextResponse.redirect(new URL("/integrations?error=missing_refresh_token",requestUrl.origin));
  const configuration = state.provider === "google_ads" ? { customerId:env.GOOGLE_ADS_CUSTOMER_ID,managerCustomerId:env.GOOGLE_ADS_MANAGER_CUSTOMER_ID,grantedScope:token.data.scope } : state.provider === "search_console" ? { propertyUri:env.GOOGLE_SEARCH_CONSOLE_PROPERTY,grantedScope:token.data.scope } : { grantedScope:token.data.scope,metadataOnly:true };
  const [{ error:connectionError }] = await Promise.all([
    admin.from("sync_connections").upsert({ organization_id:state.organizationId,provider:state.provider,display_name:state.provider==="google_ads"?"Google Ads":state.provider==="search_console"?"Search Console":"Company Gmail",status:"connected",configuration,encrypted_refresh_token:encryptedRefreshToken,token_key_version:1,last_attempt_at:new Date().toISOString() },{ onConflict:"organization_id,provider" }),
    admin.from("oauth_states").update({ consumed_at:new Date().toISOString() }).eq("id",stored.id),
    admin.from("audit_log").insert({ organization_id:state.organizationId,action:"integration.connected",entity_type:"sync_connection",reason:`${state.provider} OAuth authorization completed` }),
  ]);
  return NextResponse.redirect(new URL(connectionError?"/integrations?error=connection_save":"/integrations?connected=1",requestUrl.origin));
}
