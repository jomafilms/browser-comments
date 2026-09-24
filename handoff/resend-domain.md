# Handoff — verify joma.film in Resend, then confirm EMAIL_FROM sends

**Mode:** fix / ops. Small, but the digest is on a temporary sender until it's done.

**Lane:** `resend-domain` · parallel-safe · no repo files change (env only).

---

## Goal

The daily owner digest sends from **`noreply@joma.film`** (Annie's choice,
2026-09-23) instead of Resend's shared test sender.

## Why

2026-09-23: the first real send failed with

```
Resend 403: The jomafilms.com domain is not verified.
Please add and verify your domain on https://resend.com/domains
```

To prove the pipeline end-to-end, `EMAIL_FROM` on prod was switched to
**`onboarding@resend.dev`** (Resend's shared test sender) and the digest sent
successfully — 58 tickets.

**Why this matters and isn't cosmetic:** `onboarding@resend.dev` can only
deliver to the email address on the Resend account itself. It works today
because that is Annie's address, but it is a test sender — it should not be the
long-term From on a daily operational email, and it will not deliver anywhere
else if `OWNER_DIGEST_TO` ever gains a second recipient.

## Do

1. Resend → https://resend.com/domains → add **`joma.film`** (note: NOT
   `jomafilms.com` — different domain), add the DNS
   records it gives you (SPF/DKIM) at the domain registrar, wait for verified.
2. `EMAIL_FROM` is **already set to `noreply@joma.film`** on prod (2026-09-23,
   clean deploy). Nothing to change unless it needs to move again:
   ```bash
   vercel env rm EMAIL_FROM production --yes
   printf 'noreply@joma.film' | vercel env add EMAIL_FROM production
   vercel deploy --prod --yes     # NOT `vercel redeploy` — see gotcha below
   ```
3. Confirm with a forced send (see "Forcing a send" below), or just wait for the
   next 6am PT digest and check the From address.

## Done when

A digest arrives from `noreply@joma.film`.

Check verification without sending anything:
```bash
read -rs RESEND_KEY
curl -s -H "Authorization: Bearer $RESEND_KEY" https://api.resend.com/domains \
  | jq '.data[] | {name, status}'
```

## Gotcha that cost an afternoon — do not repeat

**`vercel redeploy` reuses the previous deployment's environment snapshot.**
Env vars set after that deployment was built do NOT reach the running code, and
there is no warning — the cron just silently behaves as if they were unset.
Always use `vercel deploy --prod` after changing env.

## Forcing a send (instead of waiting for 6am PT)

The daily gate is `localHour === EMAIL_DIGEST_HOUR` (`EMAIL_DIGEST_TZ`, default
America/Los_Angeles), plus a 20-hour guard since the last send.

```bash
# set EMAIL_DIGEST_HOUR to the CURRENT PT hour, deploy, then:
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://dev-tix.vercel.app/api/cron/digest | jq .owner
# then put EMAIL_DIGEST_HOUR back to 6
```

`CRON_SECRET` is stored Sensitive in Vercel, so its value cannot be read back —
it was rotated 2026-09-23 for this reason. To trigger manually you must rotate
it again (`vercel env rm` + `add`, then `vercel deploy --prod`) and keep the new
value somewhere you control. Nothing else uses it.

⚠️ A successful send advances `instance_settings.last_owner_digest_at`, so the
next digest covers only from that moment. A FAILED send deliberately does not
advance it, so nothing is lost on failure.
