import { ArrowUpRight, CalendarDays, ChartNoAxesCombined, ChevronRight, CircleAlert, TrendingUp } from "lucide-react";
import Link from "next/link";

import { activities, projects } from "@/lib/mock/projects";
import { formatCents } from "@/lib/domain/money";

const metrics = [
  { label: "New leads", value: "14", note: "Aug 1–13 · Pipeline", tone: "coral" },
  { label: "Needs response", value: "2", note: "As of 10:18 AM · CRM", tone: "alert" },
  { label: "Follow-ups due", value: "7", note: "Today · Tasks", tone: "gold" },
  { label: "Bookings", value: "6", note: "Aug 1–13 · HoneyBook", tone: "green" },
  { label: "Booked revenue", value: "$21.4k", note: "Aug 1–13 · Projects", tone: "green" },
  { label: "Collected", value: "$12.8k", note: "Aug 1–13 · Payments", tone: "green" },
  { label: "Outstanding", value: "$18.6k", note: "All open · Invoices", tone: "gold" },
  { label: "Ad spend", value: "$2.4k", note: "Aug 1–12 · Google Ads", tone: "neutral" },
];

const toneClass: Record<string, string> = { coral: "bg-coral", alert: "bg-[#bf483c]", gold: "bg-marigold", green: "bg-moss", neutral: "bg-ink/25" };

export default function OverviewPage() {
  return (
    <div className="pb-20 lg:pb-0">
      <section className="reveal mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mb-2 font-mono text-[9px] font-bold tracking-[.17em] text-ink/45 uppercase">Owner overview / Today</p>
          <h1 className="font-display text-4xl leading-[.95] tracking-[-.045em] sm:text-6xl">Make the next<br className="hidden sm:block" /> right move.</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-ink/58">Two new leads need a first response. One warm proposal is overdue for follow-up, and your next event is 16 days away.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex h-10 items-center gap-2 rounded-lg border bg-cream px-3 text-xs font-bold"><CalendarDays className="size-4" /> Aug 1–13, 2026</button>
          <Link href="/pipeline" className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-xs font-bold text-white">Open today’s worklist <ArrowUpRight className="size-4" /></Link>
        </div>
      </section>

      <section aria-label="Key metrics" className="reveal mb-5 grid overflow-hidden rounded-xl border bg-cream sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8" style={{ animationDelay: "60ms" }}>
        {metrics.map((metric) => <div key={metric.label} className="relative border-b border-r p-4 last:border-r-0 xl:border-b-0"><span className={`absolute left-0 top-0 h-1 w-full ${toneClass[metric.tone]}`} /><p className="mt-1 text-[10px] font-bold text-ink/48">{metric.label}</p><p className="mt-2 font-display text-3xl leading-none tracking-[-.04em]">{metric.value}</p><p className="mt-3 font-mono text-[8px] leading-4 text-ink/38 uppercase">{metric.note}</p></div>)}
      </section>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="paper reveal overflow-hidden rounded-xl border xl:col-span-8" style={{ animationDelay: "110ms" }}>
          <div className="flex items-center justify-between border-b px-5 py-4"><div><p className="font-mono text-[8px] font-bold tracking-[.14em] text-coral uppercase">Revenue queue</p><h2 className="mt-1 font-display text-2xl tracking-[-.025em]">Leads needing attention</h2></div><Link href="/pipeline" className="flex items-center text-[11px] font-bold text-ink/55">View pipeline <ChevronRight className="size-4" /></Link></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-ink/[.035] font-mono text-[8px] tracking-[.12em] text-ink/45 uppercase"><tr><th className="px-5 py-3">Lead / event</th><th className="px-3 py-3">Stage</th><th className="px-3 py-3">Services</th><th className="px-3 py-3">Next move</th><th className="px-5 py-3 text-right">Potential</th></tr></thead>
              <tbody className="divide-y">
                {projects.slice(0,4).map((project) => <tr key={project.id} className="transition hover:bg-marigold/[.07]"><td className="px-5 py-4"><Link href={`/leads/${project.id}`} className="font-display text-[17px] font-semibold hover:underline">{project.name}</Link><p className="mt-1 text-[10px] text-ink/45">{project.eventType} · {project.location}</p></td><td className="px-3 py-4"><span className="rounded-full border bg-white/60 px-2.5 py-1 text-[10px] font-bold">{project.stage}</span></td><td className="px-3 py-4"><div className="flex max-w-[190px] flex-wrap gap-1">{project.services.map((service) => <span key={service} className="rounded bg-turquoise/16 px-2 py-1 text-[9px] font-bold text-[#285e59]">{service}</span>)}</div></td><td className="px-3 py-4"><p className={`text-xs font-bold ${project.lastContactAt ? "text-ink" : "text-[#a53e34]"}`}>{project.lastContactAt ? project.proposalStatus === "Sent" ? "Follow up overdue" : "Follow up today" : "First response"}</p><p className="mt-1 text-[9px] text-ink/42">{project.proposalStatus} · {project.owner}</p></td><td className="px-5 py-4 text-right font-mono text-xs font-bold">{formatCents(project.estimatedCents)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <section className="paper reveal rounded-xl border xl:col-span-4" style={{ animationDelay: "150ms" }}>
          <div className="border-b px-5 py-4"><p className="font-mono text-[8px] font-bold tracking-[.14em] text-moss uppercase">Live ledger</p><h2 className="mt-1 font-display text-2xl tracking-[-.025em]">Latest activity</h2></div>
          <div className="divide-y px-5">{activities.map((activity) => <div key={activity.at} className="grid grid-cols-[18px_1fr] gap-3 py-4"><span className={`mt-1.5 size-2 rounded-full ${activity.tone === "hot" ? "bg-coral" : activity.tone === "good" ? "bg-moss" : activity.tone === "warn" ? "bg-marigold" : "bg-turquoise"}`} /><div><p className="text-xs font-bold">{activity.title}</p><p className="mt-1 text-[11px] leading-5 text-ink/52">{activity.detail}</p><p className="mt-1.5 font-mono text-[8px] text-ink/35 uppercase">{activity.at} · source recorded</p></div></div>)}</div>
        </section>

        <section className="paper reveal rounded-xl border p-5 xl:col-span-5" style={{ animationDelay: "180ms" }}>
          <div className="flex items-start justify-between"><div><p className="font-mono text-[8px] font-bold tracking-[.14em] text-ink/40 uppercase">Marketing efficiency · Aug 1–12</p><h2 className="mt-1 font-display text-2xl">Spend to celebration</h2></div><TrendingUp className="size-5 text-moss" /></div>
          <div className="mt-6 grid grid-cols-3 gap-4"><div><p className="text-[10px] text-ink/45">Cost / lead</p><p className="mt-1 font-display text-2xl">$171</p></div><div><p className="text-[10px] text-ink/45">Cost / booking</p><p className="mt-1 font-display text-2xl">$403</p></div><div><p className="text-[10px] text-ink/45">ROAS</p><p className="mt-1 font-display text-2xl">8.9×</p></div></div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-ink/8"><div className="h-full w-[74%] rounded-full bg-coral" /></div><p className="mt-2 text-[9px] text-ink/40">$2,418 spent of $3,250 monthly pace · Google Ads</p>
        </section>

        <section className="paper reveal rounded-xl border p-5 xl:col-span-4" style={{ animationDelay: "210ms" }}>
          <div className="flex items-start justify-between"><div><p className="font-mono text-[8px] font-bold tracking-[.14em] text-ink/40 uppercase">Organic search · Aug 1–11</p><h2 className="mt-1 font-display text-2xl">Search visibility</h2></div><ChartNoAxesCombined className="size-5 text-turquoise" /></div>
          <div className="mt-6 grid grid-cols-3 gap-3"><div><p className="font-display text-2xl">486</p><p className="text-[9px] text-ink/42">Clicks</p></div><div><p className="font-display text-2xl">18.4k</p><p className="text-[9px] text-ink/42">Impressions</p></div><div><p className="font-display text-2xl">12.7</p><p className="text-[9px] text-ink/42">Avg. position</p></div></div>
          <p className="mt-5 rounded-lg bg-turquoise/12 px-3 py-2 text-[10px] leading-4 text-[#285e59]">18 high-impression queries sit in positions 4–10.</p>
        </section>

        <section className="reveal rounded-xl border border-[#d79f92] bg-[#fff0e9] p-5 xl:col-span-3" style={{ animationDelay: "240ms" }}>
          <div className="flex items-center gap-2"><CircleAlert className="size-4 text-[#a44236]" /><p className="font-mono text-[8px] font-bold tracking-[.12em] text-[#8f3b32] uppercase">Integration health</p></div><p className="mt-3 font-display text-2xl">3 items need review</p><ul className="mt-4 space-y-2 text-[10px] leading-4 text-ink/60"><li>Google Ads conversions inactive</li><li>12 Sheet values need mapping</li><li>Search Console not connected</li></ul><Link href="/integrations" className="mt-5 inline-flex items-center text-[10px] font-bold text-[#8f3b32]">Review health <ChevronRight className="size-3.5" /></Link>
        </section>
      </div>
    </div>
  );
}
