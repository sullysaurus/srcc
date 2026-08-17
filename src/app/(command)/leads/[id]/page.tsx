import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  ReceiptText,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadProjectDetail } from "@/lib/dashboard-data";
import { formatCents } from "@/lib/domain/money";

function dateLabel(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Chicago",
      })
    : "Not recorded";
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadProjectDetail(id);
  if (!data) notFound();
  const { project } = data;
  return (
    <div className="pb-20 lg:pb-0">
      <Link
        href="/pipeline"
        className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-ink/50"
      >
        <ArrowLeft className="size-4" /> Back to pipeline
      </Link>
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            {project.temperature ? (
              <span className="rounded-full bg-coral px-2.5 py-1 text-[9px] font-bold text-white">
                {project.temperature}
              </span>
            ) : null}
            <span className="rounded-full border bg-cream px-2.5 py-1 text-[9px] font-bold">
              {project.stage}
            </span>
            <span className="rounded-full border bg-panel px-2.5 py-1 text-[9px] font-bold capitalize">
              {project.sourceOrigin.replaceAll("_", " ")}
            </span>
          </div>
          <h1 className="font-display text-4xl tracking-[-.04em] sm:text-5xl">
            {project.name}
          </h1>
          <p className="mt-3 text-sm text-ink/50">
            {project.eventType} · {dateLabel(project.eventDate)} ·{" "}
            {project.location}
          </p>
        </div>
        {project.honeybookUrl ? (
          <a
            href={project.honeybookUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 self-start rounded-lg bg-void px-4 text-xs font-bold text-white"
          >
            Open HoneyBook <ExternalLink className="size-4" />
          </a>
        ) : (
          <span className="self-start rounded-lg border bg-panel px-4 py-3 text-[10px] font-bold text-ink/40">
            No HoneyBook project linked
          </span>
        )}
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <section className="paper rounded-xl border p-5">
            <p className="font-mono text-[8px] font-bold tracking-[.14em] text-coral uppercase">
              Project record
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [CalendarDays, "Event", dateLabel(project.eventDate)],
                [MapPin, "Venue", project.venue],
                [UserRound, "Owner", project.owner],
                [ReceiptText, "Source", project.source],
              ].map(([Icon, label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-lg border bg-white/45 p-3"
                >
                  <Icon className="size-4 text-ink/40" />
                  <p className="mt-3 text-[9px] text-ink/40">{String(label)}</p>
                  <p className="mt-1 text-xs font-bold">{String(value)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {project.services.length ? (
                project.services.map((service) => (
                  <span
                    key={service.name}
                    className="rounded bg-turquoise/15 px-3 py-2 text-[10px] font-bold text-turquoise"
                  >
                    {service.name} · {service.origin.replaceAll("_", " ")}
                  </span>
                ))
              ) : (
                <Link
                  href="/mapping-queue"
                  className="rounded border border-coral/30 bg-coral/[.08] px-3 py-2 text-[10px] font-bold text-coral"
                >
                  Service needs mapping
                </Link>
              )}
            </div>
            <div className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2">
              <div>
                <p className="text-[9px] text-ink/40">Email</p>
                <p className="mt-1 text-xs font-bold">
                  {project.email ?? "Not recorded"}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-ink/40">Phone</p>
                <p className="mt-1 text-xs font-bold">
                  {project.phone ?? "Not recorded"}
                </p>
              </div>
            </div>
          </section>
          <section className="paper rounded-xl border">
            <div className="border-b px-5 py-4">
              <p className="font-mono text-[8px] font-bold tracking-[.14em] text-moss uppercase">
                Chronological record
              </p>
              <h2 className="mt-1 font-display text-2xl">Activity stream</h2>
            </div>
            {data.activities.length ? (
              <div className="px-5">
                {data.activities.map((event) => (
                  <div
                    key={event.id}
                    className="grid grid-cols-[36px_1fr] gap-3 border-b py-4 last:border-0"
                  >
                    <span className="grid size-9 place-items-center rounded-full bg-void text-white">
                      <MessageSquareText className="size-4" />
                    </span>
                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-xs font-bold">{event.title}</p>
                        <p className="shrink-0 font-mono text-[8px] text-ink/35">
                          {dateLabel(event.occurred_at)}
                        </p>
                      </div>
                      <p className="mt-1 text-[11px] text-ink/52">
                        {event.detail ?? "No additional detail"}
                      </p>
                      <p className="mt-2 font-mono text-[8px] text-ink/32 uppercase">
                        Source: {event.source_origin.replaceAll("_", " ")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-10 text-center text-xs text-ink/45">
                No confirmed activity has been recorded.
              </p>
            )}
          </section>
        </div>
        <aside className="space-y-5 xl:col-span-4">
          <section className="paper rounded-xl border p-5">
            <p className="font-mono text-[8px] font-bold tracking-[.14em] text-ink/40 uppercase">
              Financial summary
            </p>
            <div className="mt-4 space-y-3 text-xs">
              {[
                ["Estimated", project.estimatedCents],
                ["Proposal", project.proposalCents],
                ["Booked", project.bookedCents],
                ["Collected", project.collectedCents],
                ["Outstanding", project.outstandingCents],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between">
                  <span className="text-ink/48">{label}</span>
                  <span className="font-mono font-bold">
                    {formatCents(Number(value))}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t pt-3 font-mono text-[8px] text-ink/36 uppercase">
              Source · {project.sourceOrigin.replaceAll("_", " ")}
            </p>
          </section>
          <section className="paper rounded-xl border p-5">
            <p className="font-mono text-[8px] font-bold tracking-[.14em] text-ink/40 uppercase">
              Proposal activity
            </p>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-ink/48">Status</dt>
                <dd className="font-bold">{project.proposalStatus}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/48">Sent</dt>
                <dd className="text-right font-bold">
                  {dateLabel(project.proposalSentAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/48">First viewed</dt>
                <dd className="text-right font-bold">
                  {dateLabel(project.firstViewedAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/48">Latest viewed</dt>
                <dd className="text-right font-bold">
                  {dateLabel(project.latestViewedAt)}
                </dd>
              </div>
            </dl>
          </section>
          <section className="rounded-xl border border-marigold/40 bg-marigold/[.08] p-5">
            <p className="font-mono text-[8px] font-bold tracking-[.14em] text-marigold uppercase">
              Next follow-up · Dashboard maintained
            </p>
            <p className="mt-3 font-display text-2xl">
              {dateLabel(project.nextFollowUpAt)}
            </p>
            {data.tasks.filter((task) => !task.completed_at).length ? (
              <ul className="mt-3 space-y-2 text-[10px] text-ink/55">
                {data.tasks
                  .filter((task) => !task.completed_at)
                  .map((task) => (
                    <li key={task.id}>
                      {task.title} · {dateLabel(task.due_at)}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] leading-5 text-ink/55">
                No open task is attached to this project.
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                disabled
                className="flex h-9 items-center gap-2 rounded-lg bg-ink/45 px-3 text-[10px] font-bold text-white"
              >
                <Phone className="size-3.5" /> Log call
              </button>
              <a
                href={project.email ? `mailto:${project.email}` : undefined}
                aria-disabled={!project.email}
                className="flex h-9 items-center gap-2 rounded-lg border bg-panel px-3 text-[10px] font-bold"
              >
                <Mail className="size-3.5" /> Email
              </a>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
