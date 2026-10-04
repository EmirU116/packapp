---
name: wait-for-merge
description: Watch a pull request in the background and continue with the next piece of work as soon as the user merges it. Use right after opening a PR in this repo, or when the user says to keep going once a PR is merged.
---

# Wait for merge

In this repo only the user merges PRs, and work that builds on a PR must wait for that merge (see "Commits and PRs" in CLAUDE.md). This skill removes the need for the user to come back and say "merged": a background watcher ends when the PR is no longer open, which re-invokes Claude.

## Steps

1. **Start the watcher** right after opening the PR. Run this with the Bash tool, `run_in_background: true` and `timeout: 7200000` (2 hours, the maximum), replacing `<N>` with the PR number:

   ```bash
   until [ "$(gh pr view <N> --json state -q .state)" != "OPEN" ]; do sleep 60; done; gh pr view <N> --json number,state,mergedAt
   ```

2. **Tell the user** the PR link, what to look at, and that work continues automatically once they merge. Then end the turn – do not poll in the foreground.

3. **When the watcher finishes**, read its output:
   - `MERGED` → `git checkout main`, `git pull`, then start the next piece of work on a new branch. Open its PR when done and start this skill again for that PR.
   - `CLOSED` (not merged) → the user rejected the PR. Stop and ask what they want changed.
   - Stopped by the 2-hour limit while still `OPEN` → start the watcher again (step 1). Do not start the dependent work.

## Rules

- A merge is the approval. Never merge the PR yourself, and never start dependent work on any other signal.
- If the user comments or asks for changes instead of merging, handle that first; the watcher keeps running.
- If there is no next piece of work, just report that the PR was merged.

## Limits

- It only works while this Claude Code session is open. If the session was closed, the user has to say that the PR is merged.
- It checks once a minute, so there can be up to a minute's delay.
