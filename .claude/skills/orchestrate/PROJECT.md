# orchestrate/PROJECT.md — browser-comments

## Docs that win conflicts
- `docs/PROJECT-RULES.md` — esp. Rule 2 (per-client scoping is the security boundary) and Rule 3 (backwards compatibility for deployed widget/CLI/MCP/API).

## Builder preference (Annie, 2026-07-03)
- **Prefer clauded RemADE terminals over background agents** for build lanes — Annie watches and talks to them in the IDE.
- **Rename each terminal to the lane name at creation** (title field) and refer to builders BY DISPLAY NAME in all user communication — once renamed, Annie sees only the display name, never the id.
- **Close terminals when their lane wraps** (house Phase 5 rule applies; track created terminalIds).

## Extra gates
- **Prod DB (Neon) holds live client data** (Adobe, LWF, emotion studios, joma). Schema applies to prod are ALWAYS a human step at wrap, via /migrate. Builders generate + apply to dev only.
- **Widget back-compat**: public/widget.js is live on 4 client sites via one script tag. Any lane touching it must re-verify the embed on app/test-widget (desktop + mobile viewport) before wrap.
- **Outbound email**: test sends to Annie's own address only; enabling real client recipients is Annie's explicit post-merge step.
- **Landing-page copy/design and the ui-rethink IA proposal**: taste checkpoints — pause and get Annie's approval before merging.
- **License choice (MIT vs ISC)**: Annie's call, confirm at the landing-install gate.

## Release-notes rule (2026-07-03)
- <5 known forks; Annie owns all live installs. Breaking-ish changes are allowed but EVERY lane logs its user-visible/breaking changes for `RELEASE-NOTES.md` (collated by the landing-install lane). Note this in every kickoff.

## Kickoff additions
- Repo has no test suite; "verified" = `npx tsc --noEmit` + `npm run build` + the brief's manual checks via /dev.
- `.env.local` at repo root holds the dev DATABASE_URL — copy into worktrees (no port-sensitive URLs today, but recheck once BETTER_AUTH_URL exists: rewrite it to the lane's /dev port).
- node_modules symlink sharing is fine (no workspace packages); `cli/` and `mcp/` have their OWN node_modules — real-install inside the worktree if the lane touches their package.json.

## Project learned rules
- (2026-07-03) Lay-of-land agent claimed gitignored-on-disk files were committed; `git ls-files` said otherwise. Verify hygiene claims against the index before acting.
- (2026-07-03) **Vercel auto-deploys production on every push to main.** The data-model lane's /wrap push auto-deployed v4 code against the v3 prod DB — only caught because the ledger + a fast read-only schema check made the gap visible (prod was still v3; deliberate migration then run with Annie's approval, snapshot branch first). RULE: any lane that ships schema must STOP before /wrap's merge-to-main/push; the orchestrator resolves the prod migration gate, then releases the merge. Put this in every schema lane's kickoff.
- (2026-07-03) `npm run init-db` does NOT load .env.local (bare tsx script) — export DATABASE_URL explicitly or it silently targets local postgres.
- (2026-07-03) Builders idle at a session-limit message do NOT auto-resume when the limit resets — nudge them with a continue message. Also: a builder's subagent (e.g. its code-review agent) dying at the limit is recoverable; the builder can redo that step inline.
- (2026-07-03) RemADE bug: terminals created via API can open their UI windows under a DIFFERENT focused project (saw /superconvo) and silently drop the `title` param (list shows `title: null`; there is NO rename endpoint — title is creation-only). The underlying zmx sessions are correct (right projectPath/cwd) and keep running detached even if the user closes the misplaced UI windows (`clients: 0`, daemon alive). After every create: verify placement+title via `/api/terminals/list`, tell Annie the zmxName→lane mapping if the title dropped, and warn her that empty windows in other projects are ghosts, not the builders.
