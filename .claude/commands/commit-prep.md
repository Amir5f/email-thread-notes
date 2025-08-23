---
description: Runs linting, shows status, prepares commit message
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(npm run lint:*), Bash(node:*)
---

# Commit Preparation

Comprehensive pre-commit workflow for Chrome extension development.

## What this command does:
1. Runs git status to show current changes
2. Runs git diff to show specific modifications
3. Attempts to run linting (npm run lint, if available)
4. Analyzes changes and prepares suggested commit message (**The commit message shouldn't mention Claude at all**)
5. Shows commit message for review before proceeding
6. **WAITS FOR USER APPROVAL** before creating actual commit

## Usage:
```
/commit-prep
```

The command will:
- Check for any modified files: `git status`
- Show detailed changes: `git diff`
- Run available linting commands (if npm scripts exist)
- Analyze all changes to create descriptive commit message
- Follow your claude.local.md guidelines (no Claude mentions, concise messages)
- Present commit message for approval before executing

**Important**: The commit is only created after you approve the suggested message.