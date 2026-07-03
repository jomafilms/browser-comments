---
name: meetings
description: Check for new Granola meeting notes relevant to this project and offer to integrate action items. Use at session start or when a recent meeting is mentioned.
---

Check for new meeting notes and actionable items from the shared skills repo.

Meeting notes are processed by a separate agent (Buggy) from Granola transcripts and placed in `~/Projects/claude-skills/meetings/`. Each project folder contains distilled, coding-relevant specs and tasks.

## Steps

1. **Find relevant meeting folders.** Check `~/Projects/claude-skills/meetings/` for folders matching the current project name or context. Read the folder names and any README/index files to find matches.

2. **Read new notes.** For each relevant folder, read all `.md` files. Look for:
   - Action items tagged for this project
   - Customer feedback that affects features or bugs
   - Design decisions or requirement changes
   - Priority shifts or deadline changes

3. **Summarize to the user.** Present what was found:
   - "I found 3 new meeting notes relevant to this project:"
   - List each with a 1-line summary
   - Highlight any action items that conflict with current CURRENT-STATUS.md priorities

4. **Offer to integrate.** Ask the user:
   - "Should I add these action items to CURRENT-STATUS.md?"
   - "Any of these change the business rules in PROJECT-RULES.md?"
   - "Should I create tasks for any of these?"

5. **Update docs if approved.** Add new items to "What's Next" in CURRENT-STATUS.md. If business rules changed, update PROJECT-RULES.md and flag for review.

6. **Mark as processed.** Create a `.processed` file or add a note in the meeting folder so the next agent doesn't re-process the same notes.

## When to use
- At the start of a new session (after reading CURRENT-STATUS.md)
- When Annie says "check meetings" or "any new notes?"
- After a known meeting happened
