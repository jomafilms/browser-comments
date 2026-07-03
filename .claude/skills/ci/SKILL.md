---
name: ci
description: CI and test-hygiene baseline: lazy clients, pre-commit parity with CI, blank-DB migrations, docs-only skip, plus an opt-in real-DB-in-CI recipe. Use when setting up or hardening a project's CI.
---

CI & test hygiene — a baseline so tests pass in CI as reliably as they do locally. Pull this in when a project runs typecheck/lint/tests in CI. The universal section fits any stack; the database section is opt-in.

## Universal baseline (any stack)

1. **Lazy-init external clients so importing a module never connects or reads env.** A module that opens a DB / validates a required env var / builds an SDK client *at import time* crashes test *collection* in CI (where secrets are absent) — even for suites you meant to skip, because the `import` runs before `describe.skipIf`/`it.skip` can gate it. It passes locally only because `.env.local` masks the missing var. Fix: construct the client on first *use*, not at import.
   ```ts
   let client; const getClient = () => (client ??= createClient()); // createClient() is the only place that reads env/connects
   export const db = new Proxy({}, { get: (_t, p, r) => {
     const v = Reflect.get(getClient(), p, r);
     return typeof v === "function" ? v.bind(getClient()) : v;
   }});
   ```
   Pair with `const hasEnv = Boolean(process.env.X)` + `describe.skipIf(!hasEnv)`.

2. **Pre-commit hook = CI parity** (zero deps, native git):
   ```bash
   # .githooks/pre-commit  (chmod +x)  — run the SAME commands CI runs
   set -euo pipefail
   <typecheck>; <lint>; <test>
   ```
   ```jsonc
   // package.json — self-installs on install, no husky
   { "scripts": { "prepare": "git config core.hooksPath .githooks" } }
   ```
   Bypass with `--no-verify`. Keep the hook and CI calling the same commands (ideally one shared script).

3. **Debug CI locally — don't push-and-pray.** Reproduce the failure first: temporarily move `.env.local` aside (with a `trap` to restore it) to mimic CI's missing secrets; use a scratch DB/container for migration changes. The cheapest place to debug CI is not CI.

4. **Migrations must apply from a blank database.** A migration that depends on out-of-band state (an extension/role enabled by hand) is a latent bug a fresh CI database exposes. Make each migration self-contained — e.g. `CREATE EXTENSION IF NOT EXISTS <ext>;` before using it — and let CI run migrations against an empty DB. Editing an already-applied migration is safe only if your runner gates by an ordered journal/timestamp; otherwise add a new one.

5. **Skip CI on docs/config-only commits** with `paths-ignore` (a YAML anchor keeps push + PR lists DRY):
   ```yaml
   on:
     push:        { branches: [main], paths-ignore: &skip ['**.md', 'docs/**'] }
     pull_request: { paths-ignore: *skip }
   ```
   Caveats: a **mixed** docs+code commit still runs; and if CI is a **required** check, `paths-ignore` leaves docs-only PRs stuck "pending" → use only when CI isn't required (or add a same-named always-pass job).

## Opt-in: integration tests that need a real database

Only when DB/integration tests need a live database in CI:
- **Never point CI at prod or a shared DB** — these tests write/delete rows and collide across parallel runs. Use a throwaway: an ephemeral container, or an ephemeral managed branch from your DB provider.
- **Check driver↔host compatibility first.** A serverless/HTTP driver may not speak standard wire protocol to a vanilla container (it just hangs). Prefer the provider's ephemeral-branch feature for true parity, or run its local proxy sidecar.
- **Self-skip without secrets:** surface the secret as `env:` then gate steps with `if: ${{ env.X != '' }}`, so fork PRs (no secrets) skip the DB suites and CI stays green. (Combined with #1, env-gated suites skip cleanly.)
- **Always clean up** (`if: always()`), deleting the run's own resource by **id**; consider a TTL backstop for hard-crash orphans.

### Concrete example — ephemeral Neon branch  *[Neon-specific; adapt or ignore]*
```yaml
jobs:
  verify:
    runs-on: ubuntu-latest
    env: { NEON_API_KEY: ${{ secrets.NEON_API_KEY }}, NEON_PROJECT_ID: ${{ vars.NEON_PROJECT_ID }} }
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6   # + your package-manager setup
      - run: <install --frozen-lockfile> && <typecheck> && <lint>
      - id: neon
        if: ${{ env.NEON_API_KEY != '' }}
        uses: neondatabase/create-branch-action@v6
        with: { project_id: ${{ env.NEON_PROJECT_ID }}, parent_branch: ${{ vars.NEON_PARENT_BRANCH }}, branch_name: ci/${{ github.run_id }}, api_key: ${{ env.NEON_API_KEY }} }
      - if: ${{ steps.neon.outputs.db_url != '' }}
        run: <db:migrate> && <test>
        env: { DATABASE_URL: ${{ steps.neon.outputs.db_url }} }
      - if: ${{ always() && steps.neon.outputs.branch_id != '' }}
        uses: neondatabase/delete-branch-action@v3
        with: { project_id: ${{ env.NEON_PROJECT_ID }}, branch: ${{ steps.neon.outputs.branch_id }}, api_key: ${{ env.NEON_API_KEY }} }
```
Needs repo secret `NEON_API_KEY` + vars `NEON_PROJECT_ID`, `NEON_PARENT_BRANCH` (a **non-prod** branch **id**, not the endpoint host). Verify action versions at adoption. Same shape works for a Postgres service container or Supabase branch.
