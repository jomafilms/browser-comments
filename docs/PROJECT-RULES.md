# browser-comments — Project Rules

**Last Updated:** 2026-07-03
**Owner:** Annie Lundgren

<!-- This is the authoritative source for business rules and constraints. -->
<!-- Agents check code against this doc. If code conflicts, they stop and ask. -->

---

## Business Rules

### Rule 1: Open source — no secrets in the repo
- **Rule:** Never hardcode secrets, tokens, DB URLs, or credentials in committed files. Config via env vars only (`.env.example` documents them).
- **Why:** Repo is public at github.com/jomafilms/browser-comments.
- **Edge cases:** Docs and examples must use placeholders; git history was already scrubbed once (see memory/project_git_history_secrets.md).

### Rule 2: Per-client scoping is the security boundary
- **Rule:** Every client (Adobe, LWF, emotion studios, joma) only ever sees its own comments. Client tokens / widget keys must scope all reads and writes.
- **Why:** Real client work lives in the production DB; leakage between clients is the worst-case failure.
- **Edge cases:** CLI/agent integrations use API-only mode (no direct DB URL) so scoping can't be bypassed.

### Rule 3: Backwards compatibility for existing installs
- **Rule:** The widget embed snippet, CLI commands/flags, MCP tool contracts, and API request/response shapes already deployed on client sites must keep working. Additive changes only; deprecate, don't break.
- **Why:** The widget is embedded on live client sites Annie doesn't always control; agents have the CLI wired into other repos.
- **Edge cases:** DB schema changes must be additive (new columns nullable/defaulted); `initDb` runs against a live production database.

### Rule 4: Agent-consumable output stays machine-friendly
- **Rule:** CLI outputs JSON to stdout (no decorative logging on stdout); MCP tools return structured data.
- **Why:** The primary consumer is AI agents, not humans.

---

## Technical Constraints

- **Framework:** Next.js 15 (App Router), React 19, Tailwind v4
- **Database:** PostgreSQL on Neon, raw `pg` (no ORM)
- **Hosting:** Vercel (production: https://dev-tix.vercel.app)
- **Auth:** admin secret (dashboard), per-client widget keys, per-client share tokens — no user accounts
- **File size max:** 250-300 lines per file
- **No hardcoded values:** Everything in config files / env vars

---

## What Agents Should NOT Do

- Do not write to the production database without explicit approval from Annie (SELECT is fine)
- Do not break the deployed widget embed snippet, CLI flags, or API shapes (Rule 3)
- Do not commit secrets or client-identifying data (Rule 1; meetings/client content is confidential)
- Do not add dependencies without justification
- Do not change business rules without asking Annie
- Do not commit code without updating CURRENT-STATUS.md
