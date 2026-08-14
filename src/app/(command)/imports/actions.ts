"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { hasSupabaseEnv } from "@/lib/env";
import {
  importFormSchema,
  previewHistoricalCsv,
} from "@/lib/domain/historical-import";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { ingestHistoricalRows } from "@/lib/imports/historical-ingestion";
import { refreshGoogleAccessToken } from "@/lib/integrations/google/tokens";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const sheetResponseSchema = z.object({
  values: z.array(
    z
      .array(z.union([z.string(), z.number(), z.boolean()]))
      .transform((row) => row.map(String)),
  ),
});

const allowedRoles = ["owner", "admin", "sales", "operations"];

function rowsToCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((value) =>
          /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value,
        )
        .join(","),
    )
    .join("\r\n");
}

export async function importHistoricalCsv(formData: FormData) {
  if (!hasSupabaseEnv) redirect("/imports?error=configure_supabase");
  const file = formData.get("file");
  const fields = importFormSchema.safeParse({
    spreadsheetId: formData.get("spreadsheetId"),
    tab: formData.get("tab"),
  });
  if (!(file instanceof File) || !fields.success || file.size > 5_000_000)
    redirect("/imports?error=invalid_upload");
  const rows = previewHistoricalCsv(await file.text());
  const context = await requireOrganizationContext(allowedRoles);
  const result = await ingestHistoricalRows(createAdminSupabaseClient(), {
    organizationId: context.organizationId,
    userId: context.user.id,
    spreadsheetId: fields.data.spreadsheetId,
    tab: fields.data.tab,
    rows,
  });
  redirect(
    `/imports?imported=${result.processed}&created=${result.created}&updated=${result.updated}&mappings=${result.mappingIssues}`,
  );
}

export async function importConnectedGoogleSheet(formData: FormData) {
  if (!hasSupabaseEnv) redirect("/imports?error=configure_supabase");
  const fields = importFormSchema.safeParse({
    spreadsheetId:
      formData.get("spreadsheetId") || env.GOOGLE_SHEETS_SPREADSHEET_ID,
    tab: formData.get("tab") || "Leads",
  });
  if (!fields.success) redirect("/imports?error=invalid_sheet");
  const context = await requireOrganizationContext(allowedRoles);
  const admin = createAdminSupabaseClient();
  const { data: connection } = await admin
    .from("sync_connections")
    .select("encrypted_refresh_token")
    .eq("organization_id", context.organizationId)
    .eq("provider", "google_sheets")
    .eq("status", "connected")
    .maybeSingle();
  if (!connection?.encrypted_refresh_token)
    redirect("/imports?error=connect_google_sheets");
  const accessToken = await refreshGoogleAccessToken(
    String(connection.encrypted_refresh_token),
  );
  const range = encodeURIComponent(`${fields.data.tab}!A:ZZ`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fields.data.spreadsheetId)}/values/${range}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`,
    { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  const parsed = sheetResponseSchema.safeParse(await response.json());
  if (!response.ok || !parsed.success)
    redirect("/imports?error=sheet_read_failed");
  const rows = previewHistoricalCsv(rowsToCsv(parsed.data.values));
  const result = await ingestHistoricalRows(admin, {
    organizationId: context.organizationId,
    userId: context.user.id,
    spreadsheetId: fields.data.spreadsheetId,
    tab: fields.data.tab,
    rows,
  });
  await admin
    .from("sync_connections")
    .update({
      last_attempt_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      status: "connected",
    })
    .eq("organization_id", context.organizationId)
    .eq("provider", "google_sheets");
  redirect(
    `/imports?imported=${result.processed}&created=${result.created}&updated=${result.updated}&mappings=${result.mappingIssues}`,
  );
}
