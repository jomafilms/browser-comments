# Lane: security — close every hole from the 2026-07-03 review

**TL;DR:** Add auth to every unauthenticated write route, delete the SSRF proxy, escape widget innerHTML, get the admin secret out of URLs, add rate limits + size caps, fix TLS and token-in-query in our own clients. All changes must be backwards compatible for existing installs (Rule 3 in docs/PROJECT-RULES.md) — additive params, deprecate-don't-break.

## What exists / don't rebuild
- Token model works and stays: client tokens + project tokens resolved via `resolveToken()` (lib/db.ts), widget keys for submission. Read paths are correctly scoped — copy their pattern.
- `extractToken()` already supports `Authorization: Bearer` AND `?token=` (app/api/comments/route.ts:14-18). Keep both (magic links need query).
- Better Auth arrives in a LATER lane. Do NOT add a user table. Centralize admin checks so that lane only swaps the internals.

## The build
1. **Create `lib/auth.ts`** — single home for: `extractToken(request)`, `requireToken(request)` (resolves + returns context or throws 401 response), `requireAdmin(request)` (timing-safe compare via `crypto.timingSafeEqual`, accepts `Authorization: Bearer <ADMIN_SECRET>` header; ALSO still accepts legacy `?admin=` for back-compat but the dashboard stops using it), and `requireScope(ctx, {clientId|projectId|commentId})` ownership helpers. Replace the ~6 copy-pasted `isAdmin`/`ADMIN_SECRET` blocks and 3 `extractToken` copies.
2. **Delete `app/api/proxy/route.ts`** (C1 — unauthenticated SSRF, dead code; nothing references it — verified).
3. **Auth every write** (C2/C3):
   - `POST /api/comments` (route.ts:32-62): require token; verify `body.projectId` is in token scope; cap `imageData` (4MB, must start `data:image/`); reject invalid projectId with 400 instead of silently storing client_id NULL.
   - `app/api/comments/batch-update/route.ts:4`: require token + verify every comment id belongs to scope.
   - `app/api/decisions/route.ts`: GET without token must NOT return all clients' data (44); `?projectId=` (38) must be scope-checked; POST (55-76) requires token.
   - `app/api/decisions/[id]/route.ts` PATCH/DELETE + `app/api/assignees/[id]/route.ts` PATCH/DELETE: require token + ownership. NOTE: dashboard pages call decisions endpoints WITHOUT a token today (app/c/[token]/decisions/page.tsx:104,130) — update those fetches to send the page's token in the same commit.
4. **Widget XSS** (H1, public/widget.js): add `esc()` helper; escape `buttonText` (768), `modalTitle`/`modalSubtitle` (1265,1276-1277), `successMessage` (1328), `submitterName` (1335), `comment` in textarea (1335). Validate `primaryColor` against `/^#[0-9a-fA-F]{3,8}$/` server-side in `app/api/settings/route.ts:100-107` (reject others, keep stored value untouched).
5. **Admin secret out of URLs** (C4): `app/page.tsx` keeps reading `?admin=` from location ONCE, then stores in memory/sessionStorage and sends it as `Authorization: Bearer` on every fetch (55-247); strip the param from the URL with history.replaceState. Server: `requireAdmin` per item 1.
6. **Rate limiting + size caps** (H2): lightweight in-code limiter (fixed-window per IP+key, in-memory Map with periodic sweep — best-effort on serverless, zero new deps) on `POST /api/widget` and `POST /api/comments`; return 429. Enforce server-side max JSON body ~5MB before parse where possible. Add a short doc note (docs/) with the Vercel WAF rule recipe for real enforcement.
7. **Origin matching** (M2, lib/db.ts:901-906): `origin === url || origin.startsWith(url + '/')` — kill the `example.com.evil.io` prefix hole.
8. **Our own clients** (H3/H4): `cli/lib/api-client.ts:10` + `mcp/src/api-client.ts:31,67` send token via `Authorization: Bearer` header on GET (server already accepts). `cli/lib/db-reader.ts:8`: remove `rejectUnauthorized: false` (use default verification; `sslmode=require` in URL is fine).
9. **PATCH validation** (M7, app/api/comments/[id]/route.ts:84-98): validate status/priority enums + `Number.isInteger(id)` → 400 not 500.
10. **Cache revocation** (M8): drop `s-maxage` to 300 on `app/api/widget/route.ts:14-17,166` and `app/api/settings/route.ts:22-25`.
11. **Dead code**: delete unscoped `getComments()`, `getPageSections()`, `updatePageSection()`, `getCommentsByProjectId()` (lib/db.ts:438-490 — verified uncalled).
12. **Dep bumps (minors only)**: `npm update` for wanted versions (next 15.5.20, pg 8.22, tailwind 4.3, etc.). NO Next 16, NO TS 6.

## Guardrails
- No schema changes in this lane (everything above is code-level).
- Backwards compat: every currently-working request keeps working — `?token=`, `?admin=` (deprecated), widget embeds, CLI flags, API response shapes unchanged. New requirements (auth on writes) ARE the intended breaking change for abusers only; Annie's own dashboards are the only legit callers and get updated in the same commit.
- Widget stays a dependency-free IIFE — no build step in this lane.
- Log a line for RELEASE-NOTES: which endpoints now require tokens (fork owners must update custom callers).

## Acceptance
- Every route in app/api/** either requires admin, requires token+scope, or is intentionally public (only: GET /api/settings, GET+POST /api/widget, OPTIONS) — list them in your lane file.
- `npx tsc --noEmit` clean; `npm run build` succeeds.
- Manual: widget submit on test-widget page works; dashboard loads via ?admin= once then URLs are clean; CLI list/show/resolve works against local dev.
- grep shows zero `innerHTML` interpolation of unescaped config/user values in widget.js.

## Open questions (take defaults, note in lane file)
- Rate limit numbers → default 20 submissions/min per IP+key, 60 reads/min.
- Turnstile support → default: NOT in this lane (What's-Next note only).
- In-memory limiter is per-instance best-effort on Vercel → default: accept + document WAF recipe.
