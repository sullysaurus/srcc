import {
  ArrowUpRight,
  Link2,
  MousePointerClick,
  SearchCheck,
  type LucideIcon,
} from "lucide-react";
import { loadAttributionReport } from "@/lib/dashboard-data";
import { formatCents } from "@/lib/domain/money";
export default async function AttributionPage() {
  const data = (await loadAttributionReport()) ?? {
    captureActive: false,
    leads: 0,
    organicLeads: 0,
    organicQualified: 0,
    organicBookings: 0,
    organicBookedRevenueCents: 0,
    pages: [],
  };
  const conversion = data.organicLeads
    ? data.organicBookings / data.organicLeads
    : 0;
  const kpis: Array<{
    Icon: LucideIcon;
    label: string;
    value: string | number;
  }> = [
    { Icon: Link2, label: "Organic leads", value: data.organicLeads },
    { Icon: SearchCheck, label: "Qualified", value: data.organicQualified },
    { Icon: ArrowUpRight, label: "Bookings", value: data.organicBookings },
    {
      Icon: MousePointerClick,
      label: "Conversion rate",
      value: `${(conversion * 100).toFixed(1)}%`,
    },
    {
      Icon: ArrowUpRight,
      label: "Booked revenue",
      value: formatCents(data.organicBookedRevenueCents),
    },
  ];
  return (
    <div className="pb-20 lg:pb-0">
      <div className="mb-7">
        <p className="font-mono text-[9px] font-bold tracking-[.15em] text-coral uppercase">
          Closed-loop attribution / Exact matches only
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-[-.04em] sm:text-5xl">
          From first click to booked celebration.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/52">
          Website touch tokens link individual projects to captured landing-page
          and campaign data. Search Console queries remain aggregated and are
          never assigned to a person.
        </p>
      </div>
      {!data.captureActive ? (
        <section className="mb-5 rounded-xl border border-marigold/45 bg-[#fff7dd] p-5">
          <p className="text-xs font-bold">Website capture is not active yet</p>
          <p className="mt-2 max-w-3xl text-[10px] leading-5 text-ink/55">
            Add the prepared attribution script to the website footer, then
            forward <code>sr_attribution_token</code> unchanged in the HoneyBook
            new-inquiry Zap. Publish only after the filtered test inquiry passes
            end to end.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-ink p-3 text-[9px] leading-5 text-white/80">{`<script defer src="https://southernrevelry.vercel.app/attribution.js" data-endpoint="https://southernrevelry.vercel.app/api/public/attribution"></script>`}</pre>
        </section>
      ) : null}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map(({ Icon, label, value }) => (
          <div key={label} className="paper rounded-xl border p-4">
            <Icon className="size-4 text-coral" />
            <p className="mt-3 text-[9px] text-ink/42">{label}</p>
            <p className="mt-1 font-display text-2xl">{value}</p>
            <p className="mt-2 font-mono text-[8px] text-ink/30 uppercase">
              Last 30 days · Attribution + Projects
            </p>
          </div>
        ))}
      </div>
      <section className="paper overflow-hidden rounded-xl border">
        <div className="border-b p-5">
          <h2 className="font-display text-2xl">Landing-page value</h2>
          <p className="mt-1 text-[10px] text-ink/45">
            Search performance is aggregated by page; project outcomes use exact
            attribution tokens.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-ink/[.035] font-mono text-[8px] tracking-[.11em] text-ink/44 uppercase">
              <tr>
                <th className="px-5 py-3">Landing page</th>
                <th className="px-3 py-3">Organic clicks</th>
                <th className="px-3 py-3">Leads</th>
                <th className="px-3 py-3">Bookings</th>
                <th className="px-5 py-3 text-right">Booked revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.pages.map((row) => (
                <tr key={row.page}>
                  <td className="max-w-[360px] truncate px-5 py-4 text-xs font-bold">
                    {row.page.replace("https://southernrevelrytx.com", "") ||
                      "/"}
                  </td>
                  <td className="px-3 py-4 font-mono text-xs">
                    {row.organicClicks}
                  </td>
                  <td className="px-3 py-4 font-mono text-xs">{row.leads}</td>
                  <td className="px-3 py-4 font-mono text-xs">
                    {row.bookings}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-xs font-bold">
                    {formatCents(row.bookedRevenueCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="mt-4 rounded-lg border border-turquoise/35 bg-[#e9f7f4] px-4 py-3 text-[10px] leading-5 text-[#285e59]">
        Privacy boundary: Search Console query rows are used for page-level
        opportunity analysis only. A query is not claimed as the source of a
        specific lead.
      </p>
    </div>
  );
}
