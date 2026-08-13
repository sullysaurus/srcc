import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron-auth";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error:"unauthorized" }, { status:401 });
  const supabase = createAdminSupabaseClient();
  const staleBefore = new Date(Date.now()-48*60*60*1000).toISOString();
  const { data, error } = await supabase.from("sync_connections").select("id,organization_id,provider,status,last_success_at").in("status",["connected","degraded","failed"]);
  if (error) return NextResponse.json({ error:"health_check_failed" }, { status:500 });
  const unhealthy = (data ?? []).filter(connection => connection.status !== "connected" || !connection.last_success_at || connection.last_success_at < staleBefore);
  const admin=createAdminSupabaseClient();
  for(const connection of data??[]){const isUnhealthy=unhealthy.some(item=>item.id===connection.id);if(isUnhealthy)await admin.from("integration_health_issues").upsert({organization_id:connection.organization_id,connection_id:connection.id,provider:connection.provider,issue_key:"stale_or_failed_sync",entity_provider_id:connection.id,severity:connection.status==="failed"?"critical":"warning",title:connection.status==="failed"?"Integration sync failed":"Integration data is stale",detail:connection.last_success_at?`Last successful sync: ${connection.last_success_at}`:"No successful synchronization has been recorded.",last_detected_at:new Date().toISOString(),resolved_at:null},{onConflict:"organization_id,provider,issue_key,entity_provider_id"});else await admin.from("integration_health_issues").update({resolved_at:new Date().toISOString()}).eq("organization_id",connection.organization_id).eq("provider",connection.provider).eq("issue_key","stale_or_failed_sync").eq("entity_provider_id",connection.id).is("resolved_at",null);}
  return NextResponse.json({ checked:(data ?? []).length, unhealthy:unhealthy.length, generatedAt:new Date().toISOString() });
}
