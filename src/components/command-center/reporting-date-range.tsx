import { CalendarRange } from "lucide-react";
import Link from "next/link";
import type { ReportingRange } from "@/lib/domain/reporting-date-range";

export function ReportingDateRange({
  action,
  range,
  lagLabel,
}: {
  action: string;
  range: ReportingRange;
  lagLabel: string;
}) {
  return (
    <section
      aria-label="Reporting date range"
      className="paper rounded-xl border p-3 sm:p-4"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarRange className="size-4 text-coral" aria-hidden="true" />
            <p className="text-xs font-bold">Reporting window</p>
          </div>
          <p className="mt-1 text-[10px] text-ink/45">
            {range.from} through {range.to} · {lagLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Date presets">
          {[7, 30, 90, 365].map((days) => (
            <Link
              key={days}
              href={`${action}?days=${days}`}
              className={`rounded-full border px-3 py-2 font-mono text-[9px] font-bold uppercase transition ${range.preset === String(days) ? "border-ink bg-ink text-white" : "bg-cream text-ink/55 hover:border-ink/40"}`}
            >
              {days === 365 ? "1 year" : `${days} days`}
            </Link>
          ))}
        </div>
        <form action={action} className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 font-mono text-[8px] font-bold tracking-[.1em] text-ink/40 uppercase">
            From
            <input
              className="h-9 rounded-lg border bg-cream px-2 font-sans text-[11px] text-ink"
              type="date"
              name="from"
              defaultValue={range.from}
            />
          </label>
          <label className="grid gap-1 font-mono text-[8px] font-bold tracking-[.1em] text-ink/40 uppercase">
            To
            <input
              className="h-9 rounded-lg border bg-cream px-2 font-sans text-[11px] text-ink"
              type="date"
              name="to"
              defaultValue={range.to}
            />
          </label>
          <button className="h-9 rounded-lg bg-coral px-3 text-[10px] font-bold text-white shadow-[2px_2px_0_#171915] transition hover:-translate-y-px">
            Apply
          </button>
        </form>
      </div>
    </section>
  );
}
