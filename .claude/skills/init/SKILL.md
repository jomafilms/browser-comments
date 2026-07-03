---
name: init
description: Initialize the agent workflow system in a project: copy core skill directories and templates, add the CLAUDE.md workflow block, and interview for project rules. Run once per new project.
---

Initialize the agent workflow system in the current project.

> Note: this `/init` **deliberately overrides** the native `/init` (which just generates a CLAUDE.md). That's intentional — ours sets up the full workflow system. Not a mistake; don't "fix" it back.

Only run this if the project does NOT already have `docs/CURRENT-STATUS.md` and `.claude/skills/wrap/SKILL.md`.

> **Skill format — important.** Claude Code only discovers skills as **directories**: `.claude/skills/<name>/SKILL.md` with `name`/`description` YAML frontmatter. Flat `.claude/skills/<name>.md` files are NOT discovered (the command will error "Unknown skill"). Always copy the **whole `<name>/` directory**, never a flat file.

**Source location.** These files are copied from this skills repo. Default location:
```
SKILLS_SRC="${SKILLS_SRC:-$HOME/Projects/claude-skills}"
```
If the repo lives elsewhere, set `SKILLS_SRC` first.

## Step 1 — Copy the CORE workflow (always)

These are project-agnostic and every project gets them.

1. Create `.claude/skills/`, `docs/status/active/`, and `handoff/` if missing. (`handoff/<feature>.md` = paste-ready next-task briefs; `/wrap` writes them and archives finished ones to `handoff/done/`.)
1b. **Set up `.private/` (local-only scratch) + gitignore it.** Every project gets a gitignored `.private/` dir for private/sensitive material (pitch drafts, raw transcripts, secrets, scratch) that agents may READ for context but must NEVER commit or paste secrets from:
   ```bash
   mkdir -p .private
   for line in '.private/' '.DS_Store'; do
     grep -qxF "$line" .gitignore 2>/dev/null || printf '%s\n' "$line" >> .gitignore
   done
   ```
2. Copy **only the core allowlist** below. **🚫 NEVER `cp -R` the whole `$SKILLS_SRC/.claude/skills/` folder** — it also holds optional and personal/project-specific skills (`reports/` = joma revenue SQL, `tix/`, `meetings/`, `migrate/`, `ci/`) that must NOT land in an unrelated project. Copy the exact list, nothing else:
   ```bash
   for s in wrap update check dev project-status sync-skills; do
     cp -R "$SKILLS_SRC/.claude/skills/$s" .claude/skills/
   done
   ```
   (`wrap` = finish line, `update` = its alias, `check` = quality gate, `dev` = lane dev server, `project-status` = milestone snapshot, `sync-skills` = pull later shared-skill updates. Each is a `<name>/SKILL.md` directory.)
3. Copy templates:
   - `$SKILLS_SRC/templates/CURRENT-STATUS.md` → `docs/CURRENT-STATUS.md`
   - `$SKILLS_SRC/templates/PROJECT-RULES.md` → `docs/PROJECT-RULES.md`
   - `$SKILLS_SRC/templates/SESSION-LANE.md` → `docs/status/active/` (reference format; or leave the README there)
   - `$SKILLS_SRC/templates/HANDOFF.md` → `handoff/` (reference format for next-task briefs)
4. Workflow block into `.claude/CLAUDE.md`:
   - If it exists, **prepend** the workflow section from `$SKILLS_SRC/templates/CLAUDE-WORKFLOW.md` to the top.
   - If not, copy the full `CLAUDE-WORKFLOW.md` as `.claude/CLAUDE.md`.

## Step 2 — ASK before copying OPTIONAL skills

Do NOT copy these by default — most projects don't need them, and several are personal / account-specific. **Ask the user which (if any) to include**, then copy only those. Default to none.

| Optional skill | Include when… | Note |
|---|---|---|
| `tix/` | the project has a deployed site with the browser-comments feedback widget | needs a per-project `BROWSER_COMMENTS_TOKEN` |
| `reports/` | the project has a custom reporting/reconciliation layer | **joma-revenue-specific — almost never copied.** Rewrite per project; don't install as-is into another project |
| `meetings/` | this machine runs the personal Granola → meeting-notes pipeline | account-specific; skip for shared/handoff projects |
| `ci/` | the project runs typecheck/lint/tests in CI | universal baseline (lazy clients, pre-commit=CI parity, blank-DB migrations); has an opt-in real-DB-in-CI section. Skip for simple/no-CI projects |
| `migrate/` | the project has a DB with separate dev + prod databases | launch-gated dev/prod migrations: sync in pre-launch, rollback-snapshot + confirm post-launch. Needs a `**Launch:**` line in CURRENT-STATUS. Skip for single-DB or DB-less projects |
| `orchestrate/` | the project runs multi-lane parallel builds (strategy session driving several builder sessions/worktrees at once) | generic SKILL.md + optional per-project `orchestrate/PROJECT.md` companion for project-specific gates/traps (`/sync-skills` refreshes only SKILL.md, so PROJECT.md survives). Skip for small single-session projects |

> Adding a new optional skill in the future? List it here with its "include when" trigger so `/init` keeps asking instead of copying blindly. Anything project-agnostic goes in Step 1 (core); anything project- or account-specific goes here.

**✅ Verify after copying (self-correct a too-broad copy):** run `ls .claude/skills/` — it must contain **only** the 6 core skills plus any optional the user explicitly approved. If anything else slipped in (e.g. `reports/`, `tix/`, `migrate/`, `meetings/`, `ci/` that weren't requested), a bulk copy grabbed too much — **delete the extras now.**

## Step 3 — Interview for project rules (do NOT skip)

Don't hand the user a blank PROJECT-RULES.md — conduct a short interview and write the answers in:

1. "What does this project do?" → 1–2 sentence summary
2. "What are the 3–5 most important business rules?" → each as a rule with **why** + **edge cases**
3. "What tech stack and key libraries?" → technical constraints
4. "What should agents never do in this project?" → guardrails
5. "Any reference docs I should always read?" → add to Tier 1 references

Write directly into `docs/PROJECT-RULES.md` and fill the project name in `docs/CURRENT-STATUS.md`.

## Step 3.5 — Tech currency setup (do for any post-cutoff stack)

New projects often use framework/platform versions newer than the model's training cutoff, which causes future sessions to "correct" current code back to stale patterns. Set up the knowledge guardrails so that doesn't happen:

1. **Fill the "⚠️ Tech Stack & Currency" block** in `.claude/CLAUDE.md` (from the template): pin the current versions, and list the specific things training gets wrong (APIs that changed, things you evaluated and rejected). Ask the user what bit them or what's newer than ~your cutoff.
2. **Vendor `llms.txt` where available** → `docs/reference/llms/<vendor>.llms.txt`. Many vendors (Cloudflare, Better Auth, etc.) publish an AI-readable `llms.txt`; save it locally (greppable, version-pinned, no network).
3. **Add a docs MCP only where a vendor killed static docs** (e.g. Astro replaced `llms.txt` with `https://mcp.docs.astro.build/mcp`). Put it in a repo-root `.mcp.json` so it travels with the project. Don't add MCPs that aren't needed — guardrails + vendored docs cover most cases.
4. **Record the "why" to memory** — the stack decision and the currency facts, so they survive without the repo open.

## Step 4 — Finalize

Commit the new files: "Initialize agent workflow system".
