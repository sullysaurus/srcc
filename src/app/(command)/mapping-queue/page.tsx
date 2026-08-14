import { AlertCircle, Check, Eye, Layers3 } from "lucide-react";

import { getOrganizationContext } from "@/lib/auth/organization-context";
import { applyMappingDecision } from "./actions";

const serviceOptions = [
  "Photo Booth",
  "360 Booth",
  "GlamBOT",
  "Dance Floor",
  "Bar Services",
  "Margarita Machine",
  "Multiple Services",
  "Unknown",
];
const statusOptions = [
  "Inquiry",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Follow-up",
  "Proposal Signed",
  "Retainer Paid",
  "Planning",
  "Completed",
  "Lost",
  "Archived",
];

export default async function MappingQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ resolved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const context = await getOrganizationContext();
  const { data } = context
    ? await context.supabase
        .from("mapping_queue")
        .select(
          "id,field_name,source_value,suggested_value,affected_count,created_at,source_records(raw_values,source_row_number,source_tab)",
        )
        .eq("organization_id", context.organizationId)
        .eq("status", "pending")
        .order("created_at")
    : { data: [] };
  const rows = data ?? [];
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(
      `${row.field_name}:${row.source_value}`,
      (counts.get(`${row.field_name}:${row.source_value}`) ?? 0) + 1,
    );
  return (
    <div className="pb-20 lg:pb-0">
      <div className="mb-7">
        <p className="font-mono text-[9px] font-bold tracking-[.15em] text-coral uppercase">
          Data quality / Human decisions
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-[-.04em] sm:text-5xl">
          Ambiguity belongs in the light.
        </h1>
        <p className="mt-3 text-sm text-ink/52">
          No fuzzy matches. Approved decisions apply to matching pending rows
          and are remembered for future imports.
        </p>
      </div>
      {params.resolved ? (
        <p className="mb-4 rounded-lg border border-moss/25 bg-[#edf6e9] px-4 py-3 text-xs font-bold text-moss">
          Mapping applied to {params.resolved} row
          {params.resolved === "1" ? "" : "s"}.
        </p>
      ) : null}
      {params.error ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-coral/25 bg-[#fff0e9] px-4 py-3 text-xs font-bold text-coral"
        >
          The mapping could not be applied.
        </p>
      ) : null}
      <section className="paper overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between border-b p-5">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-coral" />
            <p className="text-xs font-bold">
              {rows.length} source rows need review
            </p>
          </div>
          <span className="rounded-full bg-coral px-2.5 py-1 font-mono text-[9px] font-bold text-white">
            {counts.size} values
          </span>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="bg-ink/[.035] font-mono text-[8px] tracking-[.11em] text-ink/44 uppercase">
                <tr>
                  <th className="px-5 py-3">Source value</th>
                  <th className="px-3 py-3">Field</th>
                  <th className="px-3 py-3">Affected</th>
                  <th className="px-3 py-3">Canonical mapping</th>
                  <th className="px-5 py-3 text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => {
                  const source = Array.isArray(row.source_records)
                    ? row.source_records[0]
                    : row.source_records;
                  const options =
                    row.field_name === "service"
                      ? serviceOptions
                      : statusOptions;
                  return (
                    <tr key={row.id}>
                      <td className="px-5 py-4">
                        <p className="font-mono text-xs font-bold">
                          {row.source_value}
                        </p>
                        <details className="mt-2 text-[9px] text-ink/42">
                          <summary className="flex cursor-pointer items-center gap-1">
                            <Eye className="size-3" /> Review original row{" "}
                            {source?.source_row_number}
                          </summary>
                          <pre className="mt-2 max-w-sm overflow-auto rounded bg-ink p-3 text-[8px] text-white">
                            {JSON.stringify(source?.raw_values ?? {}, null, 2)}
                          </pre>
                        </details>
                      </td>
                      <td className="px-3 py-4 text-xs capitalize">
                        {row.field_name}
                      </td>
                      <td className="px-3 py-4">
                        <span className="inline-flex items-center gap-1 text-xs font-bold">
                          <Layers3 className="size-3.5 text-ink/35" />
                          {counts.get(
                            `${row.field_name}:${row.source_value}`,
                          )}{" "}
                          rows
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <form
                          id={`mapping-${row.id}`}
                          action={applyMappingDecision}
                        >
                          <input type="hidden" name="queueId" value={row.id} />
                          <select
                            name="canonicalValue"
                            aria-label={`Map ${row.source_value}`}
                            defaultValue={row.suggested_value ?? options[0]}
                            className="h-9 rounded-lg border bg-white px-2 text-xs font-bold"
                          >
                            {options.map((option) => (
                              <option key={option}>{option}</option>
                            ))}
                            <option value="__exclude__">
                              Exclude this value
                            </option>
                          </select>
                        </form>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          form={`mapping-${row.id}`}
                          className="inline-flex h-9 items-center gap-2 rounded-lg bg-ink px-3 text-[10px] font-bold text-white"
                        >
                          <Check className="size-3.5" /> Apply
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid place-items-center px-6 py-16 text-center">
            <Check className="size-8 text-moss" />
            <p className="mt-4 font-display text-2xl">
              The mapping queue is clear
            </p>
            <p className="mt-2 text-xs text-ink/45">
              Ambiguous imported values will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
