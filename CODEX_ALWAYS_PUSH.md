# CODEX ALWAYS PUSH RULE

For every Codex task on this repository:

1. Make the requested code or documentation changes.
2. Run the available checks when the environment allows.
3. Save the work to Git.
4. Push the work to GitHub before replying.
5. Report the commit SHA and branch.

Use this ending sequence after every completed task:

```bash
git status
git add -A
git commit -m "<clear task-specific commit message>"
git push
git status
```

If no files changed, report `No files changed` and do not create an empty commit unless explicitly requested.

If tests cannot run because npm or node is unavailable, do not stop coding. Finish the requested work, commit it, push it, and report the exact test limitation.

Final response must always include:

- Files changed
- Real behavior added
- Tests/checks run
- Safety gates preserved
- Setup still required
- Exact limitations
- Commit SHA
- Branch pushed
- Whether git status is clean after push

This rule exists to preserve progress and save limited Codex messages. Do not ask whether to push after a completed task. Push by default.
