---
description: Update todos.md and PRD automatically with user review
allowed-tools: Read, Edit, Bash(git status:*), Bash(git diff:*)
---

# Update Documentation

Updates todos.md and email_thread_notes_prd.md to reflect current project state.

## What this command does:
1. Reviews git status and recent changes
2. Analyzes current codebase state
3. Proposes updates to todos.md with completed tasks and new priorities
4. Proposes updates to PRD with current feature status and version info
5. **WAITS FOR USER APPROVAL** before applying any changes
6. Only applies changes after explicit user confirmation

## Usage:
```
/update-docs
```

The command will automatically:
- Mark completed features in todos.md (pending approval)
- Update version numbers and progress percentages (pending approval)
- Sync feature status between todos and PRD (pending approval)
- Add any new discovered tasks or requirements (pending approval)

**Important**: All proposed changes will be shown for review before being applied to the files.