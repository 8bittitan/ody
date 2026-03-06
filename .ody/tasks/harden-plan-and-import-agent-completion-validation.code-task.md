---
status: completed
created: 2026-03-06
started: 2026-03-06
completed: 2026-03-06
---
# Task: Harden `plan` and `task import` Completion Validation

## Description
The `plan` and `task import` commands currently treat detection of `<woof>COMPLETE</woof>` as sufficient success, even though they kill the backend process immediately afterward and do not validate the final exit status or stream-processing outcome. Tighten these flows so they only report success when the command finished in a verifiably healthy way and so ambiguous or partial completion markers do not produce false positives.

## Background
`packages/cli/src/cmd/plan.ts` and `packages/cli/src/cmd/task/import.ts` both stream backend output through `Stream.toOutput()`, watch for the completion marker, call `proc.kill()` as soon as they see it, await `Promise.allSettled(...)`, and then ignore the process exit code. This means:

- stream reader failures are swallowed by `Promise.allSettled`
- marker-like output can be interpreted as success without strict validation
- killing the process can mask whether the backend truly completed the full work
- the commands may report success even if the backend failed after or around marker emission

`packages/cli/src/cmd/run.ts` already has stricter post-run validation logic, so the CLI has an internal precedent for the level of rigor needed here.

## Technical Requirements
1. `plan` batch generation, interactive plan generation, and `task import` generation must not report success solely because a marker substring appeared
2. Stream-processing failures from stdout or stderr must surface as command failures rather than being discarded via `Promise.allSettled`
3. Process exit codes must be validated, with explicit handling for the intentional termination path if the implementation still kills the backend after confirmed completion
4. Marker detection should be made strict enough to avoid ambiguous marker-like output being interpreted as success
5. The user-facing success messages (`Task plans generated...`, `Task imported...`) must only occur after validation passes

## Dependencies
- `packages/cli/src/cmd/plan.ts` — batch and interactive plan generation paths
- `packages/cli/src/cmd/task/import.ts` — agent-driven import flow
- `packages/cli/src/cmd/run.ts` — reference implementation for stricter marker validation
- `packages/cli/src/util/stream.ts` — streaming helper used by all three commands

## Implementation Approach
1. Extract or align completion-marker detection logic so `plan` and `task import` follow the stricter line-based validation pattern already used by `run`
2. Replace `Promise.allSettled` with failure-propagating awaiting unless there is a strong reason to preserve partial results
3. Decide whether to keep the current `proc.kill()` behavior:
   - If retained, explicitly treat the resulting exit condition as expected only after a validated completion marker
   - If removed, wait for natural process exit and validate the exit code directly
4. Gate all success spinner stops and outros behind validated process completion
5. Add tests around marker parsing and failure handling, especially for partial markers, ambiguous mentions, and non-zero exits

## Acceptance Criteria

1. **Stream failures fail the command**
   - Given stdout or stderr streaming throws while the backend is running
   - When `ody plan` or `ody task import` exits
   - Then the command reports failure and exits non-zero

2. **Ambiguous markers do not count as success**
   - Given the backend outputs marker-like text without a valid standalone completion marker
   - When `ody plan` or `ody task import` runs
   - Then the command does not report success

3. **Exit status is validated**
   - Given the backend exits unexpectedly or with a non-zero code
   - When `ody plan` or `ody task import` runs
   - Then the command reports failure and exits non-zero

4. **Success messages only appear after validation**
   - Given the backend completes successfully
   - When the command finishes
   - Then the spinner and outro report success only after completion validation passes

## Metadata
- **Complexity**: Medium
- **Labels**: cli, reliability, agent-runner
