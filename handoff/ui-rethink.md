# Lane: ui-rethink — make client vs project scope obvious

**TL;DR:** Annie: "the project scope / client scope is a bit confusing in the UI. a rethink would be amazing." Design-bearing lane — propose the information architecture FIRST (written proposal + Annie gate), then implement. Runs LAST so it works on the settled feature set (refs, webhooks UI, /admin, email settings).

**Depends on:** all prior lanes merged.

## What exists (the confusion to solve)
Mental model today: **client** (Adobe, LWF…) = the account, owns widget key + magic-link token + settings + assignees; **project** (a site/app under a client) = owns origin URLs, optional narrower token, and comments hang off it (or off nothing — orphans). Confusion symptoms:
- `/c/{token}` behaves differently for client vs project tokens with the same UI.
- Widget key is per-CLIENT but origin allowlist is per-PROJECT — submissions route to a project by origin matching, invisibly.
- Comments with NULL project_id are reachable only via client scope.
- Settings (widget appearance, notifications) are client-level; users look for them per project.
- Two token types + a widget key + (now) webhook secrets — four credential-ish strings with no unified "access" view.

## The build
1. **Phase A — proposal (no code):** short doc (handoff/ui-rethink-proposal.md) with the recommended IA + wireframe-level sketches. Requirements: keep magic links; keep per-client scoping as THE security boundary (PROJECT-RULES Rule 2); mobile-friendly; no rebuild of the comments table/canvas components unless essential. Consider: project switcher within a client view; one "Access & keys" panel per client (tokens, widget key, webhooks, snippets together); explicit orphan-ticket surface; settings placement. **STOP — Annie approves/edits the proposal before any code.**
2. **Phase B — implement approved IA** across app/c/** and /admin, splitting any file >300 lines touched along the way. Update EXTERNAL-DEV-SETUP + landing screenshots if navigation changed.

## Guardrails
- URLs keep working: existing /c/{token}(/…) links are in clients' bookmarks — redirect old routes, never 404 them.
- No API shape changes (UI lane; if the IA demands one, flag additive-only and ask).
- Human gate at Phase A→B, and a visual check with Annie before merge.
- Stage by explicit path; never `git add -A`.

## Acceptance
- Annie-approved proposal doc committed alongside implementation.
- A new user can answer in the UI without docs: "which sites can submit here, which key goes in the snippet, who gets emails, what can this token see."
- All existing links resolve; `npm run build` clean.

## Open questions
- All deferred to the Phase A gate — that's the point of this lane.
