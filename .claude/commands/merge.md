# merge to production branch

## Step 1: Ensure main is clean (requires approval if changes exist)
- Check git status on main branch
- IF there are uncommitted changes:
  - Show the changes
  - Write descriptive commit message
  - Stage, commit, and push to main
  - **WAIT FOR USER APPROVAL** before executing
- IF main is clean:
  - Skip to Step 2 automatically

## Step 2: Merge to production (single approval for all operations)
- Checkout production branch
- Merge main into production
- Push to origin/production
- Checkout main branch
- **Execute all as single batch after approval**

## Summary
- Maximum 2 approvals needed:
  1. Only if uncommitted changes exist on main
  2. Always for the merge to production operation
- All production operations (checkout, merge, push, return) happen in one go