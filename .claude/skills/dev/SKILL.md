---
name: dev
description: Start the local dev server for this lane on its own port, with shared node_modules and env copied. Use sparingly, only when you need to see the app or are asked.
---

Start the local dev server for THIS lane, correctly. **Use sparingly** — only when you actually need to see the app render, or when the user asks. Don't auto-start a server on every task; backend/logic/docs work doesn't need one.

## Steps

1. **Decide if it's needed.** If the change is logic, data, or docs only, skip it. Starting a server "just in case" wastes ports and memory.
2. **Bootstrap the worktree (parallel sessions only), cheaply:**
   - Env: `[ -f .env.local ] || cp ../<repo>/.env.local .`  (worktrees don't inherit gitignored files)
   - Deps WITHOUT wasting disk: `[ -e node_modules ] || ln -s ../<repo>/node_modules node_modules`
     The symlink shares main's single `node_modules` (a real per-worktree `npm install` can cost 300–800MB each). **Only run a real `npm install` if this branch changed `package.json`/lockfile** — never `npm install` through the symlink, it would mutate main's copy.
3. **Pick a free lane port** — 3001, 3002, … (leave 3000 for main / a solo session). Don't collide with a port another lane already recorded.
4. **Start it** (background): `npm run dev -- -p <port>`
5. **Record + report:** write `Dev server: http://localhost:<port>` into your lane file, and tell the user "lane <x> is live at http://localhost:<port>". Remember: one port = one branch; `localhost:3000` shows only one of them.
6. **Stop at `/wrap`** — kill this server before the worktree is removed.

## Shared dev database
Parallel branches usually point at the same DB via the same `.env.local`. Fine for UI work; for schema/data changes, run one lane at a time or use a separate DB.
