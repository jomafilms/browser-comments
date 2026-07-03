# Lane: agent-plumbing — webhooks + polling so agents pick up tickets without a human

**TL;DR:** One notify hook on the single write path, per-project/client webhooks (HMAC-signed), `?since=` polling, a real single-ticket endpoint, and a fixed CLI `watch`. We provide plumbing only — autonomy is configured on the agent's side (Claude Routines /fire, Cursor Automations, GitHub repository_dispatch); nothing here auto-fixes anything.

**Depends on:** security lane (lib/auth.ts, route auth) and data-model lane (lib/db/ split, refs, findCommentByRef) both merged.

## What exists / don't rebuild
- Single write path: `POST /api/comments` and `POST /api/widget` both funnel into `saveComment()` — hook AFTER save in the routes, NOT inside the db layer (keep db pure).
- `PATCH /api/comments/[id]` is the single update path (status/assignee/priority).
- `updated_at` is maintained on every mutation including batch-update — `since` filtering is safe.
- CLI: `watch` command + `cli/lib/scheduler.ts` exist with two known bugs (below). MCP server has 5 tools keyed on display numbers.
- `GET /api/comments/[id]` currently returns only image_data (app/api/comments/[id]/route.ts:42-54).
- data-model lane added `findCommentByRef()` and `ref`/`uuid` fields.

## The build
1. **`lib/notify.ts`**: `onCommentCreated(comment, project, client)` and `onCommentUpdated(comment, change)` — fire-and-forget via `waitUntil()` (Vercel Fluid) so widget response latency is untouched. Called from the two POST routes + PATCH route. This is ALSO where the later email lane hangs — design the interface with a channel list (webhooks now, email later).
2. **Webhook storage** (SCHEMA_VERSION=5, additive): `webhooks` table — id, client_id, project_id NULLABLE (null = all client projects), url, secret (generated, shown once), events array (default `['comment.created']`, also `comment.updated`), active bool, created_at, last_status, last_fired_at. CRUD via new `app/api/webhooks` route (token-scoped: a project token manages only its project's hooks; admin sees all). Dashboard: minimal add/remove UI on the client settings page (app/c/[token]/settings) — URL field + event checkboxes + reveal-once secret + last-delivery status.
3. **Delivery**: POST JSON `{event, timestamp, data: {comment with ref/uuid/url/page_section/priority/submitter_name/project, image OMITTED}, links: {api, dashboard}}` with headers `X-BC-Signature: sha256=<HMAC-hex of raw body>` and `X-BC-Event`. 5s timeout, one retry after failure, record last_status. No queue infra — keep it a plain fetch; document that guaranteed delivery is the consumer's job (poll `since` as the safety net — that's the standard pairing).
4. **Polling API**: `?since=<ISO8601>` on GET /api/comments (filters `updated_at > since`, additive param in `getCommentsByTokenContext`); response gains `serverTime` so pollers can checkpoint without clock skew.
5. **Single-ticket endpoint**: extend GET /api/comments/[id] to return the full record (keep the image-only mode behind existing param for back-compat); accept id, uuid, or ref via findCommentByRef within token scope. Review M6: CLI/MCP `show/resolve/reopen/assign` switch to it (stop downloading every ticket to find one); CLI passes list filters server-side (the "API ignores filters" comment at cli/lib/api-client.ts:21 is stale — filters work).
6. **CLI watch fixes** (review M5): one-shot tick runs twice (cli/commands/watch.ts:36 + scheduler.ts:21-23 — let startSchedule own the tick); `bin.ts:141-143` closes the DB pool while the interval still runs — skip closePool for watch. Add `--since-file <path>` (persists last checkpoint so restarts don't re-emit) and emit only NEW/CHANGED tickets per tick as JSON lines.
7. **MCP**: add `list_tickets` `since` param; accept refs everywhere display_number is accepted (additive).
8. **Docs**: `docs/AGENT-SETUP.md` — copy-paste recipes: (a) webhook → Claude Code Routines fire endpoint, (b) webhook → GitHub repository_dispatch → claude-code-action, (c) plain `browser-comments watch` loop. Written so an agent can read the file and self-configure. This becomes source material for the landing-page lane.

## Guardrails
- Human-in-loop by design: we never call agents' APIs; we only accept a URL to POST to. No "auto-fix" feature exists on our side.
- Additive API only: no changed response fields, no removed params.
- Webhook secrets: generated server-side (32 hex), stored plain (they're outbound signing keys, not passwords), shown in full only at creation.
- SSRF guard on webhook URLs: https only (allow http for localhost), resolve-and-reject private IP ranges at delivery time — we learned this lesson deleting /api/proxy.
- Schema v5 via /migrate on DEV only; prod apply is a human gate at wrap.
- Stage by explicit path; never `git add -A`.

## Acceptance
- Submit via test-widget → local webhook receiver (script a tiny listener) gets a signed payload; tampered body fails HMAC check.
- `browser-comments watch --interval=10 --since-file /tmp/cp` emits a ticket exactly once across restarts.
- One-shot watch emits exactly one JSON document. DB-mode watch survives >2 ticks.
- `curl` the single-ticket endpoint by ref, uuid, and legacy number — all work, all scope-checked (cross-tenant ref returns 404).
- `npx tsc --noEmit` + `npm run build` clean.

## Open questions (take defaults, note in lane file)
- `comment.updated` granularity → default: fire on status/assignee changes only (not priority renumbering) to avoid noise.
- Webhook retry policy → default: 1 retry, then mark failed; no dead-letter infra.
- Dashboard webhook UI polish → default: minimal functional UI; the ui-rethink lane owns beauty.
