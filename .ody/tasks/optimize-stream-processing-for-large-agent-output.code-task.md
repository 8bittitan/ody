---
status: completed
created: 2026-02-19
started: 2026-02-19
completed: 2026-02-19
---
# Task: Optimize Stream Processing for Large Agent Output

## Description
Reduce CPU and memory overhead in stream handling paths used by `run`, `plan`, and `task import` so long-running agent sessions remain responsive and do not degrade as output grows.

## Background
`packages/cli/src/util/stream.ts` currently concatenates full output (`output += raw`) and invokes callbacks with the entire accumulated buffer on every chunk. For long outputs this causes repeated O(n) string growth and callback work, increasing memory pressure and total processing time. The marker detection logic in `packages/cli/src/cmd/run.ts` already supports incremental processing, so the stream utility can be redesigned to avoid full-buffer accumulation by default.

## Technical Requirements
1. Refactor `Stream.toOutput` in `packages/cli/src/util/stream.ts` to process incoming data incrementally, without requiring full accumulated string concatenation for each chunk.
2. Update callback contracts so marker detection and similar consumers can operate on new chunk/line data rather than full output snapshots.
3. Preserve existing behavior for verbose output printing (`shouldPrint`) and UTF-8 decoding.
4. Keep compatibility for call sites that still need full captured output by offering an explicit opt-in capture mode.
5. Ensure stream consumption remains correct for partial multi-byte sequences and line fragments spanning chunk boundaries.
6. Update all current `Stream.toOutput` call sites (`run`, `plan`, `task import`, `task edit`) to the new API.
7. Add/adjust unit tests in `packages/cli/src/util/__tests__/stream.test.ts` to cover incremental callback semantics and capture-mode behavior.

## Dependencies
- `packages/cli/src/util/stream.ts` -- core stream utility to refactor.
- `packages/cli/src/cmd/run.ts` -- completion marker detection consumer.
- `packages/cli/src/cmd/plan.ts` -- stream-driven early completion handling.
- `packages/cli/src/cmd/task/import.ts` -- stream-driven early completion handling.
- `packages/cli/src/cmd/task/edit.ts` -- stream output handling path.
- `packages/cli/src/util/__tests__/stream.test.ts` -- stream behavior test coverage.

## Implementation Approach
1. Define a new stream callback shape that passes incremental data (`chunk`, decoded text, and optional line events) instead of only accumulated output.
2. Implement a rolling buffer strategy in `Stream.toOutput` that handles decoder state and line boundary handling without unbounded concatenation.
3. Add an optional `capture: true` (or equivalent) mode to preserve full output only when needed.
4. Migrate marker detection in `run`, `plan`, and `task import` to incremental callbacks.
5. Verify that verbose logging output formatting remains unchanged from user perspective.
6. Update unit tests to validate stop conditions, callback invocation order, and capture-mode output fidelity.

## Acceptance Criteria

1. **No mandatory full-buffer accumulation**
   - Given `Stream.toOutput` is used in default mode
   - When processing large multi-chunk output
   - Then memory growth is not dominated by repeated full-string concatenation

2. **Incremental callbacks power marker detection**
   - Given `run`/`plan`/`task import` use stream callbacks
   - When completion markers appear in output
   - Then detection works using incremental data without requiring full accumulated output

3. **Optional output capture remains available**
   - Given a caller enables capture mode
   - When a stream completes
   - Then full output is returned exactly as decoded

4. **Verbose output behavior remains consistent**
   - Given `--verbose` is enabled on command paths using `Stream.toOutput`
   - When streams are processed
   - Then non-empty output continues to be printed as before

5. **Chunk boundary safety is preserved**
   - Given multi-byte UTF-8 characters and line breaks split across chunks
   - When `Stream.toOutput` processes the stream
   - Then decoded output and callback data are correct and lossless

6. **Tests cover the new semantics**
   - Given updated stream tests
   - When `bun test packages/cli/src/util/__tests__/stream.test.ts` is run
   - Then tests pass and assert incremental callback + capture behavior

## Metadata
- **Complexity**: Medium
- **Labels**: performance, streaming, cli, run-command
