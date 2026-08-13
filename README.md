# Southern Revelry Command Center

Operations, sales, advertising, and SEO reporting for Southern Revelry. HoneyBook remains authoritative for projects, contracts, smart files, invoices, and payments. This app owns operational reporting, attribution, mappings, follow-ups, synchronization health, and audit history.

## Foundation status

Phases 1 and 2 are implemented as a deployable, mock-safe application: Next.js App Router, TypeScript, Tailwind, Supabase Auth, organization roles and RLS, normalized pipeline schema, source-preserving CSV import, mapping queue, supported HoneyBook/Zapier event processing, encrypted Google OAuth, read-only Google Ads and Search Console synchronization, integration health diagnostics, protected scheduled jobs, and deterministic tests.

Google Ads and Search Console screens use fictional preview records until their production connections are authorized. Their connectors are intentionally read-only. HoneyBook ingestion accepts only the supported Zapier trigger contract listed in the webhook validator; unsupported message or proposal-view capabilities are never inferred.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

With Supabase variables absent, the app runs as a clearly labeled fictional preview. See [docs/admin-setup.md](docs/admin-setup.md) before enabling live data.

## Quality checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```
