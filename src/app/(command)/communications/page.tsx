import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Mail,
  Phone,
} from "lucide-react";
import { loadCommunicationsReport } from "@/lib/dashboard-data";
function projectName(value: unknown) {
  if (Array.isArray(value))
    return (
      (value[0] as { name?: string } | undefined)?.name ?? "Unmatched project"
    );
  if (value && typeof value === "object" && "name" in value)
    return String((value as { name: unknown }).name);
  return "Unmatched project";
}
export default async function CommunicationsPage() {
  const live = await loadCommunicationsReport();
  const messages = live?.communications ?? [];
  return (
    <div className="pb-20 lg:pb-0">
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[9px] font-bold tracking-[.15em] text-coral uppercase">
            Communications / Metadata only
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-[-.04em] sm:text-5xl">
            Know when the conversation moved.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/52">
            Email headers and short internal summaries are retained. Full
            message content is not stored, and uncertain project matches enter
            the mapping queue.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/google/oauth/start?provider=gmail"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-xs font-bold text-white"
          >
            <Mail className="size-4" /> Connect Gmail
          </a>
          <button className="inline-flex h-10 items-center gap-2 rounded-lg border bg-cream px-4 text-xs font-bold">
            <Phone className="size-4" /> Log call
          </button>
        </div>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="paper rounded-xl border p-4">
          <p className="text-[9px] text-ink/40">Mailbox status</p>
          <p className="mt-2 font-display text-2xl capitalize">
            {live?.connection?.status ?? "Not connected"}
          </p>
          <p className="mt-2 font-mono text-[8px] text-ink/30 uppercase">
            Gmail metadata scope
          </p>
        </div>
        <div className="paper rounded-xl border p-4">
          <p className="text-[9px] text-ink/40">Last successful sync</p>
          <p className="mt-2 font-display text-2xl">
            {live?.connection?.last_success_at
              ? new Date(live.connection.last_success_at).toLocaleDateString()
              : "Not connected"}
          </p>
          <p className="mt-2 font-mono text-[8px] text-ink/30 uppercase">
            Incremental · hourly
          </p>
        </div>
        <div className="rounded-xl border border-marigold/45 bg-[#fff7dd] p-4">
          <p className="text-[9px] text-[#805e13]">Uncertain matches</p>
          <p className="mt-2 font-display text-2xl">
            {live?.pendingMappings ?? 0}
          </p>
          <p className="mt-2 font-mono text-[8px] text-[#805e13]/60 uppercase">
            Mapping queue
          </p>
        </div>
      </div>
      <section className="paper rounded-xl border">
        <div className="border-b p-5">
          <h2 className="font-display text-2xl">Recent communication</h2>
        </div>
        <div className="divide-y">
          {messages.map((message) => (
            <article
              key={message.id}
              className="grid gap-3 p-5 sm:grid-cols-[38px_1fr_auto]"
            >
              <span
                className={`grid size-9 place-items-center rounded-full ${message.direction === "inbound" ? "bg-turquoise/20 text-[#285e59]" : "bg-ink text-white"}`}
              >
                {message.direction === "inbound" ? (
                  <ArrowDownLeft className="size-4" />
                ) : (
                  <ArrowUpRight className="size-4" />
                )}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold">
                    {message.subject ?? "No subject"}
                  </p>
                  <span className="rounded-full border bg-white px-2 py-0.5 text-[8px] font-bold">
                    {message.direction}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-ink/48">
                  {projectName(message.projects)} · matched by{" "}
                  {message.matched_by ?? "mapping queue"}
                </p>
                <p className="mt-2 text-[9px] text-ink/38">
                  {message.internal_summary}
                </p>
              </div>
              <time className="font-mono text-[8px] text-ink/35 uppercase">
                {new Date(message.occurred_at).toLocaleString("en-US", {
                  timeZone: "America/Chicago",
                })}
              </time>
            </article>
          ))}
        </div>
      </section>
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-coral/25 bg-[#fff0e9] px-4 py-3 text-[10px] leading-5 text-ink/55">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-coral" />
        SMS and phone calls remain manual unless a supported provider is
        authorized. The dashboard never guesses that an unavailable message
        occurred.
      </div>
    </div>
  );
}
