# Lane: agent-plumbing

**Worktree:** `../browser-comments-agent-plumbing` on branch `agent-plumbing`
**Brief:** handoff/agent-plumbing.md
**Started:** 2026-07-03

Webhooks + polling so agents pick up tickets without a human. Plumbing only — autonomy is configured on the agent's side.

## Files I own / expect to touch
- `lib/notify.ts` (new) — channel-list notify hook, fire-and-forget
- `lib/webhook-delivery.ts` (new) — HMAC signing, SSRF guard, fetch+retry
- `lib/db/webhooks.ts` (new) — webhook CRUD + delivery lookup
- `lib/db/schema.ts` — SCHEMA_VERSION 4→5, `applySchemaV5` (webhooks table, additive)
- `lib/db/types.ts` — `Webhook` interface, `since` on CommentFilters
- `lib/db/comments.ts` — `since` filter, `getCommentById` full-record helper
- `lib/db.ts` — export webhooks module
- `app/api/webhooks/route.ts` (new) — token-scoped CRUD
- `app/api/comments/route.ts` — `?since=` param + `X-Server-Time` header
- `app/api/comments/[id]/route.ts` — full-record single-ticket (id/uuid/ref), image behind param
- `app/api/widget/route.ts` — notify hook + trivial `ref` in response (owned one-liner)
- `cli/` — watch fixes (double-tick, pool close), `--since-file`, server-side filters, ref-aware show/resolve/reopen/assign
- `mcp/src/` — `since` on list_tickets, refs accepted everywhere
- `docs/AGENT-SETUP.md` (new) — copy-paste recipes
- client settings page — minimal webhook add/remove section

## Must NOT touch
app/admin, login/auth internals, branding code (better-auth lane). Use lib/auth.ts helpers as-is.

## Open-question defaults taken
- **comment.updated granularity** → fire on status + assignee changes only (not priority renumbering, not notes). Noise avoidance.
- **Webhook retry** → 1 retry then mark failed; no dead-letter.
- **Dashboard webhook UI** → minimal functional; ui-rethink owns beauty.
- **serverTime delivery** → response **header** `X-Server-Time` (ISO), not a body field — honors "no changed response fields" (GET stays a bare array) while giving pollers a skew-free checkpoint.
- **Fire-and-forget mechanism** → `after()` from `next/server` (Next 15.5, built-in) instead of adding `@vercel/functions`. Runs post-response on Fluid Compute; zero new deps.
- **CLI --since-file checkpoint** → advance to `max(updated_at)` of emitted rows (data-derived, no clock skew), not serverTime. Emits each ticket exactly once across restarts.
- **Single-ticket back-compat** → default GET /api/comments/[id] now returns the full record (light, no image); `?includeImage=true` includes image_data; `?imageOnly=true` returns the legacy `{image_data}` shape. No in-app callers of this GET exist (dashboard uses /api/comments/images), so the default flip is safe.

## RELEASE-NOTES (fork owners)
- **Schema v5 (additive):** new `webhooks` table (client/project-scoped outbound webhooks). First run against a v4 DB adds it; no data migration.
- **Webhooks:** register via client Settings → Webhooks or `POST /api/webhooks`. Signed with `X-BC-Signature: sha256=<HMAC(secret, raw body)>` + `X-BC-Event`. Secret shown once at creation. Events: `comment.created`, `comment.updated` (status/assignee changes only). 5s timeout, 1 retry, SSRF-guarded (https only; http localhost only; private IPs rejected at delivery). Screenshot omitted from payload — fetch via `links.api?includeImage=true`.
- **Polling:** `GET /api/comments?since=<ISO8601>` returns comments updated after the checkpoint; new `X-Server-Time` **response header** is the skew-free next checkpoint (body unchanged — still a plain array).
- **⚠️ BREAKING (accepted 2026-07-03, Annie): single-ticket endpoint default shape changed.** `GET /api/comments/[id]` now returns the **full record** (accepts serial id, uuid, or ref like `LWF-12`, scope-checked) instead of `{ image_data }`. `?includeImage=true` adds `image_data`; **`?imageOnly=true` returns the legacy `{image_data}` shape** (the escape hatch for old consumers). **Older deployed CLI/MCP installs must update** to the new versions bundled here — the new `show --include-images` / MCP `include_image` fetch images via this endpoint with `?includeImage=true`; an un-upgraded install pointed at the new API would receive a light record (no image) unless it uses `?imageOnly=true`. Upgrade the CLI (`npm i -g @jomafilms/browser-comments-cli`) and MCP package to keep image retrieval working.
- **`POST /api/widget`** response now includes `ref`.
- **CLI:** `watch` bugfixes (no more double-emit; DB-mode survives past the first tick); `watch --since-file <path>` streams new/changed tickets as JSON lines, exactly once across restarts; `list` filters now applied server-side; `show/resolve/reopen/assign` accept refs/uuids (and legacy numbers) and use the single-ticket endpoint (no full-list downloads for ref/uuid). Text output shows `ref`.
- **MCP:** `list_tickets` gains a `since` param; all tools accept refs/uuids everywhere a number was accepted.
- New `docs/AGENT-SETUP.md` — copy-paste recipes (Claude Routine, GitHub repository_dispatch, plain watch loop) + signature verification.

## Notes / deviations (all defaults from the brief taken)
- `after()` from `next/server` used for fire-and-forget (no `@vercel/functions` dep needed).
- `serverTime` delivered as a header (`X-Server-Time`), reconciling "gains serverTime" with "no changed response fields".
- `since` SQL: `date_trunc('milliseconds', updated_at AT TIME ZONE current_setting('TimeZone')) > $1::timestamptz` — the column is `timestamp without time zone` (session-local naive); this recovers the true instant and matches ms-precision ISO checkpoints. **Root-caused during testing** (naive UTC-vs-local comparison silently filtered everything; ms-vs-µs re-emitted the boundary row forever). Fixed + verified on both API and CLI DB paths.
- CLI/MCP bare numbers = legacy display_number, resolved via one scoped list lookup (endpoint integers = serial id). Refs/uuids never scan. Caveat: CLI DB-mode `since` assumes the client tz == DB session tz (true locally; API path is fully tz-safe).
- Dev DB (local Postgres) migrated to **v5**. Prod (Neon) NOT migrated — HUMAN GATE at merge.

## Status — ALL DONE, verified
- [x] schema v5 webhooks table (applied to dev)
- [x] webhook CRUD db + route (token-scoped, admin, reveal-once secret)
- [x] notify hook wired into comments POST + widget POST + PATCH
- [x] delivery (HMAC + SSRF + 1 retry) — verified: good hook 200, SSRF hook (169.254.169.254) blocked (last_status 0), tamper fails HMAC
- [x] ?since= + X-Server-Time — round-trip verified
- [x] single-ticket full record — ref/uuid/id all resolve, cross-tenant 404
- [x] CLI watch fixes + --since-file (exactly-once across restarts) + server-side filters + refs
- [x] MCP since + refs
- [x] docs/AGENT-SETUP.md
- [x] settings page webhook UI (components/WebhooksSettings.tsx)
- [x] verify: tsc (root+cli+mcp) clean, build clean, cli+mcp build clean, all manual acceptance tests pass

## /check outcome (business rules + independent security & correctness review)
- **Business rules:** Rule 1 (no secrets) ✓ · Rule 2 (per-client scoping) ✓ verified live (cross-tenant 404) · Rule 4 (machine-friendly JSON) ✓. Rule 3 (additive-only) — see the flagged decision below.
- **Security review** (independent agent): found + FIXED two HIGH SSRF bypasses — (1) IPv6 IPv4-mapped **hex** form (`::ffff:a9fe:a9fe` = metadata IP) defeated the substring guard → replaced with a full `ipv6ToBytes` parser (mapped hex+dotted, NAT64, IPv4-compat); (2) redirects were followed → added `redirect:'manual'`. Re-verified live: good hook 200, hex-mapped metadata hook last_status=0. LOWs also handled: `?since=` format validation (400), `WEBHOOK_BASE_URL` trusted-origin override, `WEBHOOK_ALLOW_LOOPBACK` env gate. HMAC / cross-tenant scoping / secret handling / SQL-injection: clean. Residual (documented): DNS-rebinding TOCTOU — undici IP-pinning unavailable; redirects closed + poll safety-net make it narrow.
- **Correctness review** (independent agent): verdict SHIP. Clean: double-tick fix, closePool skip, comment.updated change-detection, `after()` fire-and-forget, legacy CLI/MCP number semantics, no dead code. Fixed: misleading tz comment (API path is fully tz-safe; CLI DB-mode has the documented cross-tz caveat); `resolveWriteTarget` now throws instead of falling back to a bare number. Deferred LOWs (noted): per-field double-fire of comment.updated on a rare multi-field PATCH; comments.ts 332 lines (cohesive, split candidate).

## ⚠️ ONE DECISION FOR THE MERGE GATE (Annie / orchestrator)
`GET /api/comments/[id]` default response changed from `{ image_data }` → the **full record** (image behind `?includeImage=true`; legacy `{image_data}` behind `?imageOnly=true`). This is what the handoff specified (build item 5) and there are **no in-repo callers** of this GET (dashboard uses `/api/comments/images`). But per the strict letter of Rule 3 (additive-only), the default shape changed for any external consumer relying on the old default. Two agents flagged it for **conscious acceptance**. Options: (a) accept as-is (handoff-authorized, back-compat param provided), or (b) keep `{image_data}` as default and move the full record behind a flag (would require rewiring the new CLI/MCP single-ticket calls). **Recommend (a).** Awaiting sign-off at the gate.

## STOP BEFORE MERGE
Vercel auto-deploys prod on push to main and this lane ships schema. Do /check + commit on branch + write lane status, then print READY-TO-MERGE and wait. Orchestrator coordinates prod DB gate + merge order.
