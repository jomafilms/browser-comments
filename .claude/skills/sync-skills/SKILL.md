---
name: sync-skills
description: Update this project's .claude/skills from the shared claude-skills repo — refresh installed skills to the latest version, report what changed, never add new or overwrite project-specific ones. Use to pull shared workflow improvements.
---

Pull the latest version of this project's **installed** skills from the shared `claude-skills` repo, so shared improvements propagate without hand-copying to every project.

**Source:** `SKILLS_SRC="${SKILLS_SRC:-$HOME/Projects/claude-skills}"` (set it first if the repo lives elsewhere).

## Rules (what keeps this safe)
- **Refreshes only skills already installed here** — never *adds* new ones (that's `/init`'s core-vs-optional job) and never grabs personal/irrelevant skills like `reports/`.
- **Never overwrites `reports/`** (project-specific SQL) or any skill not present in the shared repo.
- **Never commits for you** — it stages nothing; you review `git diff` and commit (or fold into `/wrap`).

## Steps

1. **Update the shared repo first:**
   ```bash
   SKILLS_SRC="${SKILLS_SRC:-$HOME/Projects/claude-skills}"
   git -C "$SKILLS_SRC" pull --ff-only
   ```
2. **Refresh each installed skill that changed:**
   ```bash
   for d in .claude/skills/*/; do
     name=$(basename "$d")
     src="$SKILLS_SRC/.claude/skills/$name/SKILL.md"
     [ -f "$src" ] || { echo "local-only   $name (not in shared — left alone)"; continue; }
     [ "$name" = "reports" ] && { echo "skip         $name (project-specific)"; continue; }
     if diff -q "$src" "$d/SKILL.md" >/dev/null 2>&1; then
       echo "unchanged    $name"
     else
       cp "$src" "$d/SKILL.md"; echo "UPDATED      $name"
     fi
   done
   ```
3. **List shared skills not installed here** (FYI only — add one via `/init`'s optional step if you actually want it; don't bulk-add):
   ```bash
   for s in "$SKILLS_SRC"/.claude/skills/*/; do n=$(basename "$s"); [ -d ".claude/skills/$n" ] || echo "available    $n (not installed)"; done
   ```
4. **Report + review:** print the summary from steps 2–3, then `git diff .claude/skills/` so the user sees what changed. Commit with the next `/wrap` or a quick `git commit`.

## Notes
- **Only `SKILL.md` is refreshed — companion files in a skill dir survive syncs.** That's the supported place for per-project customization: e.g. `orchestrate/PROJECT.md` holds a project's own gates/traps while `orchestrate/SKILL.md` stays shared. Put project specifics in a companion file, never in SKILL.md.
- If you intentionally hand-customized a **core** skill's SKILL.md in this project, this will overwrite it (it differs from shared) — that's why step 4 shows the diff so you can catch and restore it. Better practice: lift the improvement into the shared repo, or move the project-specific part into a companion file.
- Run this whenever the shared repo has skill updates you want, or periodically to stay current.
