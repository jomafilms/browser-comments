# Lane: email — Resend/SMTP notifications on the notify hook

**Worktree:** ../browser-comments-email (branch `email`). Parallel lane active: landing-install.
**Status:** building.

## Task
Email notifications hung off `lib/notify.ts`: opt-in instant email on new ticket + hourly/daily digest + resolved notice. Resend-first (via fetch, zero deps) with SMTP fallback (nodemailer). No email vendor required to run the product.

## Files I own / touch
- `lib/email.ts` — provider abstraction (Resend fetch | nodemailer SMTP | disabled+warn) + optional `EMAIL_ALLOWLIST` safety gate
- `lib/email-templates.ts` — hand-rolled HTML templates (instant / digest / resolved), branded via `resolveBranding()`
- `lib/email-notify.ts` — the email channel (settings lookup + rate cap + send)
- `lib/notify.ts` — call the email channel from the existing `after()` hooks (email channel only)
- `lib/db/notifications.ts` — notification_settings read/write + digest queries + last_digest_at
- `lib/db/schema.ts` — SCHEMA_VERSION 6 (additive: clients.notification_settings JSONB + clients.last_digest_at)
- `lib/db/types.ts` — Client gains notification_settings + last_digest_at; NotificationSettings type
- `lib/db.ts` — export the new notifications module (one line)
- `app/api/notifications/route.ts` — GET/POST notification settings (token-scoped, client-level)
- `app/api/cron/digest/route.ts` — hourly digest cron (CRON_SECRET guarded)
- `components/NotificationSettings.tsx` + wire into `app/c/[token]/settings/page.tsx`
- `app/admin/*` — notification settings on the admin client editor (client-level)
- `vercel.json` — cron entry
- `.env.example` — RESEND_API_KEY / EMAIL_FROM / SMTP_* / CRON_SECRET / EMAIL_ALLOWLIST

## NOT mine (landing-install owns): app/page.tsx, LICENSE, README.md, RELEASE-NOTES.md, docs consolidation.

## Decisions / flagged defaults taken
- Email lands AFTER webhooks (channel-shaped, same `after()` hooks).
- Defaults: newTicket='off' (opt-in — never surprise-email), digestCadence='daily', resolvedNotice=false, recipients=[].
- Digest daily send hour: 9am America/Los_Angeles (hardcoded default const; setting later if asked).
- Hand-rolled HTML templates (no React Email dep).
- Client-level settings only (no per-project overrides in v1).
- `last_digest_at` is its own column (not in the JSONB) so settings saves don't clobber digest bookkeeping.
- Resend via plain fetch (no `resend` dep). SMTP via `nodemailer` (new dep — real npm install in worktree).
- Rate cap: 20 instant emails/client/hour (in-memory, per-instance best-effort like rate-limit.ts). On first exceed → one "paused, see dashboard" notice; further dropped that hour.
- Resolved notice goes to the client recipients list (widget captures name only, no submitter email). Optional submitter-email widget field = OUT of scope (parked).
- `EMAIL_ALLOWLIST` (comma-sep) env: when set, sends are restricted to those addresses — enforces the outbound human-gate in config for testing/staging.
- Email link base: `EMAIL_BASE_URL || WEBHOOK_BASE_URL || BETTER_AUTH_URL || request origin`.

## RELEASE-NOTES items (for landing-install to collate)
- New optional env: `RESEND_API_KEY` + `EMAIL_FROM` (Resend, recommended) OR `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` + `EMAIL_FROM` (SMTP fallback). No email env → notifications silently disabled (one startup warning), everything else works.
- New optional env: `CRON_SECRET` (guards the digest cron), `EMAIL_BASE_URL` (canonical origin for email links), `EMAIL_ALLOWLIST` (restrict recipients — testing/staging safety).
- Schema v6 (additive): `clients.notification_settings` JSONB + `clients.last_digest_at`. First run against a v5 DB adds the columns (defaults = notifications off).
- New dep: `nodemailer` (only loaded when SMTP_* is configured; Resend path uses fetch).
- Email notifications are OPT-IN per client (default off). Configure recipients + mode in client Settings → Notifications.
- Digest cron: add `CRON_SECRET` on Vercel; `vercel.json` registers an hourly `/api/cron/digest` tick.
- Resend requires a verified sending domain — see setup docs (human step).

## Verification log
- `npx tsc --noEmit` clean; `npm run build` clean — `/api/cron/digest` + `/api/notifications` routes registered.
- Local dev DB migrated v5 → v6 (`npm run init-db` with explicit local DATABASE_URL); both `clients.notification_settings` (jsonb) + `clients.last_digest_at` (timestamp) present. Prod NOT touched.
- No-email-vars path (the must-work case): `emailEnabled()` false; `sendEmail()` → `{ok:false, skipped:true}`; startup warning fires exactly ONCE across repeated sends; zero errors.
- Settings validation: valid input deduped+lowercased; empty → defaults (off/daily); bad email / bad newTicket / bad cadence / non-array recipients all throw.
- `EMAIL_ALLOWLIST` drops non-listed recipients (verified stranger@ dropped, one warn).
- Templates render + are XSS-safe: `<script>` in submitterName and `<b>` in companyName escaped in HTML; digest grouping (by project + unassigned) + plaintext alt verified.
- Cron HTTP contract (dev server, email disabled): no auth → 401, wrong secret → 401, correct `CRON_SECRET` → 200 `{skipped:"email disabled"}`. `/api/notifications` no token → 400.
- Notifications GET read-path with a real client token → `{settings:{off/daily…}, readOnly:false}` (200).
- Digest SQL (`getDigestClients`, `getDigestItems`) + settings `UPDATE ... RETURNING` validated against local DB inside ROLLBACK transactions — no persisted writes; client rows unchanged after.
- Fixed a stray NUL byte in the digest route grouping key (git had flagged the file binary) → now keyed on stable `projectId`; re-verified no NUL in any touched file.
- DRY: extracted `emailLinkBase()` into lib/email.ts (was duplicated in email-notify.ts + cron route).
- UNTESTED live: Resend send (no RESEND_API_KEY in env) + SMTP send (no local mailpit). Code verified by construction; live send is Annie's post-merge step (to annie@jomafilms.com only, EMAIL_ALLOWLIST recommended).
- Independent adversarial code+security review: **SHIP** — no HIGH/MED. Confirmed: cron auth (timing-safe, closed-when-unset), XSS escaping in all templates, no email-header injection (recipients regex forbids CR/LF; subjects system-controlled), no secret leakage, per-client scoping intact, additive schema, opt-in defaults, non-blocking after() path, DST-safe digest due-ness. 3 LOW notes → 2 fixed:
  - FIXED: digest now advances the checkpoint on `skipped` sends (allowlist-emptied recipients no longer re-attempt hourly / accumulate); response reports `skipped` count.
  - FIXED: email footer said "project settings" → now "client settings" (settings are client-level).
  - WON'T-FIX (immaterial, best-effort by design): instant rate-cap counter increments before the allowlist filters, so allowlist-dropped sends consume cap budget. Noted as a follow-up if it ever matters.
- Re-verified tsc + build clean after review fixes.

## Follow-ups / parked (for future lanes)
- Optional submitter-email field in the widget → would let resolved notices go to the reporter (changes the anonymous-feedback promise — Annie's call). Currently resolved notices go to the client recipients list.
- React Email dependency only if templates multiply.
- Per-project notification overrides (v1 is client-level only).
- Digest send hour as a per-client setting (currently `EMAIL_DIGEST_HOUR`/`EMAIL_DIGEST_TZ` env, default 9am America/Los_Angeles).
- Instant thumbnail in email (skipped — image_data is the heavy column; deep link covers it).

## Notes
- RESEND_API_KEY NOT in this machine's env or .env.local → live Resend send is UNTESTED; verified the disabled/no-env path + code-by-construction. Live send is Annie's post-merge step (to annie@jomafilms.com only first).
- SMTP path UNTESTED live (no local mailpit) — documented, code-by-construction.
- DEV migration only (v6). Prod is a human gate (do NOT merge past READY-TO-MERGE; orchestrator applies prod schema).
</content>
</invoke>
