import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { generateOperationalInsights } from "@/lib/automation/generate";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
export async function GET(request: Request) {
  if (!isAuthorizedCron(request))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.from("organizations").select("id");
  if (error)
    return NextResponse.json(
      { error: "organization_lookup_failed" },
      { status: 500 },
    );
  const results = [];
  for (const organization of data ?? []) {
    try {
      results.push({
        organizationId: organization.id,
        ok: true,
        ...(await generateOperationalInsights(organization.id)),
      });
    } catch {
      results.push({ organizationId: organization.id, ok: false });
    }
  }
  return NextResponse.json({ organizations: results.length, results });
}
