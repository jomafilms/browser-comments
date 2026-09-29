# browser-comments — Project Rules

**Last Updated:** 2026-09-28
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
- **Granted exception — `display_number` removal (2026-09-28, Annie-approved):** the
  per-client `display_number` was **removed** from every API/webhook/CLI/MCP
  response, and `/api/comments/<selector>` now **rejects bare integers with 400**
  where it used to read them as serial PKs. This is a deliberate break, taken
  because the field was *actively wrong*: it disagreed with the `ref` humans read
  (joma: `116` vs `JOMA-114`), so agents and people were naming different
  tickets. A loud break beat a silent mismatch. The schema stayed additive — the
  column is still written, just never read. **Do not "restore" it for
  compatibility.** See Rule 5.

### Rule 4: Agent-consumable output stays machine-friendly
- **Rule:** CLI outputs JSON to stdout (no decorative logging on stdout); MCP tools return structured data.
- **Why:** The primary consumer is AI agents, not humans.

### Rule 5: A ticket has exactly one number — its `ref`
- **Rule:** `ref` (`"<PREFIX>-<project_number>"`, e.g. `LWF-12`) is the **only**
  ticket identity shown to a human or handed to an agent. `uuid` is the stable
  machine handle. `comments.id` is an internal row handle: never a ticket number,
  never displayed, never a selector. Never introduce a second user- or
  agent-visible ticket number, and never accept a bare integer as a ticket
  selector on the API.
- **Why:** Two numbers for one ticket means two answers to "which ticket?" That
  is exactly what went wrong: a per-client counter drifted from the per-project
  ref number by the count of the client's other tickets, so a user reading
  `JOMA-114` and an agent reporting `116` were talking about the same ticket and
  neither could tell. Small drift is worse than large — it reads as a typo.
- **Edge cases:** A human typing a bare number (the portal jump-to box, a CLI
  arg) is resolved against the **ref tail** — `12` → `LWF-12` — and reports
  ambiguity rather than guessing when a client token spans projects. That
  convenience never reaches the wire. The canonical statement of this rule lives
  in `lib/db/refs.ts` ("THE ONE TICKET IDENTITY"); `docs/AGENT-SETUP.md` is the
  version agents read.

---

## Technical Constraints

- **Framework:** Next.js 15 (App Router), React 19, Tailwind v4
- **Database:** PostgreSQL on Neon, raw `pg` (no ORM)
- **Hosting:** Vercel (production: https://dev-tix.vercel.app)
- **File size max:** 250-300 lines per file
- **No hardcoded values:** Everything in config files / env vars

### Auth tiers (four distinct kinds of access — do not conflate)

1. **Owner (session)** — the single operator account. Better Auth email+password
   (`lib/auth-server.ts`), login at `/admin/login`, session cookie in Postgres.
   Gates the admin surface (`/admin`) and all admin APIs (`/api/clients*`,
   `/api/projects*`, regenerate-token, widget-key, `/api/branding`). No public
   signup — the first sign-up bootstraps the owner, then it's locked.
   `ADMIN_SECRET` bearer/`?admin=` is a **deprecated** break-glass/back-compat
   path still accepted by `requireAdmin()` alongside the session.
2. **Client viewer (magic-link token)** — unauthenticated share URLs `/c/{token}`.
   Zero-friction by design; **do not gate them.** Scoped per-client/per-project.
3. **Agent (API token)** — CLI/MCP/HTTP clients via `Authorization: Bearer <token>`,
   validated by `requireToken()`. Scoped like the viewer tokens.
4. **Widget (public key)** — embeddable `widget.js` `data-key`; public by design,
   origin-checked against project URLs.

> Multi-tenant / multiple owner accounts later = Better Auth **organizations**
> plugin. Not built. One line here so the path is known; add nothing until asked.

---

## What Agents Should NOT Do

- Do not write to the production database without explicit approval from Annie (SELECT is fine)
- Do not break the deployed widget embed snippet, CLI flags, or API shapes (Rule 3)
- Do not commit secrets or client-identifying data (Rule 1; meetings/client content is confidential)
- Do not add dependencies without justification
- Do not change business rules without asking Annie
- Do not commit code without updating CURRENT-STATUS.md
