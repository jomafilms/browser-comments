---
name: orchestrate
description: Run a strategy→briefs→parallel-build orchestration session — interview the user until scope is clear, write self-contained handoff briefs, spawn builders (background agents or clauded RemADE terminals), watch them event-first with cache-aware fallbacks, and hold human-in-loop gates where the project structure dictates. Use when the user opens a session with a pile of intents ("help me get these features moving") rather than one build task.
---

# /orchestrate — one strategy session drives many build sessions

**Project extension — read it first.** If `.claude/skills/orchestrate/PROJECT.md` exists, read it NOW. It holds everything project-specific: extra human-in-loop gates, worktree setup traps, kickoff-template additions, and project learned rules. Project-specific content lives THERE, never in this file — `/sync-skills` overwrites SKILL.md from the shared repo, but companion files like PROJECT.md survive syncs. If this project has no PROJECT.md yet, create one the first time it teaches you something project-specific.

**Division of labor (the core invariant):** THIS session is the orchestrator — it holds strategy context, writes briefs, spawns and watches builders, and talks to the user. It does NOT write feature code (docs/status folds, review fixes, and one-file policy-applies are fine — e.g., amending a doc to a decision the user just made). Builders get ONE self-contained brief as their whole world. Never build a feature lane inline here; never paste strategy context into a builder.

## Phase 1 — INTAKE (get clear before anything runs)

1. Read `docs/CURRENT-STATUS.md` first (house rule), then whichever authoritative docs the intents touch (`docs/PROJECT-RULES.md` for business rules; PROJECT.md names any doc that wins conflicts). Check `git status`, `git worktree list`, `docs/status/active/`, and `handoff/` — know what's already in flight and already briefed before promising anything.
2. Interview until scope is unambiguous. AskUserQuestion for genuine either-way decisions; plain questions for open-ended ones. Batch questions; don't drip.
3. Separate now-decisions from build-time decisions: get the former answered; write the latter into the briefs as "Open questions" with flagged defaults so builders take the defaults instead of stalling. Decisions only a stakeholder can make don't go in a brief — park them where PROJECT.md says (or surface them to the user directly).

## Phase 2 — BRIEF (write first, execute second)

1. **Verify code state before estimating.** Spawn Explore agents to check what actually exists (schema, flags, half-built features) — briefs must say "reuse X at file:line," not guess. The code is the truth; human memory of what's built drifts fast.
2. Write one brief per lane. **Location encodes trust:** `handoff/auto/<lane>.md` ONLY if genuinely unattended-safe (no taste, no behavior change, no migration-apply beyond dev); everything else is root `handoff/<lane>.md`. House format: TL;DR · what exists / don't rebuild · the build · guardrails · acceptance · open questions with flagged defaults. Self-contained: a builder with zero other context must succeed from it. Name the gating skills (`/migrate`, `/check`, `/wrap`, plus any in PROJECT.md) and any dev-only/prod-deferred rules.
3. Present the sequence (dependencies, what's parallel-safe) and get the user's go. Default **max 2 concurrent builders**; prefer sequential when the user is also working — their attention is the scarce resource.

## Phase 3 — EXECUTE (pick the builder type per lane)

**Background Agent (default for bounded, harness-tracked lanes):** Agent tool, `isolation: "worktree"`, `run_in_background: true` — completion notifies you, no polling needed. Guardrails in the prompt: no push, no merge, no migration-apply, no prod; deliver a branch + report. Caveat: the builder's context dies at completion — review findings become a NEW fix-agent brief, so make the original brief complete.

**Builder model selection (tiers as of 2026-07: `fable` > `opus`):**
- **Inherit (usually Fable — the orchestrator's own model):** taste-adjacent, ambiguous, or design-bearing lanes — anything where the builder must exercise judgment the brief can't fully pre-decide (UX/IA, architecture choices, business-rule interpretation). Also the **adversarial reviewers** — a reviewer weaker than the builder misses what the builder missed. When unsure, inherit.
- **`opus` (Opus 4.8):** well-briefed mechanical sweeps — the brief carries the thinking, the builder just executes it (renames, migrations from a spec, applying a settled pattern across N files). Faster and cheaper; wrong only if the brief turns out incomplete, which the watch loop catches.
- The dividing question: *"if this lane hits something the brief didn't anticipate, do I want it to reason or to stop?"* Reason → inherit/fable. Stop-and-ask → opus is fine.

**clauded RemADE terminal (for long/interactive lanes the user may want to watch or talk to):** use the `remade` CLI (single-quote every URL path):

```bash
remade=/Users/$USER/.remade/bin/remade
$remade POST '/api/terminals/create' '{"projectPath":"<repo>","cwd":"<repo>","title":"<lane>"}'   # returns terminalId
$remade POST '/api/terminals/input' '{"terminalId":"<id>","projectPath":"<repo>","input":"clauded \"<kickoff>\"\n"}'
```

Kickoff prompt template (adapt, keep every element; insert PROJECT.md's kickoff additions where marked):
> Read handoff/<lane>.md and build it. Follow the project workflow: claim docs/status/active/<lane>.md; create a worktree (`git worktree add ../<repo>-<lane> -b <lane>`) BEFORE editing — other sessions are active. Set up the worktree per the project CLAUDE.md concurrency rules (copy env in, share deps by symlink — but real-install if the lane changes package manifests or touches workspace `packages/*`, where wholesale symlinks silently resolve to main's copy). <PROJECT.md worktree/kickoff additions>. Dev server only via /dev, own port, recorded in the lane file. For the brief's open questions take the flagged defaults and note each in your lane file. Migrations: generate but apply to DEV ONLY via /migrate — prod apply is an explicit user step at wrap. <lane-specific gates>. When verified (typecheck + lint + tests green), run /wrap.

Terminal title = lane name, so the user can find it in the IDE.

## Phase 4 — WATCH (event-first, cache-warm near gates)

Match the watch mode to how the builder is tracked — the goal is context preservation, not cadence:

- **Harness-tracked builders (Agent tool / background Bash): never poll** — completion notifies you; a wakeup to check on them is pure waste.
- **External clauded terminals — two signals, layered:**
  1. **Monitor on commits (primary):** a poll-loop Monitor emitting new commit lines on the builders' branches (`git log --branches --oneline`, compare + emit diff, sleep 60). You wake exactly when work lands — the merge-train case.
  2. **ScheduleWakeup fallback (the stall-catcher):** commits are only the happy path — a blocked builder or one asking a question emits NO git event, and silence looks identical to healthy. Long fallback (1200–1800s) for well-briefed mechanical stretches; drop to **~240s cache-warm** (under the 5-min prompt-cache TTL) ONLY while a builder is near a known gate — migration approval, taste checkpoint, flagged open question — because that's when fast relay to/from the user matters. Relax back once past the gate.
- Each check renders the buffer (Claude Code is a TUI):
  ```bash
  $remade '/api/terminals/buffer?terminalId=<id>&projectPath=<repo>&render=true&mode=screen'
  ```
- **Working, healthy** → one-line status if the user's around; reschedule.
- **Asking a question / blocked** → surface to the user with your recommendation; relay their answer via `/api/terminals/input`. If the user is away and it's a runbook-covered call, tell the builder to SKIP the item and continue. Relay institutional knowledge INTO a stuck builder (send the known fix) instead of watching it rediscover a solved trap.
- **Wrapped** → verify independently before trusting it: merge on main, **pushed** (`git log origin/main..main` empty), worktree removed, no leftover lane file in `docs/status/active/`, and if a migration shipped, the migration ledger line in CURRENT-STATUS matches reality (spot-check the DB read-only). Report what shipped + every flagged decision + any deferred prod step. Then spawn the next lane — or pause for the user if it needs a decision.
- **Unmerged builder branches** (unattended runs): before merging, spawn a fresh adversarial reviewer against the branch diff — business rules vs diff, isolation, money/sensitive paths traced to the query layer. MERGE-WITH-FIXES → a new fix-agent on the same worktree with the findings as a self-contained brief (the original builder's context is gone).
- Stop all watching (omit ScheduleWakeup, TaskStop any Monitor) when no builder is running.

## Phase 5 — CLOSE (no orphan terminals)

**OWNERSHIP RULE (house rule, 2026-07-02): only ever close terminals THIS orchestrator session created. Never close any other terminal — empty, idle, or ancient — unless the user explicitly asks for that specific terminal.** Track your own terminalIds as you create them; that list is your entire closing jurisdiction.

A wrapped-and-verified builder's terminal gets CLOSED — the user must never accumulate mystery terminals from orchestration. Everything durable already lives in git (commits, folded status, archived handoff), so closing loses nothing.

- **No follow-ups from that lane** → close immediately, mention it in the wrap report ("terminal closed").
- **Follow-ups exist** (deferred prod step, flagged decision, verify-later item) → list them, ask "OK to close the terminal?", close on confirm. The follow-ups live in CURRENT-STATUS/handoffs — the terminal isn't their storage.
- **How to close:** exit the clauded session, then the shell — the session ends and RemADE drops it:
  ```bash
  $remade POST '/api/terminals/input' '{"terminalId":"<id>","projectPath":"<repo>","input":"/exit\n"}'
  # brief pause, then:
  $remade POST '/api/terminals/input' '{"terminalId":"<id>","projectPath":"<repo>","input":"exit\n"}'
  ```
  Verify with `/api/terminals/list` that it's gone; if a TUI ignores `/exit`, send `{{ctrl+c}}` twice, then `exit\n`.
- Never close a terminal that hasn't verifiably wrapped — a paused/blocked builder keeps its terminal until resolved or the user says kill it.
- **Background-agent worktrees:** after merge, `git worktree remove` + delete both the feature branch and any `worktree-agent-*` ref.

## Human-in-loop gates — NEVER automate past these

- **Prod DB writes** — only via `/migrate` with the user's explicit per-operation confirm. Builders never touch prod; briefs say so. (Dev applies are fine attended; unattended lanes generate-don't-apply.)
- **Prod ops** (hosting env vars, domains/DNS, payment dashboards, flag flips on live surfaces) — the user executes; you write exact click-by-click steps.
- **Business-rule or policy conflicts** — stop and ask (house rule). A builder that hits one should stop too; check for this in its buffer.
- **Behavior changes not pre-approved** (who gets emails, what counts as a sale, pricing, anything user-visible on a live surface) — present options + recommendation, wait.
- **Anything outward-facing** (emails to real people, publishing, external services) — confirm first.
- **Plus every project-specific gate in PROJECT.md and `docs/PROJECT-RULES.md`** — those are additive, never replacements.

## Learned rules (why this file exists)

- **Stage by explicit path, never `git add -A`** — shared-tree law; stray IDE artifacts and other sessions' files ride along otherwise.
- Builders self-wrap (merge → push → clean) per the house /wrap; **trust but verify every wrap** — a broken merge caught at the next event is cheap, caught tomorrow is not.
- Research subagents (Explore) belong in the orchestrator; build work belongs in builders. Don't invert it.
- **Worktree deps hide package changes:** a wholesale node_modules symlink resolves workspace packages to MAIN's copy — schema/type edits silently invisible to the typechecker. Lanes touching `packages/*` need real installs or per-package overrides (see PROJECT.md for this repo's exact recipe). (2026-07-02, two projects independently.)
- **drizzle-kit `generate` can't resolve renames headless** (needs a TTY) — rename migrations get hand-authored SQL + a transformed meta snapshot (2026-07-02).
- **The orchestrator's shell cwd RESETS into the notifying agent's worktree after every background-task notification** — never trust the working directory; `cd` or `git -C` explicitly on every git command, and run merges from the main checkout, never inside a worktree. (2026-07-02, bitten 3× in one day.)
- **A worktree's copied `.env.local` still points absolute localhost URLs (auth base URL, app URL, callbacks) at the main repo's port** — sign-in/API calls silently hit whatever is running there ("Load failed"). Start lane servers via `/dev`, which handles it; if hand-starting anyway, rewrite the URL env vars to the lane's real port first. (2026-07-02.)
- Every wrap that touched schema updates the **migration ledger** line in CURRENT-STATUS (dev/prod applied-through markers) — it's the cross-session source of truth; a 2026-07-02 near-miss (feature deployed before its prod migration) was caught only because the ledger made the gap visible.
- `.private/` for partnership/strategy notes — never in tracked docs, never named in commits.
- When the user says "it's too much to consider at once": one step per message, one decision per gate, you carry the plan.

## What goes in PROJECT.md (per-project companion)

Create `.claude/skills/orchestrate/PROJECT.md` with any of these sections as the project accumulates them — keep it short, it's read every orchestration:

- **Docs that win conflicts** — e.g. a PRD or business-rules doc that overrides everything else.
- **Kickoff additions** — this repo's exact worktree setup traps (env files, dep symlink exceptions, generated files to copy).
- **Extra gates** — project-specific human-in-loop lines (taste judges, stakeholder sign-offs, forbidden automations).
- **Where stakeholder-only decisions park** — if not straight to the user.
- **Project learned rules** — dated, with the incident that taught them.
