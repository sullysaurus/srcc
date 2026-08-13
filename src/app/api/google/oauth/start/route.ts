import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createGoogleOAuthRequest, googleProviderSchema, hashOAuthNonce } from "@/lib/integrations/google/oauth";
import { encryptSecret } from "@/lib/integrations/token-crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!env.GOOGLE_CLIENT_ID || !env.APP_URL || !env.OAUTH_STATE_SECRET || !env.OAUTH_TOKEN_ENCRYPTION_KEY) return NextResponse.json({ error:"oauth_not_configured" },{ status:503 });
  const provider = googleProviderSchema.safeParse(new URL(request.url).searchParams.get("provider"));
  if (!provider.success) return NextResponse.json({ error:"invalid_provider" },{ status:400 });
  const supabase = await createServerSupabaseClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login",request.url));
  const { data:membership } = await supabase.from("organization_memberships").select("organization_id,role").eq("user_id",user.id).eq("status","active").in("role",["owner","admin"]).limit(1).maybeSingle();
  if (!membership) return NextResponse.json({ error:"forbidden" },{ status:403 });
  const redirectUri = new URL("/api/google/oauth/callback",env.APP_URL).toString();
  const oauth = createGoogleOAuthRequest({ organizationId:membership.organization_id, provider:provider.data, clientId:env.GOOGLE_CLIENT_ID, redirectUri, stateSecret:env.OAUTH_STATE_SECRET });
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("oauth_states").insert({ organization_id:membership.organization_id, provider:provider.data, nonce_hash:hashOAuthNonce(oauth.nonce), code_verifier_ciphertext:encryptSecret(oauth.verifier,env.OAUTH_TOKEN_ENCRYPTION_KEY), expires_at:new Date(Date.now()+10*60_000).toISOString(), created_by:user.id });
  if (error) return NextResponse.json({ error:"oauth_state_failed" },{ status:500 });
  return NextResponse.redirect(oauth.url);
}
