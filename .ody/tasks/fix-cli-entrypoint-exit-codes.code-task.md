---
status: completed
created: 2026-03-06
started: 2026-03-06
completed: 2026-03-06
---
# Task: Fix CLI Entrypoint to Preserve Failure Exit Codes

## Description
The CLI entrypoint currently logs top-level errors and then always exits with status code `0`, which causes failed commands to appear successful to shells, scripts, and CI. Update the entrypoint so successful runs still exit cleanly, but setup failures, command parsing errors, and uncaught runtime errors preserve a non-zero exit status.

## Background
`packages/cli/src/index.ts` wraps `runMain(ody)` in a `try/catch/finally` block. The `catch` logs the error, but the unconditional `process.exit()` in `finally` overwrites the process status and exits successfully even after failure. This is especially problematic for automation, because commands like `ody run`, `ody plan`, or invalid argument invocations can fail while still returning exit code `0`.

The individual command modules often call `process.exit(1)` directly for fatal validation errors, but the top-level entrypoint should still behave correctly for any error propagated through `runMain()`, including parsing and setup failures.

## Technical Requirements
1. `packages/cli/src/index.ts` must return exit code `0` on successful command completion
2. If `runMain(ody)` throws, the CLI must log the error and exit with a non-zero status
3. The entrypoint must not unconditionally override an existing failure status in a `finally` block
4. Config-load failures from `setup()` must continue to terminate the process as failures
5. The fix must not change command registration or lazy subcommand loading behavior

## Dependencies
- `packages/cli/src/index.ts` — top-level CLI bootstrap and error handling
- `citty` `runMain()` behavior — upstream command execution path used by all CLI subcommands
- Existing command modules that call `process.exit()` directly for fatal validation

## Implementation Approach
1. Remove the unconditional `process.exit()` from the `finally` block in `packages/cli/src/index.ts`
2. Replace it with explicit success and failure exit handling, or allow Node/Bun to exit naturally on success while setting `process.exitCode = 1` on failure
3. Keep the current error logging behavior, but ensure thrown errors from `runMain()` are reflected in the process status
4. Verify that no command path is left hanging due to open handles after removing the unconditional exit
5. Add or update tests if the CLI package already has a practical place to assert exit-code behavior around the entrypoint

## Acceptance Criteria

1. **Top-level failures return non-zero**
   - Given `runMain(ody)` throws during command execution
   - When the CLI exits
   - Then the process exit status is non-zero

2. **Successful runs still return zero**
   - Given a command completes successfully
   - When the CLI exits
   - Then the process exit status is `0`

3. **Setup failures are preserved**
   - Given config loading fails in the top-level `setup()` hook
   - When the CLI exits
   - Then the process exit status is non-zero

4. **No unconditional success override remains**
   - Given `packages/cli/src/index.ts`
   - When inspecting the top-level error handling
   - Then there is no unconditional `process.exit()` in a `finally` block that forces success

## Metadata
- **Complexity**: Low
- **Labels**: cli, bug-fix, process-control
