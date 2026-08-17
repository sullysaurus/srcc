import { AlertTriangle, CheckCircle2, KeyRound, Unplug } from "lucide-react";
import Link from "next/link";
import { loadIntegrationState } from "@/lib/dashboard-data";
const connectors = [
  {
    name: "HoneyBook",
    status: "Choose sync method",
    detail: "Automatic via Zapier or manual HoneyBook CSV upload",
    tone: "ready",
    fresh: "Not connected",
  },
  {
    name: "Google Ads",
    status: "Needs credentials",
    detail: "Customer 642-374-2750 · read-only at launch",
    tone: "warn",
    fresh: "Never synced",
  },
  {
    name: "Search Console",
    status: "Needs authorization",
    detail: "sc-domain:southernrevelrytx.com · read-only",
    tone: "warn",
    fresh: "Never synced",
  },
  {
    name: "Historical Google Sheet archive",
    status: "Retired source",
    detail: "Preserved for audit only · excluded from the live pipeline",
    tone: "neutral",
    fresh: "Historical import retained",
  },
  {
    name: "Company email",
    status: "Planned",
    detail: "Metadata + summary only; uncertain matches queued",
    tone: "neutral",
    fresh: "Phase 3",
  },
  {
    name: "Website attribution",
    status: "Install needed",
    detail: "First-touch, UTMs, and Google click IDs · no form PII",
    tone: "warn",
    fresh: "No sessions captured",
  },
];
export default async function IntegrationsPage() {
  const live = await loadIntegrationState();
  const issueGroups = Object.values(
    (live?.issues ?? []).reduce(
      (groups, issue) => {
        const key = `${issue.provider}:${issue.issue_key}`;
        const current = groups[key] ?? { ...issue, count: 0 };
        current.count += 1;
        groups[key] = current;
        return groups;
      },
      {} as Record<
        string,
        NonNullable<typeof live>["issues"][number] & { count: number }
      >,
    ),
  ).sort((left, right) => right.count - left.count);
  const byProvider = new Map(
    (live?.connections ?? []).map((connection) => [
      connection.provider,
      connection,
    ]),
  );
  const rendered = connectors.map((item) => {
    const provider = item.name.startsWith("Google Ads")
      ? "google_ads"
      : item.name.startsWith("Search Console")
        ? "search_console"
        : item.name.startsWith("HoneyBook")
          ? "honeybook_zapier"
          : item.name.startsWith("Google Sheets")
            ? "google_sheets"
            : item.name.startsWith("Company email")
              ? "gmail"
              : item.name.startsWith("Website attribution")
                ? "website_attribution"
                : null;
    const connection = provider ? byProvider.get(provider) : null;
    const manualHoneyBook =
      item.name === "HoneyBook" ? byProvider.get("honeybook_manual") : null;
    const honeyBookFresh = [
      connection?.last_success_at,
      manualHoneyBook?.last_success_at,
    ]
      .filter(Boolean)
      .sort()
      .at(-1);
    return {
      ...item,
      status:
        item.name === "Website attribution"
          ? (live?.attributionSessions ?? 0) > 0
            ? "capturing"
            : "install needed"
          : item.name === "HoneyBook" &&
              manualHoneyBook?.status === "connected" &&
              connection?.status !== "connected"
            ? "manual upload ready"
            : (connection?.status?.replaceAll("_", " ") ?? item.status),
      fresh:
        item.name === "Website attribution"
          ? `${live?.attributionSessions ?? 0} sessions · ${live?.attributedProjects ?? 0} projects claimed`
          : (honeyBookFresh ?? connection?.last_success_at)
            ? new Date(
                String(honeyBookFresh ?? connection?.last_success_at),
              ).toLocaleString("en-US", {
                timeZone: "America/Chicago",
              })
            : item.fresh,
      provider,
    };
  });
  return (
    <div className="pb-20 lg:pb-0">
      <div className="mb-7">
        <p className="font-mono text-[9px] font-bold tracking-[.15em] text-coral uppercase">
          System health / Provider boundaries
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-[-.04em] sm:text-5xl">
          Trust the connections—or know why not.
        </h1>
        <p className="mt-3 text-sm text-ink/52">
          Tokens stay server-side and encrypted. Production conversion uploads
          remain locked until explicitly approved.
        </p>
      </div>
      <div className="grid gap-4">
        {rendered.map((item) => (
          <section
            key={item.name}
            className="paper flex flex-col gap-4 rounded-xl border p-5 lg:flex-row lg:items-center"
          >
            <span
              className={`grid size-11 shrink-0 place-items-center rounded-xl ${item.status === "connected" || item.status === "capturing" || item.tone === "ready" ? "bg-moss/12 text-moss" : item.tone === "warn" ? "bg-marigold/20 text-marigold" : "bg-ink/8 text-ink/45"}`}
            >
              {item.status === "connected" ||
              item.status === "capturing" ||
              item.tone === "ready" ? (
                <CheckCircle2 className="size-5" />
              ) : item.tone === "warn" ? (
                <AlertTriangle className="size-5" />
              ) : (
                <Unplug className="size-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-semibold">
                  {item.name}
                </h2>
                <span className="rounded-full border bg-panel px-2 py-1 text-[8px] font-bold uppercase">
                  {item.status}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-ink/48">{item.detail}</p>
            </div>
            <div className="lg:text-right">
              <p className="font-mono text-[8px] text-ink/35 uppercase">
                Last successful sync
              </p>
              <p className="mt-1 text-xs font-bold">{item.fresh}</p>
            </div>
            {item.provider === "google_ads" ||
            item.provider === "search_console" ||
            item.provider === "gmail" ||
            item.provider === "google_sheets" ? (
              <a
                href={`/api/google/oauth/start?provider=${item.provider}`}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-panel px-3 text-[10px] font-bold"
              >
                <KeyRound className="size-3.5" />{" "}
                {item.status === "connected" ? "Reconnect" : "Connect"}
              </a>
            ) : item.provider === "honeybook_zapier" ? (
              <Link
                href="/integrations/honeybook"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-panel px-3 text-[10px] font-bold"
              >
                <KeyRound className="size-3.5" /> Setup guide
              </Link>
            ) : item.provider === "website_attribution" ? (
              <Link
                href="/attribution"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-panel px-3 text-[10px] font-bold"
              >
                Setup details
              </Link>
            ) : (
              <span className="text-[10px] text-ink/40">
                No action required
              </span>
            )}
          </section>
        ))}
      </div>
      {issueGroups.length ? (
        <section className="mt-5 rounded-xl border border-marigold/45 bg-marigold/[.08] p-5">
          <p className="text-xs font-bold">Open integration issues</p>
          <ul className="mt-3 space-y-2 text-[10px] text-ink/55">
            {issueGroups.map((issue) => (
              <li key={`${issue.provider}-${issue.issue_key}`}>
                {issue.provider}: {issue.title}
                {issue.count > 1 ? ` · ${issue.count} affected` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="mt-5 rounded-xl border border-[#d79f92] bg-coral/[.08] p-5">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#a44236]" />
          <div>
            <p className="text-xs font-bold">Conversion uploads are disabled</p>
            <p className="mt-2 max-w-3xl text-[10px] leading-5 text-ink/55">
              Enablement requires tested tracking, confirmed conversion-action
              ownership, accepted customer data terms, verified deduplication,
              and an explicit production approval recorded in the audit log.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
