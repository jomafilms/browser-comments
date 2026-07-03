---
name: wrap
description: The finish line for a task: runs /check, writes docs, folds and deletes your lane, commits, merges to main, removes the worktree, pushes, and hands off. Use when a task is done and ready to ship.
---

The single finish-line command. One verb to end a task cleanly: **gate → docs → commit → merge → cleanup → push → handoff.** (You can also say `/update` — it's an alias for this.)

## Step 0: Preconditions (do this first, every wrap)

1. **Scaffold the handoff dirs now** so the later steps can't silently no-op:
   ```
   mkdir -p handoff handoff/done docs/status/active
   ```
2. **Isolation check.** If another session's lane (`docs/status/active/*.md` not yours) or uncommitted work is present in this **shared working tree**, you are NOT isolated. Do not `git add -A` and do not commit broadly — you will sweep their work. Stage only your files by explicit path (Steps 3–4). For real parallelism, work should have started in a worktree (see the concurrency rules in CLAUDE.md); if it didn't, proceed by-path and flag it in the handoff.

## Step 1: Gate — run `/check`

Run `/check`. It decides how deep (always business rules; adds `/code-review` and `/security-review` when the change warrants).
- **PASS** → continue.
- **FAIL** → fix, re-verify, re-run `/check` before wrapping.
- **Business-rule conflict** → STOP and ask the project owner.

## Step 2: Update docs (the checked wrap-write)

`docs/CURRENT-STATUS.md` is the single source of truth. Write it carefully so a concurrent session's update is never clobbered:

1. **Re-read `docs/CURRENT-STATUS.md` fresh right now** — another session may have changed it since you started. Work from the latest version.
2. Move **only your own** completed work from "What's In Progress" to "What Was Last Done". Leave other sessions' lines untouched.
3. Update "Known Issues / Blockers" and "Open Decisions" as needed. For **next tasks**, use **handoff files** — keep the depth out of CURRENT-STATUS so it stays a lean index:
   - **Write `handoff/<feature>.md`** for each non-trivial next task, from `templates/HANDOFF.md` (Mode · Goal · Why/problem · Settled-don't-relitigate · Read & trace · Do · Done-when · Open questions · Constraints · Lane). Self-contained + paste-ready (dir already made in Step 0). **This is not optional: if "What's Next" gains any item that is more than a one-line tweak, the wrap is NOT complete until its `handoff/<feature>.md` exists.** Only a genuinely trivial follow-up may stay a one-liner with no file — and say so explicitly. Don't defer the write to "later"; later never comes (this is why `handoff/` sat empty for months).
   - In CURRENT-STATUS **"What's Next", leave a one-line pointer** per task: `- <feature> [Mode] → handoff/<feature>.md`.
   - **Archive a finished handoff:** if this wrap completed a task that had a `handoff/<feature>.md`, `mkdir -p handoff/done && git mv handoff/<feature>.md handoff/done/<YYYY-MM-DD>-<feature>.md` (this is the shipped-feature log) and move its What's-Next pointer into "What Was Last Done".
4. Update the "Last Updated" date and "Last Commit" hash.
5. **Fold in your lane:** copy anything still relevant from `docs/status/active/<your-lane>.md` into CURRENT-STATUS.md, then **delete your lane file** (`git rm docs/status/active/<your-lane>.md`).
6. If git reports CURRENT-STATUS.md changed under you while writing, re-read and re-apply — never force-overwrite.

## Step 3: Commit together — stage BY PATH only

Stage BOTH your code files AND the updated CURRENT-STATUS.md (and the lane deletion) in one commit. Never commit code without updating the status doc.

> **🚫 Hard rule: never `git add -A` or `git add -u`.** In a shared tree they sweep up another session's partial work and the protected WIP pile, and `-u` will commit a file that imports a *new untracked module* without committing the module — exactly the failure that has broken production builds. **Stage every file explicitly by path:**
> ```
> git add apps/web/app/foo.tsx lib/foo.ts docs/CURRENT-STATUS.md
> git rm docs/status/active/<your-lane>.md
> ```
> If you created a new module, it's untracked — `-u` ignores it. By-path staging is the only way to keep an import and its new module in the same commit.

**Consistency gate (before you commit/push):** run `npx tsc --noEmit` (or the project build). Every import in your staged files must resolve to a file that is *also committed or staged*. If a staged file imports a brand-new module, stage that module too. This catches the orphaned-module class that fails the deploy after push.

## Step 4: Merge to main + self-cleanup (parallel sessions)

**If you are on a feature branch / worktree**, merge back to main automatically so no branch is left hanging:
```
git add <your files by path> docs/CURRENT-STATUS.md && git commit -m "<msg>"   # never -A / -u (Step 3)
git checkout main && git pull --ff-only
git merge --no-ff <lane> -m "merge <lane>"
git push
git branch -d <lane>
git worktree remove --force ../<repo>-<lane>   # --force: worktree holds untracked .env.local + node_modules
```
Removing the worktree deletes its folder. If `node_modules` was **symlinked** (the default — see CLAUDE.md), only the link goes; main's copy is untouched. If it was a real `npm install`, that copy is deleted with the folder. Either way nothing accumulates.
If the merge conflicts on CURRENT-STATUS.md, keep BOTH sessions' status lines (append-style). For code conflicts, follow the project's normal resolution. A solo session on `main` just commits and pushes — no merge step.

## Step 5: Stop your lane's dev server

If this lane was running its own dev server on a lane-specific port (see the localhost notes in CLAUDE.md), stop it before the worktree is removed.

## Step 6: Handoff — end with copy-paste blocks for the next session(s)

**Gate:** before printing anything, confirm Step 2.3 actually ran — every non-trivial "What's Next" item has a matching `handoff/<feature>.md` on disk. If one is missing, write it now. The wrap is not done without it.

End every wrap with **two clearly separated parts** so nothing is muddled — the #1 failure is mixing "what I did" with "what you should do," leaving the next agent unsure which is which.

**A. For the user (what just happened)** — 1–2 sentences, past tense: what shipped, anything flagged/decided. This is for the human, not the next agent.

**B. HANDOFF — for each next task you also wrote a `handoff/<feature>.md` (Step 2.3).** End by telling the user how to start the next session(s): give the **`@handoff/<feature>.md`** reference (the user pastes that into a fresh chat + any notes), AND print the short block below so they can copy text instead if they prefer. Either way the block is addressed TO the next agent, "you", **no retrospective mixed in** — one per task/lane, each in its own fenced code block:

```
HANDOFF — <short task title>
Mode: <build | design/investigate — NO build yet | fix | research>
Goal: <one line — the outcome to achieve>
Read first: docs/CURRENT-STATUS.md → "<the What's Next entry>" (full breadcrumbs), then <1–3 key docs/memories>
Do: <2–4 concrete first steps>
Done when: <crisp definition of done>
Lane: <lane-name> · <"parallel-safe" | "solo" | "after <other lane> merges"> · <hard "don't", e.g. don't touch the WIP pile>
```

**Mode is load-bearing** — it stops an agent from building on a design/investigation task. Keep the block short: the depth (problem, settled context, files-to-trace, open questions) lives in **`handoff/<feature>.md`**, so whoever picks it up — via `@handoff/...` or a fresh read of `handoff/` — gets the full brief. When the next agent starts from a handoff and finishes, its `/wrap` archives that file to `handoff/done/` (Step 2.3).

**If there are multiple independent next steps**, emit one HANDOFF block per step, and prefix them with a one-line recommendation on **how many sessions to open and which can run in parallel** vs must be sequenced — based on whether they touch the same files:
> e.g. "Open 2 sessions — content-model and styling are parallel-safe (separate files); the auth refactor should wait until the content-model lane merges (shared types)."

Keep each block short. The next agent should be able to act from the block alone (plus the docs it points to) without re-reading this session.

## Significant phase completion → also run `/project-status`

Snapshot to `docs/status/YYYYMMDD-HHMM-description.md` and reset CURRENT-STATUS.md for the next phase.
