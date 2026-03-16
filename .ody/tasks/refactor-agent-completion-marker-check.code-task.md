---
status: pending
created: 2026-03-15
started: null
completed: null
---
# Task: Refactor Agent Completion Marker Check

## Description
Refactor agent completion detection so only a standalone `<woof>COMPLETE</woof>` line is treated as the completion signal, and marker-like text in normal output is ignored instead of failing the run. Keep CLI and desktop behavior aligned so coding task runs are less brittle when the model references the marker in explanations or file content.

## Background
The current completion check treats any output containing `<woof>`, `</woof>`, or the full marker inline as ambiguous and fails the run unless the exact standalone completion marker is also detected. That logic exists in `packages/cli/src/util/agentCompletion.ts` and is duplicated in `packages/desktop/src/main/agent.ts`.

This makes coding task execution fragile because prompts explicitly mention the completion marker and agents may echo or discuss it without meaning to terminate execution. The desired behavior is to preserve strict completion semantics for the standalone marker while removing failures caused by incidental marker-like output.

## Technical Requirements
1. Update completion detection so only a standalone trimmed line equal to `<woof>COMPLETE</woof>` is considered a successful completion marker.
2. Remove the failure path that treats marker-like output as ambiguous when no standalone marker is present.
3. Keep CLI and desktop completion behavior consistent, either by sharing the same detection logic or by making equivalent changes in both implementations.
4. Preserve existing non-zero exit code handling and any required-marker validation behavior that depends on a true standalone marker.
5. Update or add automated tests to cover standalone marker detection, split-across-chunks detection, and inline marker-like output being ignored.

## Dependencies
- `packages/cli/src/util/agentCompletion.ts` and `packages/cli/src/util/__tests__/agentCompletion.test.ts` - current CLI completion detection and its test coverage.
- `packages/desktop/src/main/agent.ts` - desktop runner's duplicated completion detection and post-run verification flow.
- Existing run-task prompts in `internal/builders/src/runPrompt.ts` and related prompt builders - continue relying on the standalone marker contract without changing prompt intent.

## Implementation Approach
1. Simplify the completion detector result shape and validation flow so it tracks whether a standalone marker was observed, without separately recording ambiguous marker mentions.
2. Update the CLI runner to use the simplified result when validating backend completion, keeping exit-code checks and required-marker checks intact.
3. Apply the same refactor to the desktop runner, and consider extracting shared logic only if it improves maintainability without creating unnecessary package coupling.
4. Revise the CLI unit tests and add desktop coverage if needed so marker-like inline text no longer causes a failure while true standalone markers still end the run.

## Acceptance Criteria

1. **Inline Marker Text Is Ignored**
   - Given the backend prints output such as `done <woof>COMPLETE</woof>` or discusses `<woof>` tags inline
   - When the run completes without a standalone completion-marker line
   - Then the runner does not fail because of marker ambiguity

2. **Standalone Marker Still Completes The Run**
   - Given the backend prints a line whose trimmed content is exactly `<woof>COMPLETE</woof>`
   - When completion detection runs across streamed output, including chunk boundaries
   - Then the run is recognized as complete

3. **Required Marker Validation Still Works**
   - Given a code path that requires an explicit completion marker
   - When the backend exits successfully without printing a standalone marker line
   - Then the runner fails with the existing missing-marker behavior rather than silently treating the task as complete

4. **CLI And Desktop Stay Aligned**
   - Given the same backend output is processed by both the CLI and desktop runners
   - When completion detection executes
   - Then both surfaces treat standalone markers as completion and ignore inline marker-like text

5. **Regression Coverage Exists**
   - Given the automated tests for completion detection
   - When the test suite is run
   - Then it covers standalone marker detection, chunk-split markers, and inline marker-like output being ignored

## Metadata
- **Complexity**: Medium
- **Labels**: cli, desktop, refactor, agent, tasks
