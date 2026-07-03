---
name: project-status
description: Create a timestamped status snapshot and reset CURRENT-STATUS.md for the next phase. Use on significant phase or milestone completions.
---

Create a timestamped status snapshot and update the living status doc.

## 1. Create snapshot

Create new file: `docs/status/YYYYMMDD-HHMM-description.md`
Use today's date and a short description of what phase/work this captures.

Copy the current content of `docs/CURRENT-STATUS.md` as the base, then add:
- Summary of what was accomplished in this phase
- Key technical decisions made
- Any issues discovered
- Checklist of what carries forward to next phase

## 2. Sweep active lanes

Check `docs/status/active/`. For any lane file left behind by a crashed or abandoned session, fold its still-relevant content into the snapshot/CURRENT-STATUS.md, then delete it. The `active/` dir should be empty (or only hold genuinely-running sessions) after a phase reset.

## 3. Update CURRENT-STATUS.md

Reset "What Was Last Done" to reflect only the most recent completed work.
Update "What's In Progress" and "What's Next" for the upcoming phase.
Update commit hash and date.

## 4. Review previous snapshot

Read the most recent previous snapshot in `docs/status/`.
Verify nothing was lost — carry forward any unresolved items.

## 5. Commit

Stage the snapshot + updated CURRENT-STATUS.md (and any swept lane deletions) together.
