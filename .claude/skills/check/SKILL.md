---
name: check
description: Pre-handoff quality gate: always checks the diff against business rules, and auto-decides whether to also run /code-review and /security-review. Use before /wrap, or standalone to vet a change.
---

The pre-handoff quality gate. Run before `/wrap` (it's also invoked automatically by `/wrap`), or standalone any time you want to vet a change. **It decides how deep to go** — you don't have to.

## Always does (cheap, every time)

1. Read the diff: `git diff` and `git diff --cached`.
2. Read `docs/PROJECT-RULES.md` (and any rules doc it points to). Check the change against every business rule. Flag conflicts. **This is the part native reviewers can't do — it's the main reason this gate exists.**
3. Quick self-check: DRY? Hardcoded values? Any file >300 lines? Testable?

## Conditionally adds (decide from the diff, and say what you decided)

- **Touches money, auth/security, or a high-risk area** → also run native `/security-review` AND native `/code-review`.
- **New file, or large change (>100 lines / >3 files)** → also run native `/code-review`.
- **Small, low-risk, rules-only change** → the business-rule pass is enough. Skip the heavy scans and say so.

State explicitly what you ran and why. Don't run heavy scans on a one-line copy tweak; never skip them on a payments or auth change.

## Output

- **PASS** (with any minor notes) → proceed to `/wrap`.
- **FAIL** (specific issues) → fix, re-verify, re-run `/check`.
- **Business-rule conflict** → STOP and ask the project owner. Don't assume the code or the rule is the correct one.

## Relation to native skills (so names stay clear)

- `/code-review` (native) — the bug/cleanup engine. `/check` calls it when warranted; you can also run it directly for a deep pass.
- `/security-review` (native) — security pass. `/check` calls it when security is touched.
- `/review` (native) — reviews a GitHub **PR**. Different tool, not part of this cycle. (We deliberately did NOT name this skill `/review` to avoid shadowing it.)
