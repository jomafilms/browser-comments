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
