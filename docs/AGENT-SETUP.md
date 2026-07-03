# Agent Setup — pick up tickets without a human

browser-comments provides the **plumbing** for agents to pick up feedback tickets
automatically. It never calls your agent's API and never "auto-fixes" anything —
it only **emits events** (webhooks) and **answers polls** (`?since=`). You wire
those into whatever runs your agent (Claude Code Routines, a GitHub Action, a
cron loop). Human-in-the-loop is a design choice: you decide what the agent does
with a ticket.

There are two ways to find out about new/changed tickets:

| | Webhook (push) | Polling (pull) |
|---|---|---|
| Latency | instant | your interval |
| Infra | a URL that can receive a POST | none — just a token |
| Delivery guarantee | best-effort (1 retry) | exactly-once with a checkpoint |
| Best for | reacting immediately | the reliable safety net |

**Use both.** Webhooks for speed, polling as the backstop for anything a webhook
missed (a redeploy, a downed receiver). This is the standard pairing — webhooks
are intentionally not a durable queue.

---

## Webhooks

Register a webhook from the client **Settings → Webhooks** page, or via the API:

```bash
curl -X POST "$API/api/webhooks" \
  -H "Authorization: Bearer $BROWSER_COMMENTS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-agent.example.com/hook","events":["comment.created","comment.updated"]}'
```

The response includes the signing **`secret`** — **this is the only time it is
shown in full.** Save it. A project token registers a hook for its project; a
client token can pass `"projectId": N` to scope to one project, or omit it to
fire for every project under the client.

### Payload

Each event is a `POST` with a JSON body:

```json
{
  "event": "comment.created",
  "timestamp": "2026-07-03T18:22:10.000Z",
  "data": {
    "uuid": "…", "ref": "LWF-12", "display_number": 12,
    "url": "https://app.example.com/dashboard",
    "page_section": "/dashboard",
    "status": "open", "priority": "high", "assignee": "Unassigned",
    "submitter_name": "Jane",
    "text_annotations": [{ "text": "button overflows", "x": 0, "y": 0, "color": "red" }],
    "project": { "id": 2, "name": "LWF App UI", "ref_prefix": "LWF" }
  },
  "links": {
    "api": "https://…/api/comments/<uuid>",
    "dashboard": "https://…/c/<token>/comments?c=LWF-12"
  }
}
```

- The annotated **screenshot is never in the payload** — fetch it from
  `links.api` with `?includeImage=true` when you need it.
- `comment.updated` fires on **status and assignee** changes only (priority
  renumbering is deliberately silent), and adds a `"change": {"field":"status","from":"open","to":"resolved"}` block.

### Headers & verifying the signature

- `X-BC-Event`: the event name.
- `X-BC-Signature`: `sha256=<hex>` — HMAC-SHA256 of the **raw request body** using
  your secret. **Always verify it** before trusting a payload:

```js
import { createHmac, timingSafeEqual } from 'crypto';

function verify(rawBody, header, secret) {
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(header || ''), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Compute the HMAC over the exact bytes received (don't re-serialize the parsed JSON).

### Delivery semantics

5s timeout, **one retry** on failure, then it's dropped (`last_status` on the
webhook records the outcome; `0` = network error/timeout). No dead-letter queue.
Targets must be **https** (http is allowed only for `localhost`), and non-loopback
hosts that resolve to private/internal IP ranges are rejected (SSRF guard). If a
delivery is ever lost, polling catches it.

---

## Polling with `?since=`

```bash
curl -sD - "$API/api/comments?since=2026-07-03T18:00:00.000Z&excludeImages=true" \
  -H "Authorization: Bearer $BROWSER_COMMENTS_TOKEN"
```

- Returns comments with `updated_at` **strictly after** `since` (new + changed).
- Read the **`X-Server-Time`** response header and use it as your next `since` —
  it's stamped server-side, so there's no clock skew between you and the API.
- The response body is unchanged (a plain array) — `X-Server-Time` is a header.

---

## Recipe (a): webhook → Claude Code Routine

Point the webhook at your Routine's fire endpoint. The Routine reads the ticket
via the CLI/MCP and does the work.

```bash
curl -X POST "$API/api/webhooks" \
  -H "Authorization: Bearer $BROWSER_COMMENTS_TOKEN" -H "Content-Type: application/json" \
  -d '{"url":"https://<your-routine-fire-endpoint>","events":["comment.created"]}'
```

Your receiver verifies `X-BC-Signature`, then hands `data.ref` to the agent, e.g.
a prompt like: _"Ticket {{ref}} was filed: {{text_annotations}}. Investigate and
propose a fix."_ The agent uses the MCP `show_ticket` tool (with the ref) to pull
the screenshot and full detail.

## Recipe (b): webhook → GitHub `repository_dispatch` → claude-code-action

Relay the webhook into a GitHub `repository_dispatch` event so a workflow running
`anthropics/claude-code-action` picks it up. Minimal relay (any small function):

```js
// verify(rawBody, req.headers['x-bc-signature'], SECRET) first — see above
await fetch(`https://api.github.com/repos/<owner>/<repo>/dispatches`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
  body: JSON.stringify({ event_type: 'browser-comment', client_payload: payload.data }),
});
```

```yaml
# .github/workflows/browser-comment.yml
on:
  repository_dispatch:
    types: [browser-comment]
jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          prompt: |
            Feedback ticket ${{ github.event.client_payload.ref }} was filed:
            "${{ toJSON(github.event.client_payload.text_annotations) }}"
            on page ${{ github.event.client_payload.url }}. Investigate and open a PR.
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Recipe (c): plain `watch` loop (no receiver, no webhook)

No public endpoint required — just poll. `--since-file` persists a checkpoint so
each ticket is emitted **exactly once, even across restarts**, as newline-delimited
JSON (one ticket per line) an agent can stream:

```bash
export BROWSER_COMMENTS_API=https://dev-tix.vercel.app
export BROWSER_COMMENTS_TOKEN=<your-token>

browser-comments watch --interval=30 --since-file ~/.bc-checkpoint | while read -r line; do
  ref=$(echo "$line" | jq -r .ref)
  echo "New/changed ticket: $ref"
  # hand $ref to your agent here (e.g. claude -p "Look at ticket $ref …")
done
```

The first run emits the current backlog and writes the checkpoint; later runs (and
restarts) emit only what changed since. To start from "now" instead of the backlog,
seed the file first: `date -u +%Y-%m-%dT%H:%M:%S.000Z > ~/.bc-checkpoint`.

---

See also: `cli/README.md` (all CLI commands), `mcp/README.md` (MCP tools),
`docs/EXTERNAL-DEV-SETUP.md` (tokens & install).
