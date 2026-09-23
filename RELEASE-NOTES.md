# Release Notes

For the handful of people self-hosting a fork of **browser-comments** (the product is now presented as **dev·tix**; the repo name is unchanged). **⚠️ marks a breaking change** you need to act on when you pull.

Schema migrations are **additive and lazy** — the database upgrades itself on the first request after you deploy (or run `npm run init-db`). Back up first if your data matters; see the Migration Ledger in `docs/CURRENT-STATUS.md`.

---

## Owner digest — one daily email across every client (schema v7)

- **New:** a single daily email to the operator summarizing feedback from **all**
  clients, grouped client → project, one line per ticket with a deep link to it.
  This is separate from the per-client digests (which are addressed to each
  client and opted into in their Settings → Notifications).
- **New env:** `OWNER_DIGEST_TO` (comma-separated). **Unset = off**, so nothing
  changes for existing installs. Fires at `EMAIL_DIGEST_HOUR` in
  `EMAIL_DIGEST_TZ` on the existing hourly `/api/cron/digest` tick.
- ⚠️ **Operator-only by design.** This email crosses the per-client boundary and
  each deep link carries that client's magic-link token. Send it to yourself
  only — never to a client address. `EMAIL_ALLOWLIST` is a useful second gate.
- **Schema v7 is additive:** one nullable column,
  `instance_settings.last_owner_digest_at` (the send checkpoint).
- **Fixed:** the **first** digest mislabelled its contents. With no checkpoint
  yet there was no "since" to compare against, so every ticket was announced as
  *new* — including old ones that merely matched the "resolved recently" arm.
  `created` vs `resolved` is now decided in SQL against the same window boundary.
  **This affected the existing per-client digest too, and is fixed there as well.**
- **Fixed:** ticket deep links in notification emails and webhook payloads. They were built as
  `?c=<ref>` (e.g. `?c=LWF-12`), but the portal parsed `?c=` with `parseInt` —
  so the linked ticket was never actually highlighted. `?c=` now accepts a
  **ref or a legacy display number**, and no longer lets the default "open"
  status filter hide the very ticket the link points at. The portal also stopped
  stripping `?c=` from the address bar on load, so a refresh or copied link keeps
  the ticket; `?status=all` is now accepted and round-trips. No API or widget change.

## Owner login & admin moved — `/admin`

- The admin panel is now at **`/admin`**, behind a real owner login (Better Auth, email + password, sessions in Postgres). The **first visit creates the owner** account; further sign-ups are rejected (single owner).
- ⚠️ **`?admin=SECRET` / `ADMIN_SECRET` are deprecated.** They still work as an `Authorization: Bearer <ADMIN_SECRET>` break-glass path so existing scripts don't break — but move to the owner login when you can.
- **New dependency:** `better-auth`.
- **New env:** `BETTER_AUTH_SECRET` (≥32 chars — `openssl rand -base64 32`) and `BETTER_AUTH_URL` (your public https origin). Set both in production.
- Auth tables (`user` / `session` / `account` / `verification`) are created automatically by `npm run init-db` and the lazy fallback.
- Not built yet: password reset (recover via DB re-bootstrap) and 2FA.

## Writes now require a token

- ⚠️ **All write endpoints require a scoped token** (comments, batch-update, decisions, assignees). Pass it as `Authorization: Bearer <TOKEN>`.
- ⚠️ `POST /api/comments` requires an in-scope `projectId` and a `data:image/*` payload ≤ 4 MB.
- ⚠️ `GET /api/decisions` now requires a token.
- `primaryColor` must be a hex value; the annotation canvas exports **JPEG**.
- Built-in rate limits (20 writes/min, 60 reads/min per IP + key, env-overridable). Real enforcement needs Vercel WAF rules — recipe in `docs/RATE-LIMITING.md`.
- Removed the `/api/proxy` endpoint (SSRF surface).

## Refs, numbering & branding (schema v4)

- The comments API adds **`uuid`**, **`project_number`**, and a human **`ref`** (e.g. `LWF-12`). Decisions add `comment_ref`; settings add `branding`.
- `GET /api/comments/[id]` also accepts a **ref** or **uuid** (bare integers still resolve as legacy serial IDs). `projects` PATCH accepts `refPrefix`.
- ⚠️ **First run against a v3 database backfills and de-duplicates** historic `display_number`s. Additive, but it rewrites some numbers — see the Migration Ledger.
- New canonical migration runner: **`npm run init-db`** (lazy init kept as a zero-config fallback).

## Webhooks & polling (schema v5)

- New **`webhooks`** table + token-scoped **`/api/webhooks`** CRUD. The signing **secret is shown only once**, at creation.
- Webhook payloads are **HMAC-signed**: `X-BC-Signature: sha256=<hmac-of-raw-body>`. ⚠️ **Verify the signature before trusting a payload** (compute the HMAC over the exact received bytes). Events: `comment.created`, `comment.updated` (status/assignee only).
- Polling: **`GET /api/comments?since=<ISO8601>`** returns new/changed comments; read the **`X-Server-Time`** response header and use it as your next `since` (skew-free, exactly-once).
- ⚠️ **`GET /api/comments/[id]` now returns the full record.** The image moved behind `?includeImage=true`; the legacy `{ image_data }` shape is behind `?imageOnly=true`. **Update the CLI and MCP** so single-ticket image fetches keep working: `npm i -g @jomafilms/browser-comments-cli` (and pull the latest MCP).
- `POST /api/widget` responses now include the ticket **`ref`**.
- New optional env: `WEBHOOK_BASE_URL` (canonical origin for payload links), `WEBHOOK_ALLOW_LOOPBACK=false` (forbid loopback targets in hosted prod).
- CLI: `watch --since-file` streams new/changed tickets exactly once across restarts; `show/resolve/reopen/assign` accept refs/uuids/legacy numbers. MCP: `list_tickets` gains `since`; all tools accept refs/uuids.

Full agent wiring recipes: `docs/AGENT-SETUP.md`.

## Email notifications — opt-in (schema v6)

- **Opt-in email** hangs off the same notify hook as webhooks — it never blocks or 500s the write path, and is **off by default per client**. The product runs fine with no email vendor configured (one startup warning, zero errors).
- **Providers:** set `RESEND_API_KEY` + `EMAIL_FROM` (Resend, via REST — no dep) **or** `SMTP_HOST`/`SMTP_PORT`[`/SMTP_USER`/`SMTP_PASS`] + `EMAIL_FROM` (nodemailer, lazy-loaded). Resend needs a verified sending domain (human step).
- **What sends:** instant email on a new ticket (opt-in, hourly cap), a resolved notice, and an hourly/daily **digest** via a Vercel cron at `/api/cron/digest` (registered in `vercel.json`).
- New **optional** env: `RESEND_API_KEY`+`EMAIL_FROM` or the `SMTP_*` set; `CRON_SECRET` (guards the digest cron — the endpoint is closed when unset); `EMAIL_BASE_URL`, `EMAIL_ALLOWLIST`, `EMAIL_INSTANT_CAP_PER_HOUR`, `EMAIL_DIGEST_HOUR`/`EMAIL_DIGEST_TZ`.
- New dep: `nodemailer` (only imported when SMTP is configured).
- ⚠️ **Schema v6 (additive):** first run on a v5 DB adds `clients.notification_settings` (JSONB) + `clients.last_digest_at`; notifications stay off until configured and opted-in per client.
- Configure per client in **Settings → Notifications** (recipients + mode).

## Widget UX

- Submitter name and last-used annotation color now persist per browser.
- No more `alert()` popups from the widget — errors are inline.
- `html2canvas-pro` is **self-hosted in `public/vendor/`** (with an SRI-pinned CDN fallback). If you update `public/widget.js` on a self-hosted install, **also copy `public/vendor/`** (it still works without it via the CDN fallback).
- `public/widget.js` is now a **generated artifact**. Contributors edit `widget-src/` and run **`npm run build:widget`** — embedders are unaffected (same single script tag).

---

## Upgrading a fork — checklist

1. Set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, deploy, then visit `/admin` to create your owner account.
2. Update tooling: `npm i -g @jomafilms/browser-comments-cli` and pull the latest MCP.
3. If you fetch single-ticket **images**, switch to `GET /api/comments/<ref>?includeImage=true`.
4. Move any `?admin=` scripts to a Bearer token or the owner login.
5. Ensure every **write** call sends a scoped token.
6. The first request after deploy auto-migrates the DB (additive, v3 → v5) — back up beforehand if you care about the data.
