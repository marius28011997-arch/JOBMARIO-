# JOBMARIO online intake

Supabase project: alqbxizpxfguymbcfsgv (Frankfurt, free plan).
Database migrations in this repository match the versions already applied.
The submit-job Edge Function is deployed. config.js contains a public key only.

## Data flow

The frontend posts to submit-job. This function validates the public application
key and input size, then calls submit_job with its server-only service-role key.
The public key identifies the application, not a customer; submissions are anonymous.
The SQL function runs as invoker and is executable only by service_role.
Private contact data stays in jobmario_private.requests. Public visitors can only
read reviewed summaries in public.published_jobs, protected with read-only RLS.
No personal records are written to localStorage or silently imported from old storage.

Before publication, the operator reviews a request and copies a summary without
personal data to public.published_jobs using the same ID. Unreviewed submissions
never appear automatically. Delete the private request to cascade its public entry.

## Pilot limits

An advisory transaction lock serializes the quota check and insert. The limits are
30 requests/hour, 200/day, 2000/rolling 30 days globally and 3/email/day.
Identical retries with the same UUID return the existing ID; changed payloads fail.
These limits bound writes but do not prove human identity or prevent denial of service.
Add server-verified CAPTCHA before broader promotion. A public app key and CORS are
not customer authentication. Raw anonymous SQL submission must remain revoked.

Payments, lead unlocking, automatic matching and an admin UI are not implemented.
Operator identity, contact/imprint and appropriate privacy information are still
needed before promoting the service for real customer use; no details were invented.

## Verification

Passed: node --check app.js, node tests/client.cjs, node tests/edge.cjs.
Client DOM/API and Edge backend are mocked in those tests.
Real database rollback tests passed for saving, retry idempotency, conflicting UUIDs,
per-email quotas and denial of public access to contacts and write operations.
Security advisor: only informational RLS-with-no-policy on the intentionally closed
private requests table. No public policy is intended on that table.
Browser test: tests/browser.cjs requires Playwright plus Chromium. Chromium download
was unavailable here. Outbound direct HTTP to the deployed endpoint also timed out;
full browser-to-Edge integration therefore still needs a live smoke test.

Official references:
https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
https://supabase.com/docs/guides/database/functions
