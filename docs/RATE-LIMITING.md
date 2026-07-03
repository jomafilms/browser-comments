# Rate Limiting

## In-code limiter (best-effort)

`lib/rate-limit.ts` applies a fixed-window, in-memory limit per IP + key:

- **Writes** (`POST /api/widget`, `POST /api/comments`): 20/min (env: `RATE_LIMIT_WRITE_PER_MIN`)
- **Reads** (`GET /api/comments`): 60/min (env: `RATE_LIMIT_READ_PER_MIN`)

Over-limit requests get `429` with a `Retry-After` header.

**Caveat:** on Vercel each function instance keeps its own counters, so a burst
spread across instances can exceed the nominal limit. Treat this as abuse
damping, not enforcement.

## Real enforcement: Vercel WAF rule

For hard limits, add a WAF custom rule (Project → Firewall → Rules):

1. **Rule type:** Rate limit
2. **If:** Request Path equals `/api/widget` (add a second rule for `/api/comments`)
   and Request Method equals `POST`
3. **Rate limit:** 20 requests per 60 seconds, keyed by IP address
4. **Action:** Deny (or Challenge to be gentler on shared NATs)

Or via `vercel.ts` / dashboard equivalent once firewall-as-code is configured
for this project. See https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting

## Turnstile (not implemented)

Cloudflare Turnstile on widget submissions is a candidate follow-up if
anonymous spam becomes a problem — tracked in CURRENT-STATUS "What's Next".
