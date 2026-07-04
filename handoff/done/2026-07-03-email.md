# Lane: email — Resend notifications on the notify hook

**TL;DR:** Email lands AFTER webhooks (Annie's call). Two-lane model copied from BugHerd, simplified: instant email on new ticket (opt-in per project) + digest at hourly/daily/never (default daily). Resend-first with SMTP fallback so self-hosters aren't locked in; no email vendor is required to run the product.

**Depends on:** agent-plumbing merged (lib/notify.ts channel interface is the hook), better-auth merged (owner email exists; settings UI home).

## What exists / don't rebuild
- `lib/notify.ts` (agent-plumbing lane): `onCommentCreated/onCommentUpdated` with a channel list — email is a new channel, not a new hook.
- Annie has a Resend account (sends from @joma.film domains today; instance will need its own verified domain — human step, document it).
- `clients.widget_settings` JSONB pattern — reuse for notification settings shape.

## The build
1. **`lib/email.ts` provider abstraction (~50 lines):** `RESEND_API_KEY` set → Resend API; else `SMTP_HOST/PORT/USER/PASS` → nodemailer; else disabled with one startup warning. `EMAIL_FROM` env. Add all to .env.example.
2. **Settings** (SCHEMA_VERSION bump, additive): `notification_settings` JSONB on clients: `{recipients: [emails], newTicket: 'instant'|'digest'|'off', digestCadence: 'hourly'|'daily', resolvedNotice: bool}`. Defaults: off (opt-in — never surprise-email anyone). UI: fields on the /admin client editor + the client settings page (client can manage their own recipients).
3. **Instant channel:** on comment.created, if instant → send via waitUntil. Template: ticket ref, page, comment text, submitter, thumbnail if cheap, deep link to dashboard. Plain, readable, no marketing chrome. **Use `resolveBranding()`** (data-model lane) for header/footer: company name + logo if set, "questions? support@…" footer from supportEmail — the operator's brand, not browser-comments'.
4. **Digest:** `app/api/cron/digest/route.ts` + vercel.json cron (hourly tick; route decides who's due — daily sends at recipient-local 9am default, store `lastDigestAt`). Digest = tickets created/resolved since last digest, grouped by project, count + one-liners + links. Skip empty digests. Guard the route with `CRON_SECRET` (Vercel cron header pattern).
5. **Resolved notice** (cheap win, uses onCommentUpdated): "your ticket LWF-12 was resolved" to the submitter — ONLY if submitter email exists... it doesn't today (widget captures name only). Default: send resolved notices to the client recipients list instead. Adding an optional email field to the widget is OUT of scope (note as follow-up — needs Annie's call, it changes the anonymous-feedback promise).
6. **Docs:** setup section (Resend key OR SMTP; domain verification steps for Resend) in the consolidated docs; RELEASE-NOTES entry.

## Guardrails
- Outbound email to real people = human gate: test against Annie's own address only; enabling for real clients is Annie's explicit step post-merge.
- Never block the request path on email (waitUntil, catch-all error handling — a Resend outage must not break ticket creation).
- Rate sanity: cap instant emails per client per hour (default 20, then auto-fold into digest) — a spam attack must not become an email flood.
- Schema via /migrate on DEV; prod is a human gate.
- No tracking pixels; unsubscribe = settings link (self-hosted tool, not marketing mail).

## Acceptance
- With RESEND_API_KEY (Annie's test key): instant email arrives for a test-widget submission; digest cron fires locally (`curl` with secret) and sends a correct summary; empty digest sends nothing.
- With no email env vars: everything works, one warning, zero errors.
- SMTP path verified against a local mailpit/mailhog container OR documented-as-untested in lane file if setup is a yak-shave.
- `npx tsc --noEmit` + `npm run build` clean.

## Open questions (take defaults, note in lane file)
- Digest send hour → default 9am America/Los_Angeles (make it a setting later if asked).
- React Email dependency vs hand-rolled HTML → default: hand-rolled single template file (fewer deps; React Email only if templates multiply).
- Per-PROJECT overrides → default: client-level only for v1.
