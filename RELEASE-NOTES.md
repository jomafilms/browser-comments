# Release Notes

For the handful of people self-hosting a fork of **browser-comments** (the product is now presented as **dev·tix**; the repo name is unchanged). **⚠️ marks a breaking change** you need to act on when you pull.

Schema migrations are **additive and lazy** — the database upgrades itself on the first request after you deploy (or run `npm run init-db`). Back up first if your data matters; see the Migration Ledger in `docs/CURRENT-STATUS.md`.

---

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
