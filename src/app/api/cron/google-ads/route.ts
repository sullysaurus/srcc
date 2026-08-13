import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { syncGoogleAds } from "@/lib/integrations/google/sync";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request:Request){if(!isAuthorizedCron(request))return NextResponse.json({error:"unauthorized"},{status:401});const admin=createAdminSupabaseClient();const{data,error}=await admin.from("sync_connections").select("organization_id").eq("provider","google_ads").in("status",["connected","degraded","failed"]);if(error)return NextResponse.json({error:"connection_lookup_failed"},{status:500});const organizationIds=[...new Set((data??[]).map(row=>row.organization_id))];const results=[];for(const organizationId of organizationIds){try{results.push({organizationId,ok:true,result:await syncGoogleAds(organizationId)})}catch{results.push({organizationId,ok:false})}}return NextResponse.json({provider:"google_ads",organizations:results.length,succeeded:results.filter(result=>result.ok).length,failed:results.filter(result=>!result.ok).length,results});}
