import {
  BarChart3,
  Bell,
  ChevronRight,
  HeartHandshake,
  Import,
  LayoutDashboard,
  Link2,
  Mail,
  Map,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  { href: "/", label: "Command Center", icon: LayoutDashboard },
  { href: "/pipeline", label: "Sales Pipeline", icon: UsersRound, count: 7 },
  { href: "/advertising", label: "Google Ads", icon: BarChart3 },
  { href: "/seo", label: "Search & SEO", icon: Search },
  { href: "/attribution", label: "Attribution", icon: Link2 },
  { href: "/communications", label: "Communications", icon: Mail },
  { href: "/automation", label: "Automation & Alerts", icon: ShieldCheck },
  { href: "/imports", label: "Historical Import", icon: Import },
  { href: "/mapping-queue", label: "Mapping Queue", icon: Map, count: 12 },
  {
    href: "/integrations",
    label: "Integrations",
    icon: Settings2,
    warning: true,
  },
];

export function CommandShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[248px_1fr]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <aside className="hidden min-h-screen border-r border-white/10 bg-ink text-white lg:sticky lg:top-0 lg:block lg:h-screen">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 px-6 py-7">
            <div className="flex items-center gap-3">
              <span className="grid size-10 rotate-3 place-items-center rounded-[14px] bg-marigold text-ink shadow-[3px_3px_0_#f37b68]">
                <Sparkles className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-display text-xl leading-none">
                  Southern Revelry
                </p>
                <p className="mt-1 font-mono text-[9px] tracking-[0.18em] text-white/50 uppercase">
                  Operations ledger
                </p>
              </div>
            </div>
          </div>
          <nav aria-label="Primary" className="flex-1 space-y-1 px-3 py-5">
            {navigation.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition ${index === 0 ? "bg-white text-ink shadow-sm" : "text-white/62 hover:bg-white/8 hover:text-white"}`}
              >
                <item.icon className="size-4" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {item.count ? (
                  <span className="rounded-full bg-coral px-2 py-0.5 font-mono text-[9px] font-bold text-white">
                    {item.count}
                  </span>
                ) : null}
                {item.warning ? (
                  <span
                    className="size-2 rounded-full bg-marigold"
                    aria-label="Needs attention"
                  />
                ) : null}
              </Link>
            ))}
          </nav>
          <div className="m-3 rounded-xl border border-white/10 bg-white/[.05] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <HeartHandshake className="size-4 text-marigold" /> Today’s pulse
            </div>
            <p className="mt-2 text-xs leading-5 text-white/55">
              2 urgent leads and 3 events need an operations check.
            </p>
            <Link
              href="/pipeline"
              className="mt-3 flex items-center text-[11px] font-bold text-marigold"
            >
              Open worklist <ChevronRight className="size-3.5" />
            </Link>
          </div>
          <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4">
            <span className="grid size-8 place-items-center rounded-full bg-turquoise text-[10px] font-bold text-ink">
              SR
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">Southern Revelry</p>
              <p className="text-[10px] text-white/45">Owner workspace</p>
            </div>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-ink/10 bg-cream/90 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-xl bg-marigold text-ink lg:hidden">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-xs font-bold lg:hidden">Southern Revelry</p>
              <p className="font-mono text-[9px] tracking-[.14em] text-ink/50 uppercase">
                Thu, Aug 13 · Central time
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-moss/20 bg-moss/8 px-3 py-1.5 text-[10px] font-bold text-moss sm:flex">
              <span className="size-1.5 rounded-full bg-moss" /> Core data
              healthy
            </span>
            <button
              className="relative grid size-9 place-items-center rounded-full border bg-white"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-coral" />
            </button>
          </div>
        </header>
        <div className="border-b border-coral/15 bg-[#fff0e7] px-4 py-2 text-center font-mono text-[9px] font-bold tracking-[.1em] text-[#874b3c] uppercase sm:px-7">
          Foundation preview · fictional records only · connect Supabase to
          enable live operations
        </div>
        <main
          id="main-content"
          className="mx-auto max-w-[1540px] px-4 py-6 sm:px-7 sm:py-8"
        >
          {children}
        </main>
        <footer className="mx-auto mb-20 flex max-w-[1540px] items-center justify-center border-t border-ink/10 px-4 py-6 sm:px-7 lg:mb-0 lg:justify-end">
          <a
            href="https://raleighaiguy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[9px] font-bold tracking-[.12em] text-ink/38 uppercase transition hover:text-ink focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
          >
            Built by Raleigh AI Guy ↗
          </a>
        </footer>
        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-ink px-2 py-2 text-white lg:hidden"
          aria-label="Mobile"
        >
          {[
            navigation[0],
            navigation[1],
            navigation[2],
            navigation[3],
            navigation.at(-1)!,
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="grid place-items-center gap-1 text-[9px] text-white/65"
            >
              <item.icon className="size-4" />
              <span>{item.label.split(" ")[0]}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
