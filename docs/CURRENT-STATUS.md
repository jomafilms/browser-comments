# browser-comments — Current Status

**Last Updated:** 2026-07-03
**Last Commit:** `e1f5d11` (fix widget submit: use detectedScreenW/H)
**Branch:** main
**Launch:** launched (production: https://dev-tix.vercel.app)  <!-- The /migrate skill reads this to gate prod DB migrations. -->

---

## What Was Last Done

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

- Wave 1: security [build] → handoff/security.md (everything depends on it; runs alone)
- Wave 2: data-model [build] → handoff/data-model.md ∥ widget-ux [build] → handoff/widget-ux.md
- Wave 3: better-auth [build] → handoff/better-auth.md ∥ agent-plumbing [build] → handoff/agent-plumbing.md
- Wave 4: landing-install [build] → handoff/landing-install.md ∥ email [build] → handoff/email.md
- Wave 5: ui-rethink [design→build, Annie gate between] → handoff/ui-rethink.md
- Later / parked: Jira bridge via webhook · Cloudflare Workers/D1 spike (parked 2026-07-03) · Turnstile option · tier-2 honor license page · Next 16 + TS 6 majors · optional submitter email in widget (changes anonymity promise — Annie's call)

---

## Known Issues / Blockers

- Full review findings (2026-07-03) triaged into the lane briefs above; security lane closes C1-C4/H1-H4

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
