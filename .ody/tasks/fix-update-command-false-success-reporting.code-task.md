---
status: completed
created: 2026-03-06
started: 2026-03-06
completed: 2026-03-06
---
# Task: Fix `ody update` Reporting Success After Failed Install Attempts

## Description
The `ody update` command currently logs an installation failure but then continues into the success path, printing `Updated to ...` and `Update complete` even when the update did not succeed. Fix the command flow so a failed install produces a clear failure result and a non-zero process status without emitting contradictory success messages.

## Background
In `packages/cli/src/cmd/update.ts`, the command wraps `Installation.update()` in `.catch((err) => err)` and stores the result in `err`. If an error is present, it logs the failure, but there is no `return` or `process.exit(1)` afterward. Execution falls through to the success spinner stop and success outro.

This makes the CLI output misleading for both humans and automation. Combined with the separate entrypoint exit-code issue, a failed update can look fully successful.

## Technical Requirements
1. If `Installation.update()` fails, `ody update` must not print any success messaging
2. A failed install attempt must exit with a non-zero status
3. The spinner state should end in a failure message, not a success message
4. The `--check` path must remain unchanged and should continue to avoid installation
5. Successful updates must still print the version transition and completion outro

## Dependencies
- `packages/cli/src/cmd/update.ts` — command flow and user-facing messaging
- `packages/cli/src/lib/installation.ts` — throws when install/update fails
- Top-level CLI exit handling in `packages/cli/src/index.ts`

## Implementation Approach
1. Refactor the update install branch in `packages/cli/src/cmd/update.ts` to use normal `try/catch` flow instead of storing an error object and falling through
2. On failure, stop the spinner with a failure label, log the error, and terminate the command as failed
3. Ensure the success spinner stop and outro only run after a confirmed successful install
4. Keep the current `--check` behavior and no-update behavior intact
5. Add or update tests around the update command flow if there is an existing test pattern for command modules

## Acceptance Criteria

1. **Failed install does not print success**
   - Given `Installation.update()` throws
   - When `ody update` runs
   - Then the output includes failure messaging and does not include `Updated to` or `Update complete`

2. **Failed install returns non-zero**
   - Given `Installation.update()` throws
   - When the command exits
   - Then the exit status is non-zero

3. **Successful update still reports completion**
   - Given `Installation.update()` succeeds and a newer release exists
   - When `ody update` runs
   - Then it prints the version transition and a successful completion message

4. **Check-only path is unchanged**
   - Given the user runs `ody update --check`
   - When a new version exists
   - Then the command reports the available version without attempting installation

## Metadata
- **Complexity**: Low
- **Labels**: cli, update, bug-fix
