import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CloudDownload,
  FileSpreadsheet,
  Link2,
  LockKeyhole,
  UploadCloud,
} from "lucide-react";

import { getOrganizationContext } from "@/lib/auth/organization-context";
import { importConnectedGoogleSheet, importHistoricalCsv } from "./actions";

const spreadsheetId = "1lUTpjMwMqTqh9y4N9bEHAL1lyeh0swt1i0KmaAdXuOc";

const errorMessages: Record<string, string> = {
  configure_supabase: "Supabase must be configured before importing.",
  invalid_upload: "Choose a valid CSV file smaller than 5 MB.",
  invalid_sheet: "The spreadsheet ID or tab is invalid.",
  connect_google_sheets:
    "Connect Google Sheets first, then run the import again.",
  sheet_read_failed:
    "Google could not read that spreadsheet. Confirm the connected account can open it.",
};

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const context = await getOrganizationContext();
  const [
    { data: connection },
    { count: retainedRows },
    { count: pendingMappings },
  ] = context
    ? await Promise.all([
        context.supabase
          .from("sync_connections")
          .select("status,last_success_at")
          .eq("organization_id", context.organizationId)
          .eq("provider", "google_sheets")
          .maybeSingle(),
        context.supabase
          .from("source_records")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", context.organizationId)
          .eq("source_type", "google_sheet"),
        context.supabase
          .from("mapping_queue")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", context.organizationId)
          .eq("status", "pending"),
      ])
    : [{ data: null }, { count: 0 }, { count: 0 }];
  const connected = connection?.status === "connected";

  return (
    <div className="pb-20 lg:pb-0">
      <div className="mb-7">
        <p className="font-mono text-[9px] font-bold tracking-[.15em] text-coral uppercase">
          Data intake / Manual or connected
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-[-.04em] sm:text-5xl">
          Bring every lead forward safely.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/52">
          Use the connected Sheet when you want a free Zapier alternative, or
          upload a CSV. Every version retains its source row and raw values.
        </p>
      </div>
      {params.error ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-coral/35 bg-[#fff0e9] px-4 py-3 text-xs font-bold text-[#8f3b32]"
        >
          {errorMessages[params.error] ?? "The import could not be completed."}
        </div>
      ) : null}
      {params.imported ? (
        <div className="mb-5 rounded-xl border border-moss/30 bg-[#edf6e9] px-4 py-3 text-xs text-moss">
          <strong>{params.imported} rows processed.</strong>{" "}
          {params.created ?? "0"} created, {params.updated ?? "0"} updated, and{" "}
          {params.mappings ?? "0"} mapping decisions queued.
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <section className="paper rounded-xl border p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#e3f0df] text-moss">
                <CloudDownload className="size-6" />
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold">
                    Import directly from Google Sheets
                  </p>
                  <span
                    className={`rounded-full border px-2 py-1 font-mono text-[8px] font-bold uppercase ${connected ? "border-moss/25 bg-moss/8 text-moss" : "bg-white text-ink/45"}`}
                  >
                    {connected ? "Connected" : "Not connected"}
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-5 text-ink/45">
                  Read-only access. Nothing in the workbook is changed.
                </p>
              </div>
              {connected ? (
                <form action={importConnectedGoogleSheet}>
                  <input
                    type="hidden"
                    name="spreadsheetId"
                    value={spreadsheetId}
                  />
                  <input type="hidden" name="tab" value="Leads" />
                  <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-xs font-bold text-white">
                    Import latest rows <ArrowRight className="size-4" />
                  </button>
                </form>
              ) : (
                <a
                  href="/api/google/oauth/start?provider=google_sheets"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-xs font-bold text-white"
                >
                  <Link2 className="size-4" /> Connect Google Sheets
                </a>
              )}
            </div>
            <div className="mt-5 rounded-lg border bg-white/45 px-4 py-3">
              <p className="text-[9px] font-bold text-ink/45">
                Configured source
              </p>
              <p className="mt-1 break-all font-mono text-[9px] text-ink/55">
                {spreadsheetId} · Leads
              </p>
              {connection?.last_success_at ? (
                <p className="mt-2 text-[9px] text-moss">
                  Last successful import:{" "}
                  {new Date(connection.last_success_at).toLocaleString(
                    "en-US",
                    { timeZone: "America/Chicago" },
                  )}{" "}
                  CT
                </p>
              ) : null}
            </div>
          </section>
          <section className="paper rounded-xl border p-6">
            <div className="flex items-start gap-4">
              <span className="grid size-12 place-items-center rounded-xl bg-turquoise/15 text-[#285e59]">
                <FileSpreadsheet className="size-6" />
              </span>
              <div>
                <p className="text-xs font-bold">Upload a CSV instead</p>
                <p className="mt-1 text-[10px] text-ink/45">
                  Useful for exports from HoneyBook or a different workbook.
                </p>
              </div>
            </div>
            <form
              action={importHistoricalCsv}
              className="mt-6 rounded-xl border-2 border-dashed border-ink/15 bg-white/35 p-8 text-center"
            >
              <input type="hidden" name="spreadsheetId" value={spreadsheetId} />
              <input type="hidden" name="tab" value="Leads" />
              <UploadCloud className="mx-auto size-8 text-ink/30" />
              <p className="mt-4 font-display text-2xl">Choose the Leads CSV</p>
              <p className="mx-auto mt-2 max-w-md text-[11px] leading-5 text-ink/45">
                Validation and duplicate detection run before project records
                are updated.
              </p>
              <input
                required
                name="file"
                type="file"
                accept=".csv,text/csv"
                className="mx-auto mt-5 block max-w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:py-2.5 file:text-xs file:font-bold file:text-white"
              />
              <button className="mt-4 rounded-lg bg-coral px-4 py-2.5 text-xs font-bold text-white">
                Import CSV
              </button>
            </form>
          </section>
        </div>
        <aside className="space-y-5 xl:col-span-4">
          <section className="rounded-xl border border-marigold/45 bg-[#fff7dd] p-5">
            <div className="flex items-center gap-2 text-[#7a5911]">
              <AlertTriangle className="size-4" />
              <p className="font-mono text-[8px] font-bold tracking-[.12em] uppercase">
                Current import ledger
              </p>
            </div>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between">
                <dt className="text-ink/50">Retained row versions</dt>
                <dd className="font-mono font-bold">{retainedRows ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/50">Pending mappings</dt>
                <dd className="font-mono font-bold">{pendingMappings ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/50">Silent overwrites</dt>
                <dd className="font-mono font-bold">0</dd>
              </div>
            </dl>
          </section>
          <section className="paper rounded-xl border p-5">
            <div className="flex items-center gap-2">
              <LockKeyhole className="size-4 text-moss" />
              <p className="text-xs font-bold">Import guarantees</p>
            </div>
            <ul className="mt-4 space-y-3 text-[10px] leading-5 text-ink/52">
              {[
                "Raw values and row coordinates are retained",
                "Known values become pipeline records",
                "Unknown values enter the mapping queue",
                "Repeat imports update the same source row",
                "The Google connection remains read-only",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-moss" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
