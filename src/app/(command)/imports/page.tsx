import {
  Archive,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { getOrganizationContext } from "@/lib/auth/organization-context";

export default async function ImportArchivePage() {
  const context = await getOrganizationContext();
  const [
    { count: retainedRows },
    { count: historicalProjects },
    { count: pendingMappings },
  ] = context
    ? await Promise.all([
        context.supabase
          .from("source_records")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", context.organizationId)
          .eq("source_type", "google_sheet"),
        context.supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", context.organizationId)
          .eq("source_origin", "google_sheet"),
        context.supabase
          .from("mapping_queue")
          .select("id,source_records!inner(source_type)", {
            count: "exact",
            head: true,
          })
          .eq("organization_id", context.organizationId)
          .eq("status", "pending")
          .eq("source_records.source_type", "google_sheet"),
      ])
    : [{ count: 0 }, { count: 0 }, { count: 0 }];

  return (
    <div className="pb-20 lg:pb-0">
      <div className="mb-7">
        <p className="font-mono text-[9px] font-bold tracking-[.15em] text-coral uppercase">
          Historical data / Read-only archive
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-[-.04em] sm:text-5xl">
          The spreadsheet is retired.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/52">
          Its original rows and normalization decisions remain available for
          audit, but Sheet-derived projects no longer appear in the live sales
          pipeline. HoneyBook is now the operational source of truth.
        </p>
      </div>

      <section className="mb-5 rounded-xl border border-turquoise/35 bg-turquoise/[.08] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/70 text-turquoise">
            <ShieldCheck className="size-5" />
          </span>
          <div className="flex-1">
            <p className="text-xs font-bold">Ready to load HoneyBook</p>
            <p className="mt-1 text-[10px] leading-5 text-ink/55">
              Choose automatic Zapier updates or a manual HoneyBook CSV upload
              in one setup panel.
            </p>
          </div>
          <Link
            href="/integrations/honeybook"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-void px-4 text-xs font-bold text-white"
          >
            Open HoneyBook sync <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="paper rounded-xl border p-5">
          <FileSpreadsheet className="size-5 text-moss" />
          <p className="mt-4 font-mono text-[8px] font-bold tracking-[.12em] text-ink/40 uppercase">
            Retained source versions
          </p>
          <p className="mt-2 font-display text-4xl">{retainedRows ?? 0}</p>
          <p className="mt-2 text-[10px] leading-5 text-ink/45">
            Original spreadsheet row snapshots preserved without silent
            overwrites.
          </p>
        </section>
        <section className="paper rounded-xl border p-5">
          <Archive className="size-5 text-marigold" />
          <p className="mt-4 font-mono text-[8px] font-bold tracking-[.12em] text-ink/40 uppercase">
            Historical projects
          </p>
          <p className="mt-2 font-display text-4xl">
            {historicalProjects ?? 0}
          </p>
          <p className="mt-2 text-[10px] leading-5 text-ink/45">
            Excluded from live pipeline metrics and operational follow-up views.
          </p>
        </section>
        <section className="paper rounded-xl border p-5">
          <CheckCircle2 className="size-5 text-coral" />
          <p className="mt-4 font-mono text-[8px] font-bold tracking-[.12em] text-ink/40 uppercase">
            Historical mappings pending
          </p>
          <p className="mt-2 font-display text-4xl">{pendingMappings ?? 0}</p>
          <p className="mt-2 text-[10px] leading-5 text-ink/45">
            Retained for audit; these do not block the HoneyBook pipeline.
          </p>
        </section>
      </div>
    </div>
  );
}
