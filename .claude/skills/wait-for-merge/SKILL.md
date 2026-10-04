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
   - Stopped by the 2-hour limit while still `OPEN` → do **not** restart it. Say in one line that the watcher stopped and that the user should say when the PR is merged. Restarting would wake Claude every 2 hours for nothing, which wastes tokens.

## Rules

- A merge is the approval. Never merge the PR yourself, and never start dependent work on any other signal.
- If the user comments or asks for changes instead of merging, handle that first; the watcher keeps running.
- Start the watcher for **every** PR, including the last one of a plan. Never skip it because no next step is planned.
- If there is no planned next piece of work when the PR is merged: update `main`, say the PR is merged, and propose the next tasks for the user to choose from (known gaps, feedback from the PR). Do not invent work and start it unasked.

## Limits

- It only works while this Claude Code session is open. If the session was closed, the user has to say that the PR is merged.
- It checks once a minute, so there can be up to a minute's delay.
- It watches for 2 hours. After that the user has to say that the PR is merged.

## Token cost

Waiting is a shell loop and uses no tokens. Tokens are spent only when the watcher ends and Claude is woken: once per PR.
