import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function beginSyncRun(organizationId:string,provider:string,operation:string) {
  const admin=createAdminSupabaseClient();
  const activeSince=new Date(Date.now()-30*60_000).toISOString();
  const {data:active}=await admin.from("sync_runs").select("id").eq("organization_id",organizationId).eq("provider",provider).eq("operation",operation).eq("status","running").gte("started_at",activeSince).limit(1).maybeSingle();
  if(active) return null;
  const {data,error}=await admin.from("sync_runs").insert({organization_id:organizationId,provider,operation,status:"running",started_at:new Date().toISOString(),attempt:1}).select("id").single();
  if(error) throw new Error(`Unable to start ${provider} sync`);
  return data.id as string;
}

export async function finishSyncRun(runId:string,counts:{processed:number;created?:number;updated?:number;skipped?:number;failed?:number},status:"succeeded"|"partial"="succeeded") {
  const admin=createAdminSupabaseClient();
  await admin.from("sync_runs").update({status,completed_at:new Date().toISOString(),processed_count:counts.processed,created_count:counts.created??0,updated_count:counts.updated??0,skipped_count:counts.skipped??0,failed_count:counts.failed??0}).eq("id",runId);
}

export async function failSyncRun(runId:string,provider:string,error:unknown) {
  const admin=createAdminSupabaseClient();
  const summary=error instanceof Error?error.message:`${provider} sync failed`;
  await admin.from("sync_runs").update({status:"failed",completed_at:new Date().toISOString(),failed_count:1,error_code:"provider_failure",error_summary:summary.slice(0,300)}).eq("id",runId);
}
