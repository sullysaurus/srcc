import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export const getOrganizationContext = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id,role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return membership
    ? {
        supabase,
        user,
        organizationId: membership.organization_id as string,
        role: membership.role as string,
      }
    : null;
});

export async function requireOrganizationContext(roles?: string[]) {
  const context = await getOrganizationContext();
  if (!context) redirect("/login");
  if (roles && !roles.includes(context.role)) throw new Error("Forbidden");
  return context;
}
