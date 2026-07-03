# Handoff: prod-migrate-v4 — apply schema v4 to production Neon (HUMAN GATE)

**Mode:** operational (run with Annie present / explicit go) — NO code changes
**Goal:** Production Neon DB moves from schema v3 → v4 deliberately, with a rollback branch, instead of lazily on first request after deploy.

## Why / problem
The data-model lane shipped schema v4 (additive: uuid on comments+decision_items, projects.ref_prefix, comments.project_number + backfills, branding JSONB, instance_settings, unique numbering indexes). Dev is migrated; **prod (Neon) is still v3 with live client data (Adobe, LWF, emo, joma).**

⚠️ **Deploy = migrate.** Lazy schema init means the first request after deploying this code auto-runs the v4 migration against prod (including backfills, display_number dedup, and unique-index creation on live tables). Additive-only and tested against v3-with-data + duplicate display_numbers, but it should happen as a decision, not a side effect.

## Settled — don't relitigate
- v4 is additive-only; migration is idempotent (verified: blank DB, seeded v3 DB, legacy v0 DB, re-runs).
- The dedup pass renumbers any race-duplicated display_numbers (later duplicate moves past client max) — this can change a duplicate ticket's visible number; the duplicates were broken anyway.
- `.env.local` layout in this repo: the ACTIVE `DATABASE_URL` is prod Neon; local dev is the commented `postgresql://localhost:5432/browser_comments` line. (Inverted from the /migrate skill's convention — don't "fix" it without Annie.)

## Do (follow /migrate skill's launched-prod protocol)
1. Create a Neon pre-migration branch (needs `NEON_API_KEY` — if missing, STOP and ask Annie or create the branch in the Neon console).
2. `DATABASE_URL=<prod url, inline, never printed> npm run init-db`
3. Verify: `SELECT version FROM schema_version` → 4; spot-check `SELECT count(*), count(uuid) FROM comments`; `SELECT id, name, ref_prefix FROM projects` (prefixes look sane for Adobe/LWF/emo/joma projects); dashboards still load.
4. Update the Migration Ledger in docs/CURRENT-STATUS.md → `prod @ v4 (<date>)`.

## Done when
Prod schema_version = 4, all comments have uuid + project_number, refs render on client dashboards against prod, ledger updated.

## Lane
solo/operational · takes minutes · do NOT run before or without the Neon snapshot branch
