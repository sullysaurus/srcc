"use server";

import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { importFormSchema, previewHistoricalCsv } from "@/lib/domain/historical-import";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function importHistoricalCsv(formData: FormData) {
  if (!hasSupabaseEnv) redirect("/imports?error=configure_supabase");
  const file = formData.get("file");
  const fields = importFormSchema.safeParse({ spreadsheetId: formData.get("spreadsheetId"), tab: formData.get("tab") });
  if (!(file instanceof File) || !fields.success || file.size > 5_000_000) redirect("/imports?error=invalid_upload");
  const rows = previewHistoricalCsv(await file.text());
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("organization_memberships").select("organization_id,role").eq("user_id", user.id).eq("status", "active").limit(1).single();
  if (!membership || !["owner","admin","sales","operations"].includes(membership.role)) redirect("/imports?error=forbidden");
  for (const row of rows) {
    const { data: sourceRecord, error } = await supabase.from("source_records").upsert({
      organization_id: membership.organization_id, source_type: "google_sheet", source_spreadsheet_id: fields.data.spreadsheetId,
      source_tab: fields.data.tab, source_row_number: row.rowNumber, raw_values: row.rawValues, normalized_values: row.normalizedValues,
      import_fingerprint: row.fingerprint,
    }, { onConflict: "organization_id,source_type,import_fingerprint", ignoreDuplicates: true }).select("id").maybeSingle();
    if (error) throw new Error("Import failed without changing the source file");
    if (sourceRecord) for (const issue of row.mappingIssues) await supabase.from("mapping_queue").upsert({ organization_id: membership.organization_id, source_record_id: sourceRecord.id, field_name: issue.field, source_value: issue.sourceValue }, { onConflict: "source_record_id,field_name", ignoreDuplicates: true });
  }
  redirect("/mapping-queue?imported=1");
}
