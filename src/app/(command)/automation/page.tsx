import {
  AlertOctagon,
  CheckCircle2,
  CloudUpload,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { loadAutomationReport } from "@/lib/dashboard-data";
import { conversionGateKeys } from "@/lib/conversions/core";
import { updateConversionGate } from "./actions";
const labels = {
  tracking_tested: "Tracking tested",
  conversion_action_ownership_confirmed: "Action ownership confirmed",
  customer_data_terms_accepted: "Customer data terms accepted",
  deduplication_verified: "Deduplication verified",
  production_uploads_approved: "Production uploads approved",
};
const gateLabel = (gate: string) =>
  labels[gate as keyof typeof labels] ?? gate.replaceAll("_", " ");
const fixture = {
  runtimeEnabled: false,
  isOwner: true,
  gates: conversionGateKeys.map((gate) => ({
    gate,
    satisfied: false,
    evidence: null,
    approved_at: null,
  })),
  queue: { dry_run_passed: 0, invalid: 0, uploaded: 0 },
  alerts: [
    {
      id: "preview",
      severity: "warning",
      title: "Production write path locked",
      detail: "Complete and record all safety prerequisites before activation.",
      source: "Conversion safety gates",
      last_detected_at: "2026-08-13T12:00:00Z",
    },
  ],
  recommendations: [],
};
export default async function AutomationPage() {
  const data = (await loadAutomationReport()) ?? fixture;
  const prerequisitesPassed = data.gates
    .filter((row) => row.gate !== "production_uploads_approved")
    .every((row) => row.satisfied && row.approved_at);
  return (
    <div className="pb-20 lg:pb-0">
      <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[9px] font-bold tracking-[.15em] text-coral uppercase">
            Automation control / Human approval required
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-[-.04em] sm:text-5xl">
            Safe write-back, with the brakes visible.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/52">
            Candidates are validated and dry-run locally. No Google Ads mutation
            is implemented or attempted in this release.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-coral/30 bg-[#fff0e9] px-4 py-2 text-[10px] font-bold text-[#93483c]">
          <LockKeyhole className="size-4" /> Production uploads locked
        </span>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "Dry runs passed",
            value: data.queue.dry_run_passed,
            Icon: CheckCircle2,
          },
          {
            label: "Needs correction",
            value: data.queue.invalid,
            Icon: AlertOctagon,
          },
          { label: "Uploaded", value: data.queue.uploaded, Icon: CloudUpload },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="paper rounded-xl border p-5">
            <Icon className="size-4 text-coral" />
            <p className="mt-3 font-display text-3xl">{value}</p>
            <p className="mt-1 text-[10px] text-ink/45">{label}</p>
            <p className="mt-3 font-mono text-[8px] text-ink/30 uppercase">
              All time · Conversion staging
            </p>
          </div>
        ))}
      </div>
      <section className="paper rounded-xl border p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-5 text-moss" />
          <div>
            <h2 className="font-display text-2xl">Approval gates</h2>
            <p className="text-[10px] text-ink/45">
              Owner-only changes are written to the audit log.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {data.gates.map((row) => {
            const production = row.gate === "production_uploads_approved";
            return (
              <div
                key={row.gate}
                className={`rounded-xl border p-4 ${row.satisfied ? "border-moss/30 bg-moss/[.06]" : "bg-white/40"}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-7 place-items-center rounded-full ${row.satisfied ? "bg-moss text-white" : "bg-ink/8 text-ink/45"}`}
                  >
                    {row.satisfied ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <LockKeyhole className="size-3.5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">{gateLabel(row.gate)}</p>
                    <p className="mt-1 text-[9px] leading-4 text-ink/42">
                      {row.evidence || "No approval evidence recorded."}
                    </p>
                    {data.isOwner &&
                    (!production ||
                      row.satisfied ||
                      (data.runtimeEnabled && prerequisitesPassed)) ? (
                      <form
                        action={updateConversionGate}
                        className="mt-3 flex flex-col gap-2 sm:flex-row"
                      >
                        <input type="hidden" name="gate" value={row.gate} />
                        <input
                          type="hidden"
                          name="intent"
                          value={row.satisfied ? "revoke" : "approve"}
                        />
                        <input
                          required
                          minLength={8}
                          maxLength={500}
                          name="evidence"
                          aria-label={`Evidence for ${gateLabel(row.gate)}`}
                          placeholder={
                            row.satisfied
                              ? "Reason for revocation"
                              : "Evidence or test reference"
                          }
                          className="h-9 min-w-0 flex-1 rounded-lg border bg-white px-3 text-[10px] outline-none focus:border-coral"
                        />
                        <button className="h-9 rounded-lg bg-ink px-3 text-[9px] font-bold text-white">
                          {row.satisfied ? "Revoke" : "Record approval"}
                        </button>
                      </form>
                    ) : null}
                    {production && !row.satisfied ? (
                      <p className="mt-3 rounded-lg bg-ink/[.05] px-3 py-2 text-[9px] text-ink/48">
                        {data.runtimeEnabled && prerequisitesPassed
                          ? "All prerequisites passed. Record the owner's final production approval to complete the gate set."
                          : "Locked until all four prerequisites pass and the server kill switch is explicitly enabled."}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="paper rounded-xl border p-5">
          <h2 className="flex items-center gap-2 font-display text-2xl">
            <AlertOctagon className="size-5 text-coral" /> Open alerts
          </h2>
          <div className="mt-4 space-y-3">
            {data.alerts.length ? (
              data.alerts.map((row) => (
                <article
                  key={row.id}
                  className="rounded-lg border bg-white/45 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold">{row.title}</p>
                    <span className="font-mono text-[8px] uppercase text-coral">
                      {row.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] leading-5 text-ink/52">
                    {row.detail}
                  </p>
                  <p className="mt-2 font-mono text-[8px] text-ink/30 uppercase">
                    {row.source} · as of{" "}
                    {new Date(row.last_detected_at).toLocaleString("en-US", {
                      timeZone: "America/Chicago",
                    })}
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-lg border border-dashed p-5 text-xs text-ink/45">
                No open alerts.
              </p>
            )}
          </div>
        </section>
        <section className="paper rounded-xl border p-5">
          <h2 className="flex items-center gap-2 font-display text-2xl">
            <Sparkles className="size-5 text-marigold" /> Recommendations
          </h2>
          <div className="mt-4 space-y-3">
            {data.recommendations.length ? (
              data.recommendations.map((row) => (
                <article
                  key={row.id}
                  className="rounded-lg border bg-white/45 p-4"
                >
                  <p className="text-xs font-bold">{row.title}</p>
                  <p className="mt-2 text-[10px] leading-5 text-ink/52">
                    {row.rationale}
                  </p>
                  <p className="mt-2 text-[10px] font-bold text-moss">
                    Next: {row.suggested_action}
                  </p>
                  <p className="mt-2 font-mono text-[8px] text-ink/30 uppercase">
                    Priority {row.priority} · {row.source}
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-lg border border-dashed p-5 text-xs text-ink/45">
                Recommendations appear after the daily operations scan.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
