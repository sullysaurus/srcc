# Implementation plan

## Architecture decisions

- Next.js App Router on Vercel; React Server Components for reads and server actions/route handlers for mutations.
- Supabase Postgres and Auth; SQL migrations are authoritative and RLS is the final tenant boundary.
- Three trust zones: signed-in RLS client, server-only service-role client for bounded jobs/webhooks, and OAuth tokens encrypted before persistence.
- HoneyBook remains authoritative for projects, contracts, smart files, invoices, and payments. The command center owns reporting, follow-ups, mapping, attribution, health, and audit history.
- Raw provider/source fields stay separate from canonical values. Stable provider IDs match first; normalized email/phone are controlled fallbacks; uncertain cases enter `mapping_queue`.
- Money uses integer cents. Timestamps use UTC; organization and event IANA timezones control display.
- Google Ads and Search Console launch read-only. Conversion uploads default to `disabled` and require recorded human approval.

## Safe phases

1. **Foundation — implemented:** identity/RLS, historical CSV import, normalized pipeline, manual follow-ups/services, provenance, audit/sync health, accessible responsive shell.
2. **Read-only providers — implemented:** HoneyBook/Zapier event processor with encrypted retained payloads and daily dead-letter retries; Google OAuth with PKCE, encrypted refresh tokens, Ads reporting sync, Search Console property selection/reporting, scheduler routes, and provider health diagnostics. Real credentials and payload mapping still require administrator setup.
3. **Closed loop — implemented:** privacy-conscious website attribution capture and signed claim tokens, exact HoneyBook project linking, Gmail metadata-only synchronization with mapping queue, separately authenticated proposal-view intake, and page-level organic/revenue reporting without person-level Search Console query claims.
4. **Guarded automation — staging implemented:** enhanced-conversion/offline outcome candidates, deterministic deduplication, encrypted click IDs, hashed user data, local dry-run validation, owner-recorded prerequisites, operational alerts, and recommendations. The Google Ads mutation executor is intentionally absent. Production activation still requires all five recorded gates plus the server kill switch and a separate release implementing and testing the provider write call.

## Reused Zim Zoom patterns

The reference app supplied reusable architectural patterns: separate Supabase clients by trust boundary, SQL-first RLS, mock-first provider contracts, bounded sync runs, idempotent webhook rows, protected Vercel cron endpoints, source-aware metrics, and a persistent responsive command shell. Southern Revelry has its own schema and visual system; no Zim Zoom operational assumptions were carried over.

## Human-controlled prerequisites

- Create/link a Supabase project, enable desired sign-in providers, and add the first owner membership.
- Create a Google Cloud project, configure OAuth consent/redirect URIs, and authorize the Southern Revelry company account.
- Obtain approved Google Ads API developer-token access and confirm whether a manager account is required.
- Confirm ownership of Ads customer `642-374-2750`, conversion actions, and customer-data terms.
- Confirm or create the Search Console Domain property `sc-domain:southernrevelrytx.com` and complete DNS verification.
- Export the `Leads` tab from spreadsheet `1lUTpjMwMqTqh9y4N9bEHAL1lyeh0swt1i0KmaAdXuOc` as CSV or authorize narrowly scoped Sheets read access.
- Create supported HoneyBook Zapier triggers and configure a high-entropy shared secret.
- Select the company mailbox and retention policy; full message bodies are off by default.
- Create Vercel environment variables and cron secret. Never place credentials in chat or source control.
