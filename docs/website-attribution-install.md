# Southern Revelry website attribution install

This change is intentionally prepared separately from the public website. Do
not publish it until the dashboard preview, HoneyBook test Zap, and form
submission test all pass.

Add this script once in the global footer, immediately before `</body>`:

```html
<script
  defer
  src="https://southernrevelry.vercel.app/attribution.js"
  data-endpoint="https://southernrevelry.vercel.app/api/public/attribution"
></script>
```

The script stores a random visitor key in the browser and attaches a signed
`sr_attribution_token`, click identifiers, UTMs, landing page, and referrer to
forms. It does not read or send names, email addresses, phone numbers, or form
message text. Capture failure never prevents a form submission.

Before publishing:

1. Load a staging page with `?gclid=sr-test-click&utm_source=google&utm_medium=cpc&utm_campaign=attribution_test`.
2. Confirm the form contains `sr_attribution_token`, `gclid`, and the UTM fields.
3. Submit a HoneyBook test inquiry assigned to the designated test team member.
4. Confirm the new-inquiry Zap forwards `sr_attribution_token` unchanged.
5. Confirm exactly one dashboard project receives first-touch and
   last-non-direct attribution.
6. Confirm the original HoneyBook inquiry and all existing automations still
   run normally.
