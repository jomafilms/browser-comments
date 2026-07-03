# Agent Workflow — Paste This Into Your CLAUDE.md

<!-- Copy everything below into your project's .claude/CLAUDE.md -->
<!-- Place it at the TOP of the file so every agent sees it first -->

## START HERE — Every Agent Must Follow This Workflow

### Step 1: Read current state
- **Always read `docs/CURRENT-STATUS.md` first.** It has: what was last done, what's in progress, what's next, blockers.
- For business logic: read `docs/PROJECT-RULES.md`

### Step 2: The task cycle (every task, every time)
```
1. READ    → CURRENT-STATUS.md + relevant reference docs
2. CLAIM   → Create your lane file: docs/status/active/<lane>.md with your task + the files you expect to touch. (Do NOT write in-progress churn into CURRENT-STATUS.md — that's the shared read surface.)
   ⚠️ ISOLATE if not alone: if the tree is already dirty or another session has a lane in docs/status/active/, you MUST work in your own worktree — `git worktree add ../<repo>-<lane> -b <lane>` — BEFORE editing any file. Two sessions in one tree physically share files (a lane file is a sticky note, not a lock) and will entangle edits + break the build. Only a confirmed-solo session stays on main.
3. BUILD   → Implement code changes
4. VERIFY  → Type-check, test, review against project rules
5. /check → The quality gate. Always checks the diff against business rules; auto-decides whether to also run the deeper bug/security scans. (Optional to call by hand — /wrap runs it for you.)
6-8. /wrap → The finish line, one verb: gate → checked docs write → fold + delete lane → commit → merge to main → remove worktree → push → handoff.
```

### Available slash commands
- **`/wrap`** — The finish line. One verb: runs /check, writes docs (checked), folds + deletes your lane, commits, merges to main, removes the worktree, pushes, hands off. Say this when you're done. (`/update` is an alias.)
- **`/check`** — Pre-handoff gate. Always checks business rules vs the diff; auto-runs native `/code-review` / `/security-review` only when the change warrants. Run standalone any time, or let `/wrap` call it.
- **`/dev`** — Start the local dev server for this lane (right port, shared node_modules, env copied). Use sparingly — only when you need to see the app or are asked.
- **`/project-status`** — Timestamped snapshot + reset of CURRENT-STATUS.md. Use on significant phase completions.
- **`/sync-skills`** — Pull the latest version of this project's installed skills from the shared `claude-skills` repo (refresh-only; reports what changed; never adds or overwrites project-specific ones).

> Native built-ins (don't confuse with ours): `/code-review` = deep bug/cleanup scan (our `/check` calls it); `/security-review` = security pass (ditto); `/review` = reviews a GitHub **PR** (unrelated to our cycle).

### Local-only files — `.private/`
`.private/` is a **gitignored** directory for private/sensitive material (pitch drafts, raw transcripts, secrets, scratch). Agents may **read** it for context, but **never commit its contents, move files out of it into tracked paths, or paste secrets from it** into code, docs, or commits.

### Handoffs — `handoff/`
Next-task briefs live in **`handoff/<feature>.md`** — paste-ready and self-contained (Mode · Goal · Why · Settled-don't-relitigate · Read&trace · Do · Done-when · Open questions · Lane). Start a task by typing **`@handoff/<feature>.md`** into a fresh session (+ any notes). `/wrap` writes these; `CURRENT-STATUS` "What's Next" is just a one-line **index** pointing to them; finished ones are archived to **`handoff/done/`** (the shipped-feature log). If you pick one up: read it, claim your lane, and let `/wrap` archive it when done.

## Working Alongside Other Sessions (concurrency)

This project expects multiple Claude sessions running at once. **That is normal and supported.** Read this before assuming something is wrong.

### A file changed on disk since you read it — this is fine
Another session touched it. This is **not** corruption and **not** a reason to stop or warn the user. Re-read the file, reconcile your change with what's there, and proceed. Only escalate if your change and theirs are genuinely incompatible (same function, opposite intent).

### One source of truth — `CURRENT-STATUS.md`
`docs/CURRENT-STATUS.md` is the **single source of truth** and the shared READ surface. It is always the one place to learn project state. To keep concurrent sessions from clobbering it mid-task, **don't write your in-progress churn there** — write it to your transient lane file instead. It still gets written on every wrap (see below); it just gets written *carefully*, not constantly.

### Lane files are transient scratch, not a second source of truth
- Each session owns a lane file: `docs/status/active/<lane>.md`. Pick a short lane name (the feature/area you're working). List the task + the files you expect to touch.
- Before editing a code file, glance at the other `active/*.md` lanes. If another session has claimed it, work elsewhere or ask the user — don't edit the same file in parallel.
- Lane files exist **only while the task is in flight.** At `/wrap` your lane is folded into `CURRENT-STATUS.md` and then **deleted.** They never accumulate and never compete with the source of truth.

### The wrap-write is checked, not blind
When `/wrap` writes your finished work into `CURRENT-STATUS.md`:
1. **Re-read `CURRENT-STATUS.md` fresh first** — another session may have updated it since you started.
2. Only move **your own** items from in-progress to done. Do not touch other sessions' lines.
3. If git reports the file changed under you while writing, re-read and re-apply — never force-overwrite.

### Use a worktree when running in parallel — REQUIRED, and it cleans itself up
If you are one of several sessions at the same time, you **must** work in your own git worktree + branch so checkouts and commits never collide. This is not optional — a lane file alone does **not** stop two sessions editing the same file on disk:
```
git worktree add ../<repo>-<lane> -b <lane>
```
Build there. At `/wrap`, the branch is **automatically merged to `main` and the worktree + branch removed** — you never manage branches by hand and none are left hanging around. Only a confirmed-solo session stays on `main`. If you find yourself sharing `main` with another active lane, stop and move to a worktree before editing. Overnight/autonomous parallel builds use the `build-orchestrator` skill, which already does this.

### Running locally with parallel sessions — use `/dev`, sparingly
Don't auto-start a dev server. Start one only when you need to see the app render, or when the user asks — use the **`/dev`** command, which handles all of the below. Key facts:
- **Start dev sparingly.** Logic/data/docs work needs no server. A server "just in case" wastes ports and memory.
- **One port per lane.** Two dev servers can't share a port: `npm run dev -- -p 3001`. Record it in your lane file. `localhost:3000` shows **one** branch only — not all of them.
- **Bootstrap a fresh worktree cheaply.** `git worktree add` copies only *tracked* files, so:
  ```
  cp ../<repo>/.env.local .                       # carry env in
  ln -s ../<repo>/node_modules node_modules        # SHARE main's node_modules — don't duplicate
  ```
  A real per-worktree `npm install` costs 300–800MB each; symlink instead. Only real-install if this branch changed `package.json`/lockfile (never `npm install` through the symlink — it mutates main's copy).
- **Shared dev database.** Parallel branches usually share one DB via the same `.env.local`. Fine for UI; for schema/data changes run one lane at a time.
- At `/wrap`, stop your lane's dev server before the worktree is removed.

## ⚠️ Tech Stack & Currency — READ FIRST (your training may be stale)

<!-- Fill this in per project. Delete the examples. This is the single highest-leverage guardrail. -->

Your training cutoff may be **behind** this project's stack. When a library or platform changed after your cutoff, you will tend to "correct" current code back to stale patterns from memory. **Don't.** Verify against the sources below before changing framework/platform code, and don't "modernize" code to what you remember.

**Stack — pin current versions (update when they change):**
- [framework + version] · [language] · [styling] · [runtime/host] · [database] · [auth] · …

**Things training gets wrong here — the corrections:** <!-- the specific traps; delete if none yet -->
- [e.g. "Platform X's old API Y is gone → use Z"]
- [e.g. "We evaluated and rejected <thing> — do not reintroduce it"]

**How current knowledge is managed in this repo (best practice, in leverage-per-effort order):**
1. **This section** — high-signal guardrails, always loaded. Highest leverage; keep it tight and current.
2. **Vendored docs** — `docs/reference/llms/*.llms.txt` for any vendor that publishes an `llms.txt` (greppable, version-pinned, no network).
3. **Memory** — the durable "why" behind stack choices (survives even without the repo open).
4. **MCP** — only when a vendor *kills* static docs (e.g. Astro replaced `llms.txt` with a docs MCP) or agents keep going stale despite 1–3. Add to `.mcp.json`; it costs per-session tokens + a one-time approval prompt, so reach for it last.
5. When unsure about a post-cutoff API, **WebSearch / WebFetch the official docs — don't guess.** TypeScript types in `node_modules` are ground truth.

---

## Innovate forward

This is **edge work** — the goal is to keep evolving *toward* the cutting edge, not just maintain what exists.

- **Lean to the current best, not the remembered one.** When a newer/better pattern, tool, or API genuinely fits, propose it (with the trade-off) instead of defaulting to the familiar. Never revert current code to stale patterns — see **Tech Stack & Currency** above.
- **The edge is past your training — so research it, don't guess.** When you're beyond what you reliably know: WebSearch/WebFetch the official docs, use the **deep-research** skill for multi-source questions, and the **claude-code-guide** agent for Claude Code itself. Guessing-from-memory is the failure mode here.
- **Be creative.** Bring novel options, not just the textbook answer. When there's a more inventive path that fits, surface it.
- **Stay proportionate.** Edge, not bleeding-edge-for-its-own-sake. Innovate within what a tiny team can actually maintain — new ≠ better if it adds fragility. DRY, simple, maintainable still win ties.

---

### When project rules might be wrong
If the code needs to do something that **conflicts with the project rules doc**, STOP and ask the project owner. Don't assume the code should override the rules or vice versa. Flag it clearly.

### Code quality criteria (enforce on every change)
- **DRY:** No duplicated logic. Extract shared helpers.
- **No hardcoded values:** All configurable values in config files.
- **File size:** Target 250-300 lines max. Split if larger.
- **Maintainable:** Small team. Every file must be understandable quickly.
- **Testable:** Functions should be unit-testable independently.
- **Business rules:** Code must match `docs/PROJECT-RULES.md`
