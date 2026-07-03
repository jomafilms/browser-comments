# Lane: data-model — db.ts refactor + UUID/ticket-numbering rework

**TL;DR:** Split the 1,240-line lib/db.ts into small modules behind a back-compat facade, move schema migration off the request path, and rework ticket identity: UUID primary keys + per-project Jira-style refs (e.g. `LWF-12`) with full back-compat for existing per-client display numbers.

**Depends on:** security lane merged (it edits routes + deletes dead db functions; conflicts otherwise).

## What exists / don't rebuild
- Schema init/migration: `initDB()` with `SCHEMA_VERSION=3` tracking (lib/db.ts:103-342), invoked via copy-pasted `ensureDB()` in ~6 route files; `scripts/init-db.ts` exists for manual runs.
- `display_number` is per-client sequential, computed racily via `SELECT MAX+1` (lib/db.ts:393-400). CLI/MCP `show/resolve/reopen/assign` key off display_number within token scope.
- Comments PK is a SERIAL int with FKs from decision_items. Tokens/widget keys are fine as-is — do NOT touch auth identity.
- The security lane already deleted the dead unscoped query functions.

## The build
1. **`withClient(fn)` helper** — wraps `pool.connect()/try/finally`; convert all ~40 call sites. Cuts ~300 lines.
2. **Split into `lib/db/{pool,schema,comments,clients,projects,decisions,assignees}.ts`**, with `lib/db.ts` re-exporting everything (back-compat facade — every existing import keeps working). Target ≤300 lines/file (PROJECT-RULES).
3. **Migrations off the request path** (M4): single memoized `initPromise` in `lib/db/schema.ts` (module-level, one check per cold start max); delete the per-route `ensureDB` copies; document `npm run init-db` (scripts/init-db.ts) as the canonical migration runner. KEEP lazy-init-as-fallback — it's what makes the future Deploy Button zero-config.
4. **Ticket identity rework** (SCHEMA_VERSION=4, additive only):
   - Add `uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL` to comments (and decision_items). Do NOT drop/replace the serial `id` — existing FKs and API responses keep working; uuid is the new stable external identifier, exposed as `uuid` in API responses (additive field).
   - Add `projects.ref_prefix VARCHAR(8)` — auto-generate from project name at migration time (first letters, uppercase, dedupe within client by appending digit), editable later via existing project PATCH.
   - Add `comments.project_number INT` — per-project sequential, backfilled in creation order for existing rows.
   - New number allocation: atomic, inside the INSERT (`COALESCE((SELECT MAX(project_number)... FOR UPDATE)+1,1)` in a transaction or `INSERT ... SELECT`) + `UNIQUE(project_id, project_number)` index with one retry on conflict (M1 — this kills the race).
   - Keep writing legacy per-client `display_number` too (same atomic pattern, `UNIQUE(client_id, display_number)`), so old dashboards/CLI keep working. Mark deprecated in code comments.
   - **Ref format:** `ref = "<PREFIX>-<project_number>"` (e.g. `LWF-12`), computed in queries, returned as `ref` in API responses.
5. **Resolution helper `findCommentByRef(scopeCtx, refOrNumber)`**: accepts `LWF-12` (prefix lookup within scope), bare `12` (legacy client-scope display_number), or a UUID. Used by comments/[id] route and (in the later agent lane) CLI/MCP.
6. **Dashboard + widget display**: comment cards/table show the new ref where display_number is shown today (components/CommentCard.tsx, CommentsTableView.tsx, app/c/[token]/comments/page.tsx). Keep sort orders working.
7. **Operator branding storage** (Annie 2026-07-03: self-hosting devs need their company info on client-facing surfaces): new `instance_settings` table (single row, JSONB `branding`: `{companyName, logoUrl, supportEmail}`) + additive `branding` JSONB (same shape, all keys optional) on clients AND projects. `resolveBranding(projectId?, clientId?)` helper: project → client → instance, per-key merge. Include resolved branding in the payloads the `/c/{token}` pages fetch (additive field). Logo is a URL (operator hosts it anywhere) — validate http(s). Edit UI is NOT this lane (better-auth lane owns admin UI; client pages display it there too).

## Guardrails
- **Migration discipline:** generate SQL in `initDB` v4 block AND make `scripts/init-db.ts` runnable idempotently. Apply to DEV only via `/migrate`. **PROD APPLY IS A HUMAN GATE at wrap — do not run against the Neon prod URL.** The prod DB has live client data (Adobe, LWF, emo, joma).
- Additive schema only: no dropped columns, no type changes on existing columns, no renames.
- API back-compat: `display_number` stays in every response where it is today; `uuid` + `ref` are additions.
- Cross-project isolation (user requirement): project_number sequences are per-project; ref resolution never crosses the token's scope.
- Stage by explicit path; never `git add -A`.

## Acceptance
- `npx tsc --noEmit` + `npm run build` clean; no file in lib/db/ over ~300 lines; lib/db.ts facade only.
- Fresh blank DB: `npm run init-db` builds v4 schema from nothing. Existing v3 dev DB migrates in place with correct backfill (verify: every comment has uuid + project_number; refs unique per project).
- Two concurrent inserts (script it) never produce duplicate project_number.
- Dashboard shows refs; CLI still resolves bare legacy numbers.

## Open questions (take defaults, note in lane file)
- Prefix collisions across clients → default: allowed (prefixes only need uniqueness within a client; scope makes them unambiguous).
- Comments with NULL project_id (orphans/legacy) → default: no ref, keep display_number only; display falls back to `#N`.
- decision_items uuid → default: yes, same pattern, cheap now.
