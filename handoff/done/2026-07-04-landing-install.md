# Lane: landing-install — the open-source front door

**TL;DR:** `/` becomes a one-page marketing + install site (the GitHub README links to it), with a working Vercel Deploy Button that auto-provisions Neon, a copy-paste widget snippet, an agent-setup section written FOR agents, LICENSE, release notes, and consolidated docs. Positioning: easiest, cheapest, most efficient feedback→agent tool; great for small teams (big too). Free tier is the product (tier 1); honor-system commercial license comes later (tier 2) — do not build payments.

**Depends on:** better-auth merged (/ is free; admin lives at /admin). agent-plumbing merged (docs/AGENT-SETUP.md exists as source material).

## What exists / don't rebuild
- Content is scattered but written: README.md, QUICKSTART.md, CORS_SETUP.md, docs/EXTERNAL-DEV-SETUP.md, cli/README.md, mcp/README.md, docs/AGENT-SETUP.md. Consolidate — don't re-research.
- Schema lazy-init fallback (data-model lane kept it) means the Deploy Button needs zero migration config.
- `/` is currently a redirect stub to /admin.

## The build
1. **Landing page at `/`** (use the frontend-design skill for quality; app's Tailwind v4): single page —
   - Hero: what it is (clients click, annotate, you + your agents fix), one screenshot/animated demo of the widget.
   - "Install in 3 steps" — the deploy button, create client, paste snippet.
   - **Deploy Button** (research-verified syntax): `https://vercel.com/new/clone?repository-url=<encoded github url>&project-name=browser-comments&repository-name=browser-comments&products=[{"type":"integration","integrationSlug":"neon","productSlug":"neon","protocol":"storage"}]` + `env=ADMIN_SECRET` removed if better-auth made it optional — check; use envDescription/envLink. Test the URL renders Vercel's wizard correctly (can't complete a deploy in CI — human verifies end-to-end, list as deferred step).
   - Widget section: the script tag with a visual "where to find your key."
   - **For agents section**: CLI + MCP one-liners, webhook recipes (from AGENT-SETUP.md), phrased so a coding agent pasted this page can self-configure. Include an `llms.txt`-style plain block.
   - Honest pricing note: free & open source, self-hosted; link GitHub.
   - No cookie banners, no analytics, no signup.
2. **Dashboard "copy snippet" affordance:** in /admin client view, a ready-to-paste `<script ...data-key="THEIR_KEY">` block with copy button (the real one-click — friction today is finding the key, per Annie).
3. **LICENSE file** — MIT (flag: package.json says ISC; MIT is the friendlier default — confirm at wrap gate), fix package.json license field + add description.
4. **RELEASE-NOTES.md** at repo root — collate every breaking/notable change logged by prior lanes (write-auth requirements, ?admin= deprecation, /admin move, refs, webhooks, env vars). Audience: the <5 fork owners. Link prominently from README.
5. **README rewrite**: short — what it is, screenshot, Deploy Button, link to the landing page + RELEASE-NOTES; move detail to docs/. Delete/merge QUICKSTART.md + CORS_SETUP.md content into docs/ so there's ONE canonical setup path.
6. **What's-Next notes** (CURRENT-STATUS): Jira-bridge integration via webhook; Cloudflare stack spike (parked); Turnstile option; tier-2 honor license page.

## Guardrails
- No payments, no license-enforcement code (tier 2 is honor-system, later).
- Deploy Button repo URL points at github.com/jomafilms/browser-comments (public).
- Marketing claims must be true TODAY (post-lanes): no promising features that didn't ship.
- Human gate: Annie approves landing copy + design before merge (taste checkpoint — pause at a preview and ask).
- Stage by explicit path; never `git add -A`.

## Acceptance
- `/` renders the landing page (no auth), /admin untouched; `npm run build` clean.
- Deploy Button URL opens the Vercel clone wizard with Neon integration attached (screenshot in lane file).
- LICENSE + RELEASE-NOTES.md + rewritten README committed; stale docs removed/merged.
- An agent given only the landing page URL text can produce correct CLI/MCP/webhook config (self-test this).

## Open questions (take defaults, note in lane file)
- MIT vs ISC → default MIT, but CONFIRM with Annie at the copy-review gate (license choice is hers).
- Demo asset → default: real screenshot of test-widget flow; animated GIF only if quick.
- Domain → default: keep dev-tix.vercel.app for now; note custom-domain step for Annie.
