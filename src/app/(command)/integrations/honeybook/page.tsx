import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { env } from "@/lib/env";

const triggers = [
  ["New Inquiry", "new_inquiry"],
  ["Client Created", "client_created"],
  ["Project Stage Changed", "project_stage_changed"],
  ["New Project Booked", "project_booked"],
  ["New Payment Paid", "payment_received"],
  ["Meeting Scheduled", "meeting_scheduled"],
];

export default async function HoneyBookSetupPage() {
  const context = await requireOrganizationContext(["owner", "admin"]);
  const endpoint = new URL(
    "/api/webhooks/honeybook",
    env.APP_URL ?? "http://localhost:3000",
  ).toString();
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
          HoneyBook / Supported Zapier bridge
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-[-.04em] sm:text-5xl">
          Connect the client ledger safely.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/52">
          Create one two-step Zap for each event you want to capture. HoneyBook
          remains the system of record; the command center receives reporting
          events only.
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <section className="paper rounded-xl border p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-moss/10 text-moss">
                <KeyRound className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-2xl">Webhook destination</h2>
                <p className="text-[10px] text-ink/45">
                  Use Webhooks by Zapier → Custom Request → POST.
                </p>
              </div>
            </div>
            <dl className="mt-5 space-y-3 text-xs">
              <div className="rounded-lg border bg-white/45 p-3">
                <dt className="text-[9px] text-ink/40">URL</dt>
                <dd className="mt-1 break-all font-mono text-[10px] font-bold">
                  {endpoint}
                </dd>
              </div>
              <div className="rounded-lg border bg-white/45 p-3">
                <dt className="text-[9px] text-ink/40">
                  Header: x-organization-id
                </dt>
                <dd className="mt-1 break-all font-mono text-[10px] font-bold">
                  {context.organizationId}
                </dd>
              </div>
              <div className="rounded-lg border bg-white/45 p-3">
                <dt className="text-[9px] text-ink/40">
                  Header: x-webhook-secret
                </dt>
                <dd className="mt-1 font-mono text-[10px] font-bold">
                  Configured server-side · copy from the secure deployment
                  environment
                </dd>
              </div>
            </dl>
          </section>
          <section className="paper rounded-xl border p-5">
            <h2 className="font-display text-2xl">Payload template</h2>
            <p className="mt-2 text-[10px] leading-5 text-ink/50">
              Map only fields exposed by the selected HoneyBook trigger. Leave
              unavailable fields out; the dashboard never guesses them.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-ink p-4 text-[10px] leading-5 text-white">{`{
  "event": "new_inquiry",
  "event_id": "<stable HoneyBook/Zapier event ID>",
  "occurred_at": "<ISO timestamp>",
  "project_id": "<HoneyBook project ID>",
  "client_id": "<HoneyBook client ID>",
  "data": {
    "project_name": "<project name>",
    "first_name": "<first name>",
    "last_name": "<last name>",
    "email": "<email>",
    "phone": "<phone>",
    "stage": "<stage>",
    "event_at": "<event timestamp>",
    "lead_source": "<lead source>",
    "honeybook_url": "<project URL>"
  }
}`}</pre>
          </section>
        </div>
        <aside className="space-y-5 xl:col-span-4">
          <section className="paper rounded-xl border p-5">
            <h2 className="font-display text-2xl">Recommended triggers</h2>
            <ul className="mt-4 space-y-3">
              {triggers.map(([label, event]) => (
                <li key={event} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-moss" />
                  <div>
                    <p className="text-xs font-bold">{label}</p>
                    <p className="mt-1 font-mono text-[8px] text-ink/40">
                      event: {event}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-turquoise/35 bg-[#e9f7f4] p-5">
            <ShieldCheck className="size-5 text-[#285e59]" />
            <p className="mt-3 text-xs font-bold">Safety built in</p>
            <p className="mt-2 text-[10px] leading-5 text-ink/55">
              Shared-secret verification, seven-day replay protection,
              idempotency keys, encrypted raw payload retention, retry state,
              and a dead-letter path are enforced by the endpoint.
            </p>
          </section>
          <section className="rounded-xl border border-marigold/40 bg-[#fff7dd] p-5">
            <Copy className="size-4 text-[#805e13]" />
            <p className="mt-3 text-xs font-bold">Start with four Zaps</p>
            <p className="mt-2 text-[10px] leading-5 text-ink/55">
              New inquiry, stage changed, booked project, and payment received
              provide the best value with the fewest tasks. Add client and
              meeting triggers only if needed.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
