# browser-comments — Current Status

**Last Updated:** 2026-07-03
**Last Commit:** `87c4fd3` (security lane: auth every write, SSRF proxy deleted, widget XSS escaping)
**Branch:** main
**Launch:** launched (production: https://dev-tix.vercel.app)  <!-- The /migrate skill reads this to gate prod DB migrations. -->

---

## What Was Last Done

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
- Wave 2 (NOW UNBLOCKED): data-model [build] → handoff/data-model.md ∥ widget-ux [build] → handoff/widget-ux.md
- Wave 3: better-auth [build] → handoff/better-auth.md ∥ agent-plumbing [build] → handoff/agent-plumbing.md
- Wave 4: landing-install [build] → handoff/landing-install.md ∥ email [build] → handoff/email.md
- Wave 5: ui-rethink [design→build, Annie gate between] → handoff/ui-rethink.md
- Later / parked: Jira bridge via webhook · Cloudflare Workers/D1 spike (parked 2026-07-03) · Turnstile option (see docs/RATE-LIMITING.md) · Vercel WAF rate-limit rules in prod (manual, recipe in docs/RATE-LIMITING.md) · tier-2 honor license page · Next 16 + TS 6 majors · optional submitter email in widget (changes anonymity promise — Annie's call)

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
