import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileSpreadsheet,
  KeyRound,
  PauseCircle,
  ShieldCheck,
  UploadCloud,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { env } from "@/lib/env";
import { importHoneyBookCsv, setHoneyBookZapierState } from "./actions";

const triggers = [
  ["New inquiry", "new_inquiry"],
  ["Project stage changed", "project_stage_changed"],
  ["Project booked", "project_booked"],
  ["Payment received", "payment_received"],
  ["Client created", "client_created"],
  ["Meeting scheduled", "meeting_scheduled"],
];

const errorMessages: Record<string, string> = {
  invalid_upload: "Choose a HoneyBook CSV smaller than 10 MB.",
  invalid_csv: "That file could not be read as a HoneyBook CSV export.",
  state_update_failed: "The automatic sync setting could not be updated.",
};

function dateLabel(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago" })
    : "Never";
}

export default async function HoneyBookSetupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const context = await requireOrganizationContext(["owner", "admin"]);
  const endpoint = new URL(
    "/api/webhooks/honeybook",
    env.APP_URL ?? "http://localhost:3000",
  ).toString();
  const [
    { data: connections },
    { count: projectCount },
    { count: pendingMappings },
  ] = await Promise.all([
    context.supabase
      .from("sync_connections")
      .select("provider,status,last_success_at,configuration")
      .eq("organization_id", context.organizationId)
      .in("provider", ["honeybook_zapier", "honeybook_manual"]),
    context.supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", context.organizationId)
      .eq("source_origin", "honeybook"),
    context.supabase
      .from("mapping_queue")
      .select("id,source_records!inner(source_type)", {
        count: "exact",
        head: true,
      })
      .eq("organization_id", context.organizationId)
      .eq("status", "pending")
      .in("source_records.source_type", ["honeybook_csv", "honeybook_zapier"]),
  ]);
  const byProvider = new Map(
    (connections ?? []).map((row) => [row.provider, row]),
  );
  const automatic = byProvider.get("honeybook_zapier");
  const manual = byProvider.get("honeybook_manual");
  const automaticEnabled =
    automatic?.status !== "disabled" && Boolean(automatic);
  const webhookReady = Boolean(env.HONEYBOOK_WEBHOOK_SECRET);

  return (
    <div className="pb-20 lg:pb-0">
      <Link
        href="/integrations"
        className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-ink/50"
      >
        <ArrowLeft className="size-4" /> Back to integrations
      </Link>
      <div className="mb-7">
        <p className="font-mono text-[9px] font-bold tracking-[.15em] text-coral uppercase">
          HoneyBook / Primary project source
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-[-.04em] sm:text-5xl">
          Choose automatic or manual sync.
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/52">
          Both options update the same HoneyBook-owned project records. Use
          Zapier for ongoing changes, or upload a HoneyBook CSV whenever you
          want a manual snapshot. The retired Google Sheet is not used for the
          live pipeline.
        </p>
      </div>

      {params.error ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-coral/35 bg-[#fff0e9] px-4 py-3 text-xs font-bold text-[#8f3b32]"
        >
          {errorMessages[params.error] ??
            "The HoneyBook update could not be completed."}
        </div>
      ) : null}
      {params.zapier ? (
        <div className="mb-5 rounded-xl border border-moss/30 bg-[#edf6e9] px-4 py-3 text-xs text-moss">
          Automatic HoneyBook sync is now <strong>{params.zapier}</strong>.
        </div>
      ) : null}
      {params.imported ? (
        <div className="mb-5 rounded-xl border border-moss/30 bg-[#edf6e9] px-4 py-3 text-xs text-moss">
          <strong>{params.imported} HoneyBook rows processed.</strong>{" "}
          {params.created ?? 0} created, {params.updated ?? 0} updated,{" "}
          {params.skipped ?? 0} skipped, and {params.mappings ?? 0} sent for
          review.
        </div>
      ) : null}

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="paper rounded-xl border p-4">
          <p className="font-mono text-[8px] font-bold tracking-[.12em] text-ink/40 uppercase">
            Live HoneyBook projects
          </p>
          <p className="mt-2 font-display text-3xl">{projectCount ?? 0}</p>
        </div>
        <div className="paper rounded-xl border p-4">
          <p className="font-mono text-[8px] font-bold tracking-[.12em] text-ink/40 uppercase">
            Automatic last received
          </p>
          <p className="mt-2 text-xs font-bold">
            {dateLabel(automatic?.last_success_at)}
          </p>
        </div>
        <div className="paper rounded-xl border p-4">
          <p className="font-mono text-[8px] font-bold tracking-[.12em] text-ink/40 uppercase">
            HoneyBook mappings to review
          </p>
          <p className="mt-2 font-display text-3xl">{pendingMappings ?? 0}</p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="paper rounded-xl border p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-marigold/20 text-[#805e13]">
              <Zap className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl">Automatic with Zapier</h2>
                <span
                  className={`rounded-full border px-2 py-1 font-mono text-[8px] font-bold uppercase ${automaticEnabled ? "border-moss/25 bg-moss/8 text-moss" : "bg-white text-ink/45"}`}
                >
                  {automaticEnabled
                    ? automatic?.status === "connected"
                      ? "Receiving events"
                      : "Enabled · awaiting event"
                    : "Off"}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-ink/50">
                Best for day-to-day use. HoneyBook events arrive near real time
                and update projects by stable HoneyBook ID.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <form action={setHoneyBookZapierState}>
              <input
                type="hidden"
                name="enabled"
                value={automaticEnabled ? "false" : "true"}
              />
              <button
                className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-bold ${automaticEnabled ? "border bg-white text-ink" : "bg-ink text-white"}`}
              >
                {automaticEnabled ? (
                  <PauseCircle className="size-4" />
                ) : (
                  <Zap className="size-4" />
                )}
                {automaticEnabled
                  ? "Pause automatic sync"
                  : "Turn on automatic sync"}
              </button>
            </form>
          </div>
          {!webhookReady ? (
            <p className="mt-4 rounded-lg border border-coral/30 bg-[#fff0e9] p-3 text-[10px] leading-5 text-[#8f3b32]">
              Add HONEYBOOK_WEBHOOK_SECRET to the server environment before
              testing the Zap.
            </p>
          ) : null}
          <div className="mt-5 rounded-xl border bg-white/40 p-4">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-moss" />
              <p className="text-xs font-bold">Zapier webhook destination</p>
            </div>
            <dl className="mt-3 space-y-3 text-[10px]">
              <div>
                <dt className="text-ink/40">POST URL</dt>
                <dd className="mt-1 break-all font-mono font-bold">
                  {endpoint}
                </dd>
              </div>
              <div>
                <dt className="text-ink/40">Header: x-organization-id</dt>
                <dd className="mt-1 break-all font-mono font-bold">
                  {context.organizationId}
                </dd>
              </div>
              <div>
                <dt className="text-ink/40">Header: x-webhook-secret</dt>
                <dd className="mt-1 font-mono font-bold">
                  Copy from the secure deployment environment
                </dd>
              </div>
            </dl>
          </div>
          <div className="mt-5">
            <p className="text-xs font-bold">Recommended triggers</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {triggers.map(([label, event]) => (
                <div
                  key={event}
                  className="flex items-start gap-2 rounded-lg border bg-white/35 p-3"
                >
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-moss" />
                  <div>
                    <p className="text-[10px] font-bold">{label}</p>
                    <p className="mt-1 font-mono text-[7px] text-ink/40">
                      {event}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <details className="mt-5 rounded-xl border bg-ink p-4 text-white">
            <summary className="cursor-pointer text-xs font-bold">
              Show Zapier payload template
            </summary>
            <pre className="mt-4 overflow-x-auto text-[9px] leading-5 text-white/80">{`{
  "event": "project_stage_changed",
  "event_id": "<stable event ID>",
  "occurred_at": "<ISO timestamp>",
  "project_id": "<HoneyBook project ID>",
  "client_id": "<HoneyBook client ID>",
  "data": {
    "project_name": "<project name>",
    "stage": "<exact HoneyBook stage>",
    "event_at": "<service date>",
    "services": "<Photo Booth, Dance Floor, Bar Services, Margarita Machine>",
    "lead_source": "<lead source>",
    "honeybook_url": "<project URL>",
    "estimated_value_cents": 0,
    "proposal_value_cents": 0,
    "booked_value_cents": 0,
    "collected_cents": 0
  }
}`}</pre>
          </details>
        </section>

        <section className="paper rounded-xl border p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-turquoise/15 text-[#285e59]">
              <FileSpreadsheet className="size-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl">
                  Manual HoneyBook upload
                </h2>
                <span className="rounded-full border bg-white px-2 py-1 font-mono text-[8px] font-bold text-ink/45 uppercase">
                  No Zapier required
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-ink/50">
                Export projects from HoneyBook, then upload the CSV here.
                Repeated uploads update the same project by HoneyBook Project
                ID.
              </p>
            </div>
          </div>
          <form
            action={importHoneyBookCsv}
            className="mt-5 rounded-xl border-2 border-dashed border-ink/15 bg-white/35 p-7 text-center"
          >
            <UploadCloud className="mx-auto size-8 text-ink/30" />
            <p className="mt-3 font-display text-2xl">Upload HoneyBook CSV</p>
            <p className="mx-auto mt-2 max-w-md text-[10px] leading-5 text-ink/45">
              Include Project ID or Project URL. Rows without a stable
              identifier are retained for review but never silently matched.
            </p>
            <input
              required
              name="file"
              type="file"
              accept=".csv,text/csv"
              className="mx-auto mt-5 block max-w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:py-2.5 file:text-xs file:font-bold file:text-white"
            />
            <button className="mt-4 rounded-lg bg-coral px-4 py-2.5 text-xs font-bold text-white">
              Import HoneyBook projects
            </button>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white/40 p-4">
            <div>
              <p className="text-[10px] font-bold">
                Need a clean column layout?
              </p>
              <p className="mt-1 text-[9px] text-ink/45">
                Download the template and paste exported HoneyBook fields into
                it.
              </p>
            </div>
            <a
              href="/honeybook-import-template.csv"
              download
              className="inline-flex h-9 items-center gap-2 rounded-lg border bg-white px-3 text-[10px] font-bold"
            >
              <Download className="size-3.5" /> Download template
            </a>
          </div>
          <div className="mt-5 rounded-xl border border-marigold/40 bg-[#fff7dd] p-4">
            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-[#805e13]" />
              <p className="text-xs font-bold">Manual refresh behavior</p>
            </div>
            <ul className="mt-3 space-y-2 text-[10px] leading-5 text-ink/55">
              <li>
                • Upload as often as desired; the newest values update the
                matching HoneyBook project.
              </li>
              <li>• Missing columns do not erase previously synced values.</li>
              <li>
                • Unknown stages, services, and ambiguous contacts go to the
                mapping queue.
              </li>
              <li>• Last manual sync: {dateLabel(manual?.last_success_at)}</li>
            </ul>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-turquoise/35 bg-[#e9f7f4] p-5">
          <ShieldCheck className="size-5 text-[#285e59]" />
          <p className="mt-3 text-xs font-bold">
            Both paths use the same safeguards
          </p>
          <p className="mt-2 text-[10px] leading-5 text-ink/55">
            Stable HoneyBook IDs prevent duplicates. Raw source fields are
            retained, material changes are audited, and uncertain matches are
            sent for review.
          </p>
        </section>
        <section className="rounded-xl border border-coral/30 bg-[#fff0e9] p-5">
          <Copy className="size-4 text-[#a44236]" />
          <p className="mt-3 text-xs font-bold">Known HoneyBook limitation</p>
          <p className="mt-2 text-[10px] leading-5 text-ink/55">
            Standard Zapier triggers do not expose every message or proposal
            view. Those fields remain “Not available” unless the CSV contains
            them or a separate supported event source supplies them.
          </p>
        </section>
      </div>
    </div>
  );
}
