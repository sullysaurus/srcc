# Administrator setup guide

## 1. Supabase

1. Create a Supabase project in the desired US region.
2. The selected project URL is `https://xnoqdporgtmfqtkebwtj.supabase.co`. Apply all migrations in `supabase/migrations/` in order.
3. Configure authentication redirect URLs for local and Vercel environments.
4. Create the first Auth user, then insert an active `owner` membership for the seeded Southern Revelry organization.
5. Set the publishable key only in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Keep the service-role key server-side.
6. Run the RLS test suite against a disposable local database before production changes.

## 2. Environment variables

Copy `.env.example` locally and set values through Vercel project settings in production. Generate independent high-entropy values for `CRON_SECRET`, `HONEYBOOK_WEBHOOK_SECRET`, `OAUTH_STATE_SECRET`, and `OAUTH_TOKEN_ENCRYPTION_KEY`. The encryption key must be 32 random bytes encoded as base64 and stored only in the secrets manager. Never log or expose it to client code.

## 3. Google Cloud and OAuth

1. Create a dedicated Google Cloud project and configure the OAuth consent screen.
2. Add the deployed callback URI and the local callback URI.
3. Request only scopes needed by the connector. Search Console reporting uses read-only Search Console access. Sheets uses read-only access only if direct import is enabled. Gmail should use the narrowest metadata/read scope compatible with the approved design.
4. Store the client ID and client secret as server-side Vercel variables.
5. Encrypt refresh tokens before writing `sync_connections.encrypted_refresh_token`; record the key version separately.

## 4. Google Ads

1. Confirm access to customer `642-374-2750` in the company Google account.
2. Apply for or retrieve the Google Ads API developer token.
3. Record the manager customer ID if API access is through an MCC.
4. Set `GOOGLE_ADS_API_VERSION` to a currently supported Google Ads API version after checking the official release notes. It is deliberately not hardcoded.
5. Connect in read-only mode and verify account currency/timezone before the first sync.
6. Map conversion actions into Inquiry, Qualified lead, Proposal, Booked event, and Revenue collected.
7. Do not approve uploads until tracking tests pass, ownership is confirmed, customer data terms are accepted, and deduplication fixtures pass. Record explicit approval in `audit_log`.
8. Leave `GOOGLE_ADS_UPLOADS_ENABLED` unset during staging. The current release creates encrypted, deduplicated candidates and dry-run previews only; it contains no Google Ads mutation call. Enabling the variable alone cannot upload data.

## 5. Search Console

1. Sign in with the Southern Revelry company account.
2. Authorize Search Console read access.
3. Select `sc-domain:southernrevelrytx.com`.
4. If it does not exist, create a Domain property.
5. Verify ownership through DNS.
6. Return to the app, retrieve authorized properties through `/api/google/search-console/properties`, and save `sc-domain:southernrevelrytx.com`.
7. Expect normal Search Analytics freshness of roughly two to three days.

## 6. HoneyBook through Zapier

Open **Integrations → HoneyBook** and turn on automatic sync before testing. Create Zaps only for supported triggers: new inquiry, client created, project stage changed, project booked, payment received, and meeting scheduled. POST to `/api/webhooks/honeybook` with `x-webhook-secret`, `x-organization-id`, a unique event ID, and UTC occurrence time. Always map the stable HoneyBook project ID and exact HoneyBook stage. Map service, money, recent-activity, and project-link fields only when the selected trigger actually exposes them. The endpoint verifies the secret, enforces the enabled state and replay window, validates the payload, deduplicates it, and retains only a redacted payload summary. Proposal views and complete message history are not inferred from HoneyBook.

### Manual HoneyBook alternative

If Zapier is not enabled, export projects from HoneyBook and upload the CSV from the same HoneyBook integration panel. Include `Project ID` or `Project URL`; rows without either value are retained for review and do not update live projects. Repeated imports update by stable HoneyBook project ID. Use `/honeybook-import-template.csv` when the exported column names need to be rearranged.

## 7. Historical Google Sheet

The original `Leads` rows, raw values, and mapping decisions remain retained for audit. Sheet-derived projects are excluded from the live pipeline and command-center metrics. Do not use the workbook as a second live system of record.

## 8. Email

Choose the company mailbox and approve the retention policy. Gmail authorization requests `gmail.metadata`, not message-body access. Default storage is timestamp, direction, channel, subject, short internal summary, match, and external message ID. Queue uncertain matches.

## 9. Website attribution

1. Set `ATTRIBUTION_SIGNING_SECRET` to a unique high-entropy secret and restrict `ATTRIBUTION_ALLOWED_ORIGINS` to the production website origins.
2. Add `<script defer src="https://YOUR-COMMAND-CENTER/attribution.js" data-endpoint="https://YOUR-COMMAND-CENTER/api/public/attribution"></script>` to the public website.
3. Ensure the HoneyBook/Zapier inquiry payload forwards `sr_attribution_token` as `attribution_token` or under its original name.
4. Test `gclid`, `gbraid`, `wbraid`, UTM, landing-page, referrer, first-touch, and last-touch capture with a non-production inquiry.
5. The script does not read names, emails, phones, or message text. Attribution failure never blocks form submission.

## 10. Proposal activity

Only configure `/api/webhooks/proposal-activity` when a supported proposal provider can send a confirmed view with stable event, proposal, and project IDs. Set a separate `PROPOSAL_ACTIVITY_WEBHOOK_SECRET`. Do not route guessed HoneyBook proposal views to this endpoint.

## 11. Vercel and schedules

Import the repository into Vercel, configure all environment variables, and deploy. `vercel.json` uses Hobby-compatible daily schedules for HoneyBook retries, Gmail metadata sync, Google Ads, Search Console, integration-health checks, dry-run conversion staging, and operational recommendations. Verified HoneyBook webhooks still ingest events near real time. Disable a schedule until its connector has been tested independently. Provider failures create partial/failed `sync_runs` without blocking other sources. Vercel Hobby schedules may run at any point within the configured hour.

## 12. Rotation and disconnection

Rotate webhook, cron, OAuth client, and encryption secrets on a documented schedule and after suspected exposure. Disconnect controls must revoke provider access where supported, clear encrypted refresh-token material, set `disconnected_at`, and write an audit record. Never place token values in logs or audit JSON.
