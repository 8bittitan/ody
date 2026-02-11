---
status: completed
created: 2026-02-10
started: 2026-02-10
completed: 2026-02-10
---
# Task: Add PTY-based Completion Detection to --once Mode

## Description
When running `ody run --once`, the LLM harness process stays open after the agent finishes its work because the current implementation uses `stdio: ['inherit', 'inherit', 'inherit']`, which provides no way to detect completion. This task replaces the inherited stdio with Bun's built-in `Bun.Terminal` PTY API to capture output, detect the `<woof>COMPLETE</woof>` marker, and kill the process — while preserving full interactive TTY behavior for the child process.

## Background
The `run` command has two modes: loop mode (default) and single-run mode (`--once`). Loop mode already captures stdout/stderr via piped stdio and scans for the `<woof>COMPLETE</woof>` marker to detect completion. However, `--once` mode uses fully inherited stdio so the harness runs interactively, but this means ody cannot intercept output to detect when the agent is done. `Bun.Terminal` (available since Bun v1.3.5) provides a PTY that gives the child process a real TTY while allowing the parent to capture and inspect output via a `data` callback.

## Technical Requirements
1. Replace the `Bun.spawn` call in the `--once` branch of `packages/cli/src/cmd/run.ts` (lines 78-94) to use the `terminal` option instead of `stdio: ['inherit', 'inherit', 'inherit']`
2. Forward all PTY output to `process.stdout` in real-time so the user sees the same interactive experience
3. Accumulate output and scan for `<woof>COMPLETE</woof>` to detect task completion
4. On detection, call `proc.kill()` and `proc.terminal.close()` to terminate the harness
5. Handle the case where the process exits on its own without the marker (clean exit)
6. No new dependencies — use only the built-in `Bun.Terminal` API

## Dependencies
- Bun v1.3.5+ (project is on v1.3.8) for `Bun.Terminal` support
- Existing `<woof>COMPLETE</woof>` marker convention already present in `runPrompt.ts`

## Implementation Approach
1. In `packages/cli/src/cmd/run.ts`, locate the `--once` branch (the `if (args.once)` block starting around line 55)
2. Replace the current `Bun.spawn` call that uses inherited stdio with one that uses the `terminal` option:
   - Set `cols` and `rows` from `process.stdout.columns` / `process.stdout.rows` (with sensible defaults of 80x24)
   - In the `data` callback: write raw data to `process.stdout`, accumulate text via `Buffer.from(data).toString('utf-8')`, and check for the completion marker
3. When `<woof>COMPLETE</woof>` is detected, set a `completed` flag, call `proc.kill()`, and break out
4. After `await proc.exited`, call `proc.terminal.close()` to clean up the PTY
5. Update the `outro` message to distinguish between marker-detected completion and natural process exit
6. Leave all other code paths unchanged (loop mode, `--dry-run`, `plan` command)

## Acceptance Criteria

1. **Completion detection kills the process**
   - Given `ody run --once` is executed with a task that outputs `<woof>COMPLETE</woof>`
   - When the marker appears in the agent's output
   - Then the harness process is terminated and ody exits cleanly

2. **Interactive TTY behavior is preserved**
   - Given `ody run --once` is executed
   - When the harness process checks `process.stdout.isTTY`
   - Then it reports `true`, and colored/interactive output works as expected

3. **Output is visible in real-time**
   - Given `ody run --once` is executed
   - When the agent produces output
   - Then it is displayed to the user immediately (not buffered until completion)

4. **Clean exit without marker**
   - Given `ody run --once` is executed and the agent process exits on its own
   - When the process exits without outputting `<woof>COMPLETE</woof>`
   - Then ody exits cleanly with the process exit code

5. **No changes to other modes**
   - Given the loop mode (`ody run` without `--once`) or `ody plan` is executed
   - When the commands run
   - Then their behavior is identical to before this change

## Metadata
- **Complexity**: Low
- **Labels**: cli, run, pty, enhancement
