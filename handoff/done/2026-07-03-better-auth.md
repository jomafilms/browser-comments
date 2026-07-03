# Lane: better-auth — real owner login, tokens stay for everyone else

**TL;DR:** Add Better Auth (email+password, single owner account) for the admin surface, move admin from `/?admin=SECRET` to `/admin` behind a session, keep client magic links (`/c/{token}`) and agent API tokens exactly as they are. Open-source-first: everything self-hostable, no external auth service.

**Depends on:** security lane merged (lib/auth.ts exists; this lane swaps requireAdmin internals). Runs BEFORE landing-page lane (which takes over `/`).

## What exists / don't rebuild
- `lib/auth.ts` (from security lane): `requireAdmin()` checks ADMIN_SECRET via Bearer header (legacy `?admin=` deprecated-but-working).
- Admin UI is app/page.tsx (~645 lines): client/project CRUD, token + widget-key generation.
- Client access = unauthenticated token URLs `/c/{token}` — THIS IS A FEATURE (zero-friction for feedback clients). Do not gate it.
- CLI/MCP/API tokens — untouched by this lane.
- DB is raw pg on Neon; no ORM. Better Auth supports a plain Postgres pool via its kysely adapter — use the existing pool from lib/db/pool.ts.

## The build
1. **Install Better Auth** (justify version in lane file), configure with the existing pg pool, `emailAndPassword` enabled, sessions in Postgres (its own tables via its migration CLI — run against dev, commit the generated SQL into our scripts/init-db.ts flow so self-hosters get it from `npm run init-db`).
2. **Single-owner bootstrap:** no public signup. First-run flow: if zero users exist, `/admin` shows "create owner account" (or a `npm run create-owner` script — pick one, note it). `ADMIN_SECRET` env stays supported as a break-glass + back-compat path (requireAdmin accepts EITHER valid session OR the legacy secret) so existing installs/scripts don't break — deprecate in release notes.
3. **Move admin UI to `/admin`:** relocate app/page.tsx → app/admin/page.tsx behind the session (server-side session check + redirect to /admin/login). While moving, split the 645-line file into components (≤300 lines each, PROJECT-RULES). `/` becomes a stub redirect → /admin for now (landing lane replaces it).
4. **Login page** `/admin/login`: email+password, plain and clean (match existing Tailwind style). Password reset: SKIP for now (single owner, self-hosted; document "reset via create-owner script"). Note it as a follow-up for the email lane (Resend makes reset emails trivial).
5. **API routes:** admin-gated routes (`/api/clients*`, `/api/projects*`, regenerate-token, widget-key) accept session cookie OR legacy bearer secret — one code path inside `requireAdmin()`.
6. **Auth tiers documented** in docs/PROJECT-RULES.md technical constraints: owner (session) / client viewer (magic link token) / agent (API token) / widget (public key). Multi-tenant later = Better Auth organizations plugin — add a one-line note, build nothing.
7. **Operator branding — edit + display** (schema/helper land in the data-model lane; this lane makes it real): (a) admin UI: instance-level branding form (companyName, logoUrl, supportEmail) + optional per-client and per-project overrides in their editors; (b) client-facing display: `/c/{token}` pages (components/ClientNav.tsx header area) show resolved branding — logo (if set), company name, and a "Support: email" link — replacing/alongside the current generic header. Escape everything; logo via plain img tag with fixed max-height. XSS caution: logoUrl and companyName are operator/client-editable — sanitize like the security lane taught (http(s) URLs only, no data: URIs).

## Guardrails
- No public signup path, period.
- `/c/{token}` pages and every token-authed API keep working with zero changes — run the CLI against dev to prove it.
- Schema: Better Auth's tables via its own migrator on DEV; prod apply is a human gate at wrap.
- New env vars (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`) → add to .env.example with comments; never commit real values.
- RELEASE-NOTES entry: `?admin=` deprecated, /admin is the new home, create-owner instructions.
- Stage by explicit path; never `git add -A`.

## Acceptance
- Fresh dev DB: init → create owner → login at /admin/login → full client/project CRUD works; logout works; unauthenticated /admin redirects.
- Legacy `curl -H "Authorization: Bearer $ADMIN_SECRET" /api/clients` still works.
- CLI list/show/resolve unchanged against dev.
- `npx tsc --noEmit` + `npm run build` clean; no file over ~300 lines in app/admin/.

## Open questions (take defaults, note in lane file)
- Owner bootstrap UX → default: first-run "create owner" page at /admin (nicer for Deploy Button flow than a script).
- Session duration → default: Better Auth defaults (7d, sliding).
- 2FA → default: no (single owner, self-hosted; note as tier-2 hardening).
