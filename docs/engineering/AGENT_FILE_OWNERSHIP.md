# Concurrent agent file ownership

**Rule:** One active writer per file at a time. A separate Git worktree prevents accidental working-tree overwrites, **not** merge conflicts or duplicate work.

## Before editing

1. Fetch `origin/main`; create a dedicated branch/worktree. Do not edit a teammate's worktree or dirty/untracked files.
2. Announce the assigned agent, branch/worktree, exact paths or glob scope, and intended changes in the task/PR. **An ownership claim requires explicit coordination**; branch names and old worktrees do not prove someone is actively working.
3. Check `git worktree list`, `git status --short` in relevant worktrees, and open PRs/recent commits. Look for edits or pending work touching those paths. Ask the coordinator/owner when uncertain, **before** modifying overlapping files.
4. If another agent owns or is editing a file, **do not edit it**, even in a different branch. Write an integration note/proposed patch for its owner, or request an explicit handoff. Read-only review and tests remain allowed.

## During work

- Limit changes to the agreed files. For critical shared files (especially `frontend/src/app/AuthedApp.tsx`, app router/navigation, `shared/`, feature `index.ts`, API contracts and architecture scripts), assign **one named writer** before editing.
- Ownership of a directory does not override an explicit file assignment. An emergency fix needs coordinator approval and notification to the existing owner.
- Do not force-push, reset another worktree, silently cherry-pick a colleague's unfinished work, or use mass formatting on unowned files.
- Notify the coordinator when the planned diff expands to other files. Suspend the overlapping part until ownership is settled.

## Before PR and merge

1. Fetch `origin/main` again, compare `git diff --name-only origin/main...HEAD` with the ownership agreement, and re-check conflicting worktrees/PRs.
2. Update the branch from `origin/main` only in its own worktree; resolve conflicts by understanding both implementations, not blindly choosing ours/theirs.
3. Test the **integrated result** (lint, architecture, unit tests, build, relevant manual QA). State skipped checks honestly.
4. Push for review; **never self-merge**. Release ownership only once handoff is acknowledged or work is merged/abandoned.

## Handoff template

```
Agent:
Branch/worktree:
Owned paths:
Changes in progress:
Files required outside ownership (do not edit):
Tests/risks:
Handoff to:
```

**Limitations:** This is a coordination rule, not an automatic cross-process lock. Existing running agents must read the updated policy or receive the assignment explicitly; GitHub branch protection and CI cannot prevent every semantic conflict.
