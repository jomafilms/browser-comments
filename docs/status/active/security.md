# Lane: security

**Claimed:** 2026-07-03
**Worktree:** ../browser-comments-security (branch `security`)
**Dev server:** http://localhost:3004 (3001–3003 taken by other lanes)
**Brief:** handoff/security.md — close every hole from the 2026-07-03 review

## Task
Auth on every write route, delete SSRF proxy, widget XSS escaping, admin secret out of URLs, rate limits + size caps, TLS/token fixes in our own clients, PATCH validation, cache TTL, dead code removal, minor dep bumps.

## Status: BUILD + VERIFY COMPLETE — ready to wrap

- `npx tsc --noEmit` clean (root, cli, mcp); `npm run build` clean
- Widget gate passed: embed re-verified on /test-widget, desktop (1280px) AND narrow mobile (375px) viewports — capture, modal, submit all work post-escaping
- Dashboard: `/?admin=SECRET` loads once, URL scrubbed via history.replaceState, survives reload via sessionStorage, all fetches use Bearer header
- CLI list/show/resolve verified against local dev (API mode, Bearer header)
- Negative tests: all locked endpoints 401 unauthenticated; cross-tenant access 404; invalid enums/ids 400; widget rate limit trips at request 21 → 429; CSS-injection primaryColor → 400
- Test data cleaned up (2 test comments + temp test project deleted)

## Open-question defaults taken (per brief)
- Rate limits: 20 writes/min, 60 reads/min per IP+key (env-overridable: RATE_LIMIT_WRITE_PER_MIN / RATE_LIMIT_READ_PER_MIN)
- Turnstile: NOT in this lane — noted in docs/RATE-LIMITING.md as follow-up
- In-memory limiter is per-instance best-effort on Vercel: accepted; WAF recipe documented in docs/RATE-LIMITING.md
- Also removed `getDecisionItems()` (unscoped read) beyond the brief's dead-code list — it became uncalled once decisions GET requires a token

## Route inventory (acceptance item)
Admin (Bearer ADMIN_SECRET; legacy ?admin= still accepted, deprecated):
- GET+POST /api/clients · POST /api/clients/[id]/regenerate-token · POST /api/clients/[id]/widget-key
- POST /api/projects · GET /api/projects (unfiltered or ?clientId=) · PATCH+DELETE /api/projects/[id] · POST /api/projects/[id]/regenerate-token

Token + scope:
- GET+POST /api/comments · GET+PATCH+DELETE /api/comments/[id] · POST /api/comments/batch-update · POST /api/comments/images
- GET+POST /api/decisions · PATCH+DELETE /api/decisions/[id]
- GET+POST /api/assignees · PATCH+DELETE /api/assignees/[id]
- GET /api/projects?token= (scoped) · GET+POST /api/settings?token= (scoped; POST client-token only)

Intentionally public:
- GET /api/settings?key= (widget settings by widget key)
- GET /api/widget?key= (widget key validation) · POST /api/widget (widget submission — widget-key gated, rate-limited, size-capped)
- OPTIONS on CORS routes

Deleted: /api/proxy (unauthenticated SSRF, no references)

## RELEASE-NOTES (user-visible / breaking — for collation)
- **BREAKING (abusers only): writes now require auth.** `POST /api/comments`, `POST /api/comments/batch-update`, `POST /api/decisions`, `PATCH/DELETE /api/decisions/[id]`, `PATCH/DELETE /api/assignees/[id]` now require a client/project token (Bearer header, body `token`, or `?token=`). `GET /api/decisions` no longer returns data without a token. Fork owners with custom callers must add tokens.
- **BREAKING: `POST /api/comments` now requires a `projectId` in token scope** (project tokens may omit it) and rejects non-image or >4MB `imageData` with 400 instead of storing orphaned rows.
- **Removed `GET /api/proxy`** (unauthenticated SSRF; dead code).
- **Rate limits:** widget + comment submissions 20/min, comment reads 60/min per IP+key (HTTP 429 with Retry-After; env-overridable). Bodies >5MB → 413.
- **Admin:** dashboard now sends the admin secret as `Authorization: Bearer` and scrubs `?admin=` from the URL after first load. Legacy `?admin=` still works but is deprecated.
- **Widget settings:** `primaryColor` must be a hex color (`#rgb`–`#rrggbbaa`); other values → 400.
- **Widget key/settings cache dropped 3600s → 300s** — revoked keys and settings changes now propagate within ~5 minutes.
- **Origin matching hardened:** project URL prefix matches now require a `/` boundary (`example.com` no longer matches `example.com.evil.io`). Multi-URL projects unaffected.
- **CLI/MCP:** tokens now sent via Authorization header on reads (server accepts both; no user action needed). CLI direct-DB mode now verifies TLS certificates (`rejectUnauthorized: false` removed).
- **PATCH /api/comments/[id]** validates status/priority enums and integer ids → 400 instead of 500.
- Dep bumps (minors): next 15.5.20, pg 8.22, tailwind 4.3.2, react 19.2.7, @neondatabase/serverless 1.1.0, etc. No Next 16, no TS 6.

## Files touched
- NEW: `lib/auth.ts` (central auth: extractToken/requireToken/requireAdmin + scope helpers), `lib/rate-limit.ts`, `docs/RATE-LIMITING.md`
- DELETED: `app/api/proxy/route.ts`
- `lib/db.ts` — origin boundary fix; removed dead `getComments`, `getPageSections`, `updatePageSection`, `getCommentsByProjectId`, `getDecisionItems`
- All routes under `app/api/` (auth centralization + hardening)
- `app/page.tsx` (admin Bearer + URL scrub), `app/c/[token]/{decisions,comments,settings,[projectId]}/page.tsx` (send tokens on writes)
- `public/widget.js` (esc() + hex color guard)
- `cli/lib/api-client.ts`, `cli/lib/db-reader.ts`, `mcp/src/api-client.ts`
- `package.json`/`package-lock.json` (minor bumps)

## What's Next candidates (for CURRENT-STATUS)
- Turnstile option on widget submissions (parked, see docs/RATE-LIMITING.md)
- Vercel WAF rate-limit rules in production (manual dashboard step — recipe in docs/RATE-LIMITING.md)
