---
name: migrate
description: Apply database migrations to dev, and to prod safely: launch-gated, with a Neon rollback branch and data-loss-safe rollback for launched projects. Use when running DB migrations.
---

Apply DB migrations to **dev** (and **prod**, safely). Encodes "migrate dev, keep prod in sync, gate prod by launch phase" so you never have to re-explain the two-database setup each time.

## Where things live (the convention)

- **Launch status** — read from the top of `docs/CURRENT-STATUS.md`: `**Launch:** pre-launch` or `**Launch:** launched (<date>)`. (Distinct from any `**Phase:**`/sprint field a project may also keep.)
- **Dev DB** — `process.env.DATABASE_URL`, active in `.env.local`. The app's normal target.
- **Prod DB** — kept **inert by default**, loaded *only* for the one explicit prod command, never active in dev. Two supported layouts, both fine — don't restructure a working one:
  - **Commented in `.env.local`** — a `# DATABASE_URL=` line (likely what you already have). Read inline for the single command.
  - **Separate `.env.production.local`** (gitignored), key `DATABASE_URL=` — cleaner separation; good for new projects.
  - Either way: `.env.local` / `.env.production.local` **must be gitignored and never force-added.**

## Steps

1. **Generate / identify** the pending migration (`<db:generate>` if schema changed). Show what will apply.
2. **Dev first, always:** run `<db:migrate>` against `DATABASE_URL`. Confirm success.
3. **Sync check:** report which migrations are applied on dev vs prod (drizzle journal / `__drizzle_migrations`). Show any drift so it's obvious when prod is behind.
4. **Prod — gated by launch status:**
   - **pre-launch** → prod has no real data; **offer to apply to prod too** to keep them in sync (default yes, one confirmation).
   - **launched** → do **NOT** auto-apply. Require an explicit "yes, migrate production," then run the **quick-rollback-without-data-loss** protocol below (snapshot → apply → **verify before traffic trusts it** → resume or roll back in two fenced steps).
5. **The prod command** (single command, never edits `.env.local`, never prints the secret):
   ```bash
   # resolve prod URL inline — prefer .env.production.local, else the commented line in .env.local
   PROD_URL=$(grep -hE '^\s*DATABASE_URL=' .env.production.local 2>/dev/null | head -1 | sed -E 's/^[^=]*=//; s/^["'"'"']//; s/["'"'"']$//')
   [ -n "$PROD_URL" ] || PROD_URL=$(grep -hE '^# *DATABASE_URL=' .env.local 2>/dev/null | head -1 | sed -E 's/^# *[^=]*=//; s/^["'"'"']//; s/["'"'"']$//')
   [ -n "$PROD_URL" ] || { echo "no prod URL found"; exit 1; }
   DATABASE_URL="$PROD_URL" <db:migrate>     # inline value wins over dotenv; .env.local untouched
   ```
6. **Report + record** what ran where — `dev @ <NNNN>`, `prod @ <NNNN>` — plus the snapshot/branch id + expiry if one was created. Note the `dev@/prod@` sync state in `docs/CURRENT-STATUS.md` so the next session sees it at a glance.

## Launched-prod: quick rollback WITHOUT data loss

A pre-migration branch is **insurance, not an authoritative rollback.** Production is live — restoring the snapshot blindly drops every write users made after it was taken. So don't forbid destructive changes; make them **recoverable cheaply.**

**Make the recovery delta cheap by construction** (project-wide, do once):
- **Row timestamps / audit:** mutable tables carry `updated_at` (+ `created_at`), or an append-only audit/event log. Then "what changed during a bad window" is a single timestamped query against the preserved branch — not a manual table diff.
- **Sequence destructive changes (expand → contract):** drop/rename/retype in a *later* migration, after deployed code already stopped using the old shape — the scary step then runs against something already dead in the app. Reserve the hard path for migrations that must transform live data **in place**.

**Cutover with a verify gate** (keeps the bad window tiny):
1. Create the pre-migration **Neon branch** (restore point; expires ~3 days). *(Needs `NEON_API_KEY` — see below.)*
   ```bash
   neonctl branches create --project-id "$NEON_PROJECT_ID" --parent <prod-branch-id> \
     --name "premigrate-<timestamp>"     # set expiry ~3 days via API field expires_at / your TTL
   ```
2. Apply the migration to prod.
3. **Verify before full traffic trusts it** — smoke checks / key queries (canary or hold traffic if you can). Fast detection = tiny delta.
4. **Good** → done; record `prod @ <NNNN>`.
5. **Bad** → roll back in two fenced steps, no race:
   - **a. Get stable:** repoint production at the pre-migration branch (instant) so it serves a known-good schema. **Keep the diverged (bad) branch — do NOT delete it.**
   - **b. Check the diff:** from the preserved bad branch, pull rows written after the snapshot (timestamp/audit query) and replay/reconcile them into the stable branch. Small window → usually a few rows or none.

**In-place data transforms** with no backward-compatible form are the only case needing a brief **read-only window** at cutover for a clean fence — `/migrate` must pause and confirm with the owner before taking it.

(Non-Neon: use the provider's instant snapshot/PITR + branch equivalent — never a manual dump to a local drive.)

> **Requires Neon credentials** — only for this launched-prod path; dev and pre-launch migrations need none. You need:
> - `NEON_API_KEY` — Neon Console → Account → API keys. A secret: keep it in a gitignored env, never commit. (Alternatively, a one-time `neonctl auth` browser login on this machine.)
> - `NEON_PROJECT_ID` and the **prod branch id** (`br-…`) to fork from.
>
> **If these are missing, STOP** — do not migrate prod without a rollback point. Tell the user: add `NEON_API_KEY` (+ project/branch ids), or create the snapshot branch manually in the Neon console, then continue. Skip the snapshot only on an explicit user override.

## Hard rules (non-negotiable)

- **Every prod write is explicitly confirmed.** Never silent, regardless of phase.
- **Never print the prod connection string.**
- **Never leave prod creds active in the dev environment** — load inline for the single command only.
- **`.env.local` / `.env.production.local` must be gitignored** — verify before any prod work; never force-add.
- **Launched + prod = rollback snapshot first**, every time. **No Neon credentials → no launched-prod migration:** halt and ask; never migrate live prod without the rollback branch.
- **Never blind-restore a live DB** — the snapshot drops post-snapshot writes. Roll back via repoint-to-snapshot + keep the bad branch + timestamp-diff the delta.
- **Prefer expand→contract; an in-place live-data transform needs an explicit read-only-window confirmation** from the owner before cutover.
- Keep dev and prod in sync during pre-launch; let them diverge deliberately (never accidentally) after launch.
