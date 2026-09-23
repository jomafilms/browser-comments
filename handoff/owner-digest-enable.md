# Handoff — turn the owner digest on (Resend)

**Mode:** fix / ops — small config task, NOT a build. The feature is already
written, reviewed, merged, and its schema is live on prod.

**Lane:** `digest-enable` · parallel-safe (touches only Vercel env + one client
setting; no repo files necessarily change) · solo not required.

---

## Goal

Annie receives one email a day, 9am America/Los_Angeles, listing every ticket
added (and resolved) across all clients since the last one, each line linking
straight to that ticket.

## Why this isn't done yet

Everything except the mail vendor shipped on 2026-09-23. The blocker is a human
step: **no email provider is configured on prod.** `/api/cron/digest` has been
running hourly since the email lane shipped (2026-07-03) and returning
`{"skipped":"email disabled (no provider configured)"}` every single tick.

## Settled — do not relitigate

- **One owner digest across all clients**, not six per-client emails. Annie
  chose this 2026-09-23.
- **Resend**, not SMTP. Also her choice.
- **No thumbnails.** Screenshots are base64 in `comments.image_data`; mail
  clients block `data:` URIs and there is no public image URL (the endpoint is
  token-gated), so a thumbnail would render broken. Lines link instead. Adding
  them means building a public thumbnail endpoint — a real task, not a flag.
- **Operator-only.** The digest crosses the per-client boundary and each deep
  link carries that client's magic-link token. It goes to Annie, never a client.

## Read & trace

- `lib/owner-digest.ts` — `runOwnerDigest()`, the orchestration + env gate
- `lib/db/owner-digest.ts` — the cross-client query + checkpoint
- `lib/email.ts` — provider precedence and `EMAIL_ALLOWLIST`
- `app/api/cron/digest/route.ts` — the hourly tick, `CRON_SECRET`-guarded
- `.env.example` — every env var involved, documented

## Do

1. **Annie creates a Resend account and verifies a sending domain** (DNS —
   cannot be done for her). `jomafilms.com` or a subdomain.
2. Set on Vercel prod (project `dev-tix`, team `annie-lundgrens-projects`):
   - `RESEND_API_KEY` — from Resend
   - `EMAIL_FROM` — e.g. `tickets@jomafilms.com`, on the verified domain
   - `OWNER_DIGEST_TO` — `annie@jomafilms.com`
   - Confirm `EMAIL_ALLOWLIST` already contains that address (it is set on prod;
     value hidden — check it, or the send will be silently dropped).
3. Redeploy (env changes need one).
4. **Smoke-test without waiting for 9am:** hit the cron route directly with the
   secret and check the `owner` key in the response.
   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" \
     https://dev-tix.vercel.app/api/cron/digest | jq .owner
   ```
   Off-hour it returns `{"status":"not-due"}` — that alone proves env + auth are
   right. To force a real send, temporarily set `EMAIL_DIGEST_HOUR` to the
   current PT hour, redeploy, re-curl, then put it back to `9`.
   ⚠️ A successful send advances `instance_settings.last_owner_digest_at`, so
   the next real digest covers only from that moment.
5. Confirm the email arrives and that clicking a ref opens that ticket.

## Done when

- A real digest lands in Annie's inbox.
- A ticket link opens the portal with that ticket highlighted (this is the one
  thing never exercised in a browser — see Open questions).
- `last_owner_digest_at` is non-null on prod.

## Open questions

- **`?c=<ref>` deep links are not browser-verified.** The logic was fixed and
  reviewed this lane (refs now resolve, the param survives the URL-sync effect,
  `status=all` round-trips), and rendering was verified — but no one has clicked
  one in a real browser, because this repo's active `DATABASE_URL` is the live
  Neon DB, so a local dev server runs against prod. Verify on the deployed site.
- Digest hour is instance-wide (`EMAIL_DIGEST_HOUR`). Per-client hours were
  parked in the email lane and are still parked.

## Known limitation to keep in mind

The "resolved" line matches any write to an already-resolved ticket, so adding a
note to an old resolved ticket re-lists it. A real fix needs a `resolved_at`
column. Pre-existing in the per-client digest; inherited here. Not a blocker.
