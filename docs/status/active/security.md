# Lane: security

**Claimed:** 2026-07-03
**Worktree:** ../browser-comments-security (branch `security`)
**Dev port:** TBD (recorded when /dev starts)
**Brief:** handoff/security.md — close every hole from the 2026-07-03 review

## Task
Auth on every write route, delete SSRF proxy, widget XSS escaping, admin secret out of URLs, rate limits + size caps, TLS/token fixes in our own clients, PATCH validation, cache TTL, dead code removal, minor dep bumps.

## Files I expect to touch
- `lib/auth.ts` (new)
- `lib/db.ts` (origin matching, dead code removal)
- `app/api/proxy/route.ts` (delete)
- `app/api/comments/route.ts`
- `app/api/comments/[id]/route.ts`
- `app/api/comments/batch-update/route.ts`
- `app/api/decisions/route.ts`
- `app/api/decisions/[id]/route.ts`
- `app/api/assignees/[id]/route.ts`
- `app/api/settings/route.ts`
- `app/api/widget/route.ts`
- `app/page.tsx`
- `app/c/[token]/decisions/page.tsx`
- `public/widget.js`
- `cli/lib/api-client.ts`, `cli/lib/db-reader.ts`
- `mcp/src/api-client.ts`
- `package.json` / `package-lock.json` (minor bumps)
- `docs/` (WAF rate-limit recipe note)

## Open-question defaults taken (per brief)
- Rate limits: 20 submissions/min per IP+key, 60 reads/min (fixed-window, in-memory)
- Turnstile: NOT in this lane — What's-Next note only
- In-memory limiter is per-instance best-effort on Vercel: accepted + WAF recipe documented

## RELEASE-NOTES
(collated at wrap)
