# browser-comments — Current Status

**Last Updated:** 2026-07-03
**Last Commit:** `agent-plumbing` lane — webhooks + polling (prior: `better-auth` owner login at /admin)
**Branch:** main
**Launch:** launched (production: https://dev-tix.vercel.app)  <!-- The /migrate skill reads this to gate prod DB migrations. -->

---

## What Was Last Done

- **email lane (Wave 4) SHIPPED** — 2026-07-03 → archived brief: handoff/done/2026-07-03-email.md
  - **Opt-in email notifications** hung off `lib/notify.ts`'s `after()` hooks as a channel beside webhooks — never blocks or 500s the write path (mail outage can't surface as an error). Off by default per client; the product runs fine with no email vendor configured.
  - **Provider abstraction (`lib/email.ts`):** `RESEND_API_KEY`+`EMAIL_FROM` → Resend via REST (no dep) → `SMTP_HOST/PORT[/USER/PASS]` → nodemailer (lazy-imported, only loads when SMTP set) → disabled with ONE startup warning. `EMAIL_ALLOWLIST` restricts recipients (staging/testing gate); `emailLinkBase()` canonical-origin helper.
  - **Templates (`lib/email-templates.ts`):** hand-rolled, XSS-escaped HTML (instant / digest / resolved / paused), branded via `resolveBranding()` (operator's company/logo/support — not browser-comments'). No tracking pixels; hand-rolled over React Email (fewer deps).
  - **Channel (`lib/email-notify.ts`):** instant email on new ticket (opt-in), in-memory hourly cap (default 20 → one "paused" notice → drop), resolved-notice to the client recipients list (widget captures no submitter email).
  - **Digest (`app/api/cron/digest/route.ts` + `vercel.json` hourly cron):** `CRON_SECRET` timing-safe guard (closed when unset); hourly-cadence every tick, daily-cadence at 9am America/Los_Angeles (`EMAIL_DIGEST_HOUR`/`_TZ`); tickets created/resolved grouped by project; skips empty digests; checkpoint (`last_digest_at`) advances only on send/skip. Due-ness computed DB-side — no naive-timestamp tz round-trip.
  - **Settings:** `app/api/notifications/route.ts` (token-scoped, client-level; project tokens read-only) + `components/NotificationSettings.tsx` wired into the client settings page AND the admin client editor (reuses client token). **Schema v6 (additive):** `clients.notification_settings` JSONB + `clients.last_digest_at`.
  - Verified: tsc + build clean; dev DB migrated v5→v6 (local only); no-env path works with one warning + zero errors; validation/allowlist/template-escaping/cron-auth (401/401/200-skipped)/notifications-read-path + all digest & settings-UPDATE SQL (rolled-back transactions). Independent adversarial security+correctness review: **SHIP** (no HIGH/MED; 2 LOW fixed — digest checkpoint on allowlist-skip, footer wording).
  - RELEASE-NOTES for fork owners: email notifications are **opt-in per client** (default off) — set recipients + mode in client Settings → Notifications. New dep `nodemailer` (only loaded when SMTP configured; Resend uses fetch). New **optional** env: `RESEND_API_KEY`+`EMAIL_FROM` OR `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS`+`EMAIL_FROM`; `CRON_SECRET` (guards the hourly digest cron); `EMAIL_BASE_URL`, `EMAIL_ALLOWLIST`, `EMAIL_INSTANT_CAP_PER_HOUR`, `EMAIL_DIGEST_HOUR`/`EMAIL_DIGEST_TZ`. With no email env, notifications are silently disabled (one warning) — everything else works. Schema v6 additive (first run on a v5 DB adds two columns, notifications off). `vercel.json` registers an hourly `/api/cron/digest` tick. Resend needs a verified sending domain (human step). **Password reset still not built** (the better-auth lane flagged it for email; not tackled here — parked).
  - Note: live Resend/SMTP send UNTESTED (no key in this env) — Annie's post-merge step, to `annie@jomafilms.com` only (`EMAIL_ALLOWLIST` set on prod). Follow-ups parked: optional submitter-email widget field (changes anonymity promise), per-project overrides, per-client digest hour, instant thumbnail, password-reset email.
- **agent-plumbing lane (Wave 3) SHIPPED** — 2026-07-03 → archived brief: handoff/done/2026-07-03-agent-plumbing.md
  - **Webhooks (schema v5, additive):** new `webhooks` table (client/project-scoped); token-scoped `/api/webhooks` CRUD (`lib/db/webhooks.ts`) — project token manages its project's hooks, client token all, admin all; signing secret shown **once** on create. `lib/notify.ts` fires **fire-and-forget** via `after()` (next/server; no new dep) from comments POST + widget POST + PATCH — channel-shaped so the email lane hangs its channel here without touching call sites. `lib/webhook-delivery.ts`: HMAC `X-BC-Signature: sha256=<hmac(raw body)>` + `X-BC-Event`, 5s timeout, 1 retry, **SSRF guard** (https-only; http loopback only; full IPv6 parser rejects private/loopback/link-local/metadata incl. hex-mapped `::ffff:` + NAT64; `redirect:'manual'`). Events: `comment.created`, `comment.updated` (status/assignee only). Screenshot omitted — fetch via `links.api?includeImage=true`.
  - **Polling:** `GET /api/comments?since=<ISO8601>` (updated-after; validated) + **`X-Server-Time` response header** as the skew-free checkpoint (body unchanged — still a plain array). ⚠️ `GET /api/comments/[id]` default changed to the **full record** (accepts id/uuid/ref, scope-checked); `?includeImage=true` adds image; **`?imageOnly=true` = legacy `{image_data}`** (Annie-accepted break — no in-repo callers; **older CLI/MCP installs must update** for single-ticket image retrieval).
  - **CLI:** watch double-tick + pool-close bugs fixed; `watch --since-file` streams new/changed tickets as JSON lines **exactly once across restarts**; list filters applied server-side; `show/resolve/reopen/assign` accept refs/uuids/legacy-numbers via the single-ticket endpoint (no full-list downloads for ref/uuid). **MCP:** `list_tickets` gains `since`; all tools accept refs/uuids everywhere. New `docs/AGENT-SETUP.md` (Claude Routine / GitHub repository_dispatch / plain watch recipes + signature verification) + minimal webhook UI on the settings page (`components/WebhooksSettings.tsx`).
  - Verified: tsc + build clean (app/cli/mcp) **after merging better-auth**; live — webhook HMAC valid + tamper rejected, SSRF metadata IP blocked (incl. hex-mapped IPv6 bypass caught by review), `?since=` round-trip, single-ticket by ref/uuid/id + cross-tenant 404, watch exactly-once across restarts. `/check` ran business rules + independent security review (found+FIXED two HIGH SSRF bypasses — hex-mapped-IPv6 + redirect-follow) + correctness review (SHIP). Merge-fix: better-auth made `isAdmin` async → awaited it in the webhooks route (unawaited Promise would have leaked all hooks to invalid tokens).
  - RELEASE-NOTES for fork owners: new `webhooks` table + `/api/webhooks`; webhook payloads HMAC-signed (`X-BC-Signature`), verify before trusting; `GET /api/comments?since=` + `X-Server-Time` header for polling; **`GET /api/comments/[id]` now returns the full record** (image behind `?includeImage=true`; legacy `{image_data}` behind `?imageOnly=true`) — **update CLI (`npm i -g @jomafilms/browser-comments-cli`) + MCP** so single-ticket image fetch keeps working; `POST /api/widget` response gains `ref`; CLI `watch --since-file` + ref-aware commands; MCP `since` + refs. New optional env: `WEBHOOK_BASE_URL` (canonical origin for payload links), `WEBHOOK_ALLOW_LOOPBACK=false` (forbid loopback targets in hosted prod).
  - Note: left test data cleaned from local dev DB. Deferred LOWs: per-field `comment.updated` fires one event per changed field (rare multi-field PATCH → 2 events); `lib/db/comments.ts` at 332 lines (split candidate); DNS-rebinding TOCTOU residual (undici IP-pinning unavailable; redirects closed + poll safety-net).
- **better-auth lane (Wave 3) SHIPPED** — 2026-07-03 → archived brief: handoff/done/2026-07-03-better-auth.md
  - **Real owner login** via Better Auth (`^1.6.23`, email+password, sessions in Postgres on the existing pg pool — no external auth service). Admin moved off `/?admin=SECRET` to **`/admin`** behind a session; `/admin/login` doubles as the first-run **create-owner** form (single owner: first sign-up bootstraps, a before-hook rejects every later sign-up — no public signup). `/` is now a stub redirect → `/admin` (landing lane replaces it).
  - **`requireAdmin`/`isAdmin` are now async** and accept EITHER a valid owner session OR the legacy `ADMIN_SECRET` bearer (deprecated break-glass / back-compat — existing installs + scripts keep working) in one code path. All admin-gated routes awaited. Client magic-links (`/c/{token}`) + agent API tokens (`requireToken`) untouched.
  - **Auth tables** (`user`/`session`/`account`/`verification`) provisioned by `npm run init-db` (+ lazy fallback) via `ensureAuthTables()` — idempotent DDL in `lib/db/schema-auth.ts` (from `@better-auth/cli generate`), **decoupled from `SCHEMA_VERSION` (not bumped)** so it runs regardless of version.
  - **Operator branding is now editable + displayed:** admin instance form + per-client/per-project overrides (`app/admin/BrandingEditor`, `app/api/branding`); client-facing `/c/{token}` header (`components/ClientNav`) shows resolved logo + company name + Support mailto (http(s)-only logo, escaped text).
  - 645-line `app/page.tsx` split into `app/admin/*` components, **all ≤300 lines**. New env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (set on Vercel prod). `docs/PROJECT-RULES` gained an **Auth tiers** section (owner session / client viewer / agent token / widget key).
  - Verified: tsc + build clean; create-owner→200+session, 2nd-signup→403 (locked), wrong-pw→401, sign-out, legacy bearer→200, unauth `/admin`→307, `/`→307; branding round-trip + resolved into `/api/settings` + client header render (Playwright) + `javascript:` logoUrl→400 + branding-unauth→401; token-auth path unregressed. Adversarial security review: **SHIP** (no auth-bypass / XSS / committed secrets; 4 low-sev notes, non-blocking).
  - RELEASE-NOTES for fork owners: admin is at **`/admin`** behind a login (create owner on first visit); `?admin=`/`ADMIN_SECRET` **deprecated** but still accepted; new dep `better-auth`; new env `BETTER_AUTH_SECRET`(≥32 chars)/`BETTER_AUTH_URL`; auth tables auto-created by `init-db`; password reset not built (recover via DB / re-bootstrap — follow-up for email lane); 2FA not built.
  - Note: left a test owner `owner@example.com` in the **local** dev DB (harmless). Password-reset + 2FA deferred; multi-owner later = Better Auth organizations plugin (nothing built).
- **widget-ux lane (Wave 2) SHIPPED** — 2026-07-03 → archived brief: handoff/done/2026-07-03-widget-ux.md
  - Name persistence root-caused + fixed: submitter name was never written to localStorage at all; now own `bc_submitter_name` key (never inside the settings cache), written on successful submit, prefilled on open; last annotation color persists under `bc_annotation_color`; ALL localStorage access via guarded lsGet/lsSet (Safari private mode / sandboxed iframes degrade to in-memory instead of crashing the widget)
  - Friction wins: capture spinner; Escape closes modal (blurs an in-progress text annotation first); Escape/click-outside/× keep the comment draft in memory until Cancel or successful submit (memory-only by design — no reload persistence, avoids stale-screenshot pairing); inline form errors replace alert() (name validation highlights+focuses field; network failure says the draft is kept); failed submit preserves annotated image + comment; retry no longer double-stamps text annotations (export from a canvas copy); success auto-close timer cancelled on manual close; success view shows `Your ticket: <ref>` when the API returns `ref` (feature-detected — see What's Next one-liner)
  - html2canvas-pro 1.6.4 self-hosted in `public/vendor/` (SHA-256 verified against npm tarball, documented in vendor/README.md); loaded same-origin, SRI-pinned jsdelivr fallback for stale self-hosted installs (removes third-party supply chain + ad-blocker failure mode)
  - `public/widget.js` is now a GENERATED committed artifact: source split into `widget-src/` modules (env/utils/settings/theme/device/capture/draw/main/index), `npm run build:widget` (esbuild 0.28.1 pinned, devDep, es2020, unminified). **Contributors edit widget-src/, not public/widget.js.** Embedders unaffected: same single dependency-free script tag; POST payload unchanged
  - Verified (all on the final bundle): tsc+build clean; rebuild is byte-deterministic; desktop full flow incl. simulated network-failure submit (draft kept) + real POST 200 against merged schema-v4 tree; 375px mobile (hasTouch context: touch tap opens, touch draw, failure submit, layout fits); name+color survive reload with cold settings cache; localStorage-blocked boot; vendor-404 → SRI'd CDN fallback captures; zero widget console errors; /check ran business rules + full security-review (clean; vendored file + lockfile + artifact independently re-verified, SRI added from its recommendation) + code-review pass (live-binding of config in bundle confirmed; stale auto-close race found + fixed)
  - RELEASE-NOTES for fork owners: widget users' name + annotation color now persist per browser; no more alert() popups from the widget; self-hosters updating widget.js should also copy `public/vendor/` (works without it via CDN fallback); `npm run build:widget` regenerates the artifact after editing widget-src/
  - Note: verification submitted 2 test comments to the dev DB LWF project (submitter "Annie Test"/"Merged Tree Test") — delete from dashboard if unwanted
- **data-model lane (Wave 2) SHIPPED** — 2026-07-03 → archived brief: handoff/done/2026-07-03-data-model.md
  - lib/db.ts (1,124 lines) split into lib/db/{pool,schema,schema-base,refs,types,comments,clients,projects,decisions,assignees,branding}.ts behind a back-compat facade; `withClient()` wraps all ~40 call sites; all files ≤300 lines
  - Migrations off the request path: memoized `ensureSchema()` inside withClient (one check/cold start); all 15 per-route ensureDB copies deleted; **`npm run init-db`** = canonical runner (lazy init kept as zero-config fallback)
  - **Schema v4 (additive):** uuid on comments+decision_items; projects.ref_prefix (auto-generated + deduped per client, also on createProject; editable via PATCH `refPrefix`, 409 on within-client dup); comments.project_number with atomic in-INSERT allocation + UNIQUE(project_id,project_number) + UNIQUE(client_id,display_number) + retry on 23505 (kills the MAX+1 race); migration dedupes historic duplicate display_numbers; legacy display_number still written/returned everywhere (deprecated)
  - **Refs:** `ref = "<PREFIX>-<project_number>"` (e.g. LWF-12) computed in queries + returned in API; `findCommentByRef` resolves uuid / ref (case-insensitive) / bare display_number within token scope; `/api/comments/[id]` accepts refs+UUIDs (bare integers stay serial PKs — CLI/MCP contract); dashboard cards/table/decisions display refs, Jump-to accepts refs or legacy numbers
  - **Operator branding storage:** instance_settings table + branding JSONB on clients/projects; `resolveBranding()` per-key merge project→client→instance (logoUrl http(s)-validated); resolved branding in `/api/settings?token=` payload. Edit + display UI = better-auth lane (get/setBranding helpers ready)
  - Verified: tsc+build clean; blank-DB → v4; seeded v3 DB (with dup display_numbers + orphan) → v4 correct backfill, idempotent; legacy local dev DB migrated; 10-way concurrent inserts unique (scripts/test-concurrent-numbering.ts); ref/uuid/serial resolution + cross-client scope fencing (two clients sharing LWF prefix) via live API; CLI list/show/assign/resolve/reopen with bare numbers (API+DB modes); dashboard DOM shows refs; /check ran business rules + full security-review (clean) + code-review (6 DRY findings, all fixed: shared refSelectSql/formatRef/formatCommentLabel, one Comment interface, consolidated branding get/set, BRANDING_KEYS const)
  - RELEASE-NOTES for fork owners: comments API adds `uuid`/`project_number`/`ref`; decisions add `comment_ref`; settings adds `branding`; `/api/comments/[id]` also accepts ref or uuid; projects PATCH accepts `refPrefix`; new `npm run init-db` script; v4 is additive — **first run against a v3 DB backfills + dedupes** (see Migration Ledger)
- **security lane (Wave 1) SHIPPED** — 2026-07-03 → archived brief: handoff/done/2026-07-03-security.md
  - New `lib/auth.ts` (requireToken/requireAdmin timing-safe + scope helpers) + `lib/rate-limit.ts`; token+scope required on ALL writes (comments, batch-update, decisions, assignees); deleted `/api/proxy` (SSRF); widget.js esc() on all config/user innerHTML; admin secret out of URLs (Bearer + sessionStorage, legacy `?admin=` still accepted); origin match needs `/` boundary; CLI/MCP tokens via header; CLI DB mode verifies TLS; PATCH enum validation; widget/settings cache 3600→300s; dead unscoped reads removed; minor dep bumps (next 15.5.20, pg 8.22, tailwind 4.3.2)
  - Rate limits 20 writes/min, 60 reads/min per IP+key (env-overridable); real enforcement recipe in `docs/RATE-LIMITING.md` (Vercel WAF — **manual dashboard step still to do in prod**)
  - RELEASE-NOTES for fork owners: writes now require tokens; `POST /api/comments` requires in-scope projectId + `data:image/*` ≤4MB; `GET /api/decisions` requires token; primaryColor must be hex; AnnotationCanvas exports JPEG now
  - Verified: tsc + build clean (root/cli/mcp); widget embed desktop + 375px mobile; dashboard ?admin= scrub; CLI list/show/resolve; negative auth tests (401/404/400/429); /check ran business rules + full security-review (clean) + code-review (2 findings, fixed: PNG >4MB dashboard saves → JPEG export; silent settings save failure → surfaced error)
- Installed the shared workflow system (skills, CURRENT-STATUS, PROJECT-RULES) — 2026-07-03
- Full code review + lay-of-the-land audit (2026-07-03) — findings in session notes
- Widget mobile fixes: reliable taps, pinch-zoom, wrapping toolbar; submit bugfix (detectedScreenW/H)
- Widget capture speedup (imageTimeout 2s)

---

## What's In Progress

<!-- SINGLE SOURCE OF TRUTH. Concurrent sessions: don't write churn here mid-task — -->
<!-- use your transient lane file docs/status/active/<lane>.md, then fold it in at /update. -->

(nothing active)

---

## What's Next (orchestration plan, 2026-07-03 — waves of ≤2 parallel lanes)

- ~~Wave 1: security~~ ✅ shipped 2026-07-03 (see What Was Last Done)
- ~~Wave 2: data-model ∥ widget-ux~~ ✅ both shipped 2026-07-03 (see What Was Last Done)
- ~~Trivial one-liner: `ref` in POST `/api/widget` response~~ ✅ done in agent-plumbing lane
- ~~prod-migrate-v4~~ ✅ done 2026-07-03 (prod @ v4, see Migration Ledger)
- Wave 3: ~~better-auth~~ ✅ ∥ ~~agent-plumbing~~ ✅ both shipped 2026-07-03 (see What Was Last Done)
- Wave 4: landing-install [build] → handoff/landing-install.md ∥ ~~email~~ ✅ shipped 2026-07-03 (see What Was Last Done; prod @ v6)
- Wave 5: ui-rethink [design→build, Annie gate between] → handoff/ui-rethink.md
- Later / parked: Jira bridge via webhook · Cloudflare Workers/D1 spike (parked 2026-07-03) · Turnstile option (see docs/RATE-LIMITING.md) · Vercel WAF rate-limit rules in prod (manual, recipe in docs/RATE-LIMITING.md) · tier-2 honor license page · Next 16 + TS 6 majors · optional submitter email in widget (changes anonymity promise — Annie's call)

---

## Migration Ledger

- **Schema v6 (notification_settings + last_digest_at on clients, additive)** — **dev @ v6** applied 2026-07-03 (local Postgres, email lane); both columns present. **prod (Neon):** v6 apply **Annie-approved**, rollback snapshot `pre-v6-snapshot-2026-07-03`; `CRON_SECRET` + `EMAIL_ALLOWLIST` set on Vercel prod. Additive `ALTER TABLE clients ADD COLUMN notification_settings JSONB DEFAULT '{}'` + `last_digest_at TIMESTAMP` applies via `init-db` (orchestrator runs it after the email push lands) or lazily on first request. Email env (`RESEND_API_KEY`/`EMAIL_FROM`/SMTP) optional — notifications stay off until configured + opted-in per client.
- **prod (Neon) @ v5** (2026-07-03, Annie-approved) — webhooks table; snapshot `pre-v5-snapshot-2026-07-03` (`br-still-dream-afyhhx5f`)
- **prod Better Auth tables applied** (2026-07-03, Annie-approved) — user/session/account/verification; snapshot `pre-auth-snapshot-2026-07-03` (`br-small-band-afizfm0l`); BETTER_AUTH_SECRET/URL set on Vercel prod; owner account NOT yet created — first /admin signup bootstraps it
- Snapshot branches (v4/v5/auth) deletable after a few days of stability

- **dev @ v4** (2026-07-03, local Postgres `browser_comments`) — note: this repo's `.env.local` ACTIVE `DATABASE_URL` is the live Neon DB; local dev is the commented localhost line. Lane servers should override `DATABASE_URL` inline.
- **prod (Neon) @ v4** (2026-07-03, Annie-approved deliberate apply) — snapshot branch `pre-v4-snapshot-2026-07-03` (`br-young-poetry-af3zh8kz`) is the rollback point; verified: 885/885 comments uuid+project_number, 0 dup numbers, prefixes generated, instance_settings present. Delete the snapshot branch after a few days of stability.
- **Better Auth tables** (`user`/`session`/`account`/`verification`) — **dev** applied 2026-07-03 (local Postgres); **prod** provisioned on deploy via `ensureAuthTables()` (idempotent `CREATE TABLE IF NOT EXISTS`, additive, runs before the version gate on the first request / `init-db`). Merged with Neon snapshot in place as rollback and `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` set on Vercel prod. Not tracked by `schema_version` (Better-Auth-owned; agent-plumbing bumps `SCHEMA_VERSION` to 5 independently).
- **Schema v5 (webhooks table, additive)** — **dev @ v5** applied 2026-07-03 (local Postgres, agent-plumbing); merged `initDB` verified: `ensureAuthTables()` + base + v4 + v5 all run, `user` + `webhooks` tables present. **prod (Neon):** v5 apply approved by Annie, rollback snapshot `pre-v5-snapshot-2026-07-03`; additive `CREATE TABLE IF NOT EXISTS webhooks` applies lazily on first request after deploy (or via `init-db`). No optional env required for webhooks; `WEBHOOK_BASE_URL` / `WEBHOOK_ALLOW_LOOPBACK` are optional hardening.
- Note: `npm run init-db` does NOT load .env.local (bare tsx) — export DATABASE_URL explicitly. Vercel auto-deploys main on push: schema lanes must resolve the prod-migration gate BEFORE merge-to-main from now on.

---

## Known Issues / Blockers

- Full review findings (2026-07-03) triaged into the lane briefs above; C1-C4/H1-H4 closed by security lane 2026-07-03
- In-memory rate limiter is per-instance best-effort on Vercel — real enforcement needs the WAF rules (parked above)

---

## Open Decisions Needing Annie

- (decided 2026-07-03: Better Auth · per-project prefixed refs · landing at `/` · Cloudflare parked)
- MIT vs ISC license — at landing-install gate
- ui-rethink IA proposal approval — at wave 5

---

## Code Quality Criteria (always enforce)

- **DRY:** No duplicated logic. Extract shared helpers.
- **No hardcoded values:** All configurable values in config files.
- **File size:** Target 250-300 lines max. Split if larger.
- **Maintainable:** Small team must be able to understand any file quickly.
- **Testable:** Functions should be unit-testable independently.
- **Business rules:** Code must match `docs/PROJECT-RULES.md`

---

## Reference Docs (Tier 1 — rarely change)

- `docs/PROJECT-RULES.md` — business rules and constraints
- `README.md`, `QUICKSTART.md`, `CORS_SETUP.md` — setup docs (to be consolidated into the install page)
- `docs/EXTERNAL-DEV-SETUP.md` — CLI/API setup for external devs and agents
- `cli/README.md`, `mcp/README.md` — agent tooling docs
