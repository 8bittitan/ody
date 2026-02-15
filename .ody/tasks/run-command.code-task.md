---
status: completed
created: 2026-02-13
started: 2026-02-13
completed: 2026-02-13
---
# Task: Run Command Implementation

## Description
Implement the `ody run` agent execution loop command in `src/cmd/run.zig`. This is the core command that spawns AI backend processes, monitors their output for completion markers, manages iteration loops, and sends OS notifications. It supports loop mode (default), single-task mode, label filtering, and various flags for controlling execution behavior.

## Background
The TypeScript `ody run` command is the most complex command in the CLI. It builds prompts, spawns backend processes, streams their output, detects `<woof>COMPLETE</woof>` completion markers, and loops for multiple iterations. It supports `--once` mode (PTY/interactive), `--verbose` mode, `--dry-run`, label-based task filtering, and notification controls. Zig uses `std.process.Child` for process spawning and `std.Thread` for concurrent stdout/stderr draining.

## Technical Requirements
1. **Setup phase**:
   - Resolve notification setting (`--no-notify` overrides config)
   - Parse `--iterations` override
   - Validate `taskFile` positional arg (check `.code-task.md` extension, file existence)
   - Validate mutual exclusivity of `taskFile` and `--label`
   - If `--label`, call `getTaskFilesByLabel()` to resolve matching files
   - Build prompt via `run_prompt.buildRunPrompt()`
2. **Loop mode** (default):
   - Calculate max_iterations (override > single-task default of 1 > config value)
   - Start spinner if not `--verbose`
   - For each iteration: spawn child process with `stdin=close, stdout=pipe, stderr=pipe`
   - Drain stdout and stderr concurrently using `std.Thread.spawn`
   - Check for `<woof>COMPLETE</woof>` in stdout accumulator
   - On completion: stop spinner, send notification if `individual`, break
   - After loop: send notification if `all`, print outro
3. **Dry-run mode**: Print the constructed command and prompt, then exit
4. **Verbose mode**: Print child process output in real-time (set `should_print = true` on stream options)
5. **Notification integration**: Send OS notifications based on config setting

## Dependencies
- Process spawning utilities (or inline `std.process.Child` usage)
- Stream processing module (`src/util/stream.zig`)
- Prompt builders module (`src/builder/run_prompt.zig`)
- Backend harness (`src/backend/harness.zig`)
- Task file parsing (`src/util/task.zig`) for label filtering
- Notification module (`src/lib/notify.zig`)
- Terminal helpers (`src/util/terminal.zig`) for spinner
- Config module (`src/lib/config.zig`)

## Implementation Approach
1. Define the run command handler: `pub fn run(allocator, args, config) !void`
2. Parse and validate arguments (taskFile, label, iterations, verbose, dry-run, no-notify)
3. Build the prompt using `buildRunPrompt()` with the appropriate options
4. Build the backend command using `backend.buildCommand()`
5. If `--dry-run`, print the command array and prompt, then return
6. For loop mode:
   - Determine max iterations
   - Start spinner if not verbose
   - Enter iteration loop
   - Spawn child with `std.process.Child.init()`, set stdin to `.close`, stdout/stderr to `.pipe`
   - Spawn two threads: one to drain stdout, one to drain stderr
   - Use `drainStream()` with a completion marker callback
   - Join threads, check results
   - If completion marker found, break the loop
   - Send notifications as appropriate
7. Clean up: stop spinner, print outro message
8. For single-task mode (positional taskFile), default to 1 iteration

## Acceptance Criteria

1. **Basic Loop Execution**
   - Given a configured backend and pending tasks
   - When running `ody run`
   - Then the backend process is spawned and its output is monitored

2. **Completion Detection**
   - Given the backend outputs `<woof>COMPLETE</woof>`
   - When the completion marker is detected
   - Then the loop exits early and a success message is shown

3. **Iteration Limit**
   - Given `--iterations 3` flag
   - When running
   - Then at most 3 iterations are executed

4. **Label Filtering**
   - Given `--label auth` flag
   - When building the prompt
   - Then only tasks with the "auth" label are included

5. **Dry Run**
   - Given `--dry-run` flag
   - When running `ody run --dry-run`
   - Then the command and prompt are printed without spawning any process

6. **Verbose Output**
   - Given `--verbose` flag
   - When the backend is running
   - Then all stdout/stderr is printed in real-time (no spinner)

7. **Mutual Exclusivity**
   - Given both a taskFile and `--label` are specified
   - When validating arguments
   - Then an error message is shown

## Metadata
- **Complexity**: High
- **Labels**: zig-rewrite, phase-6, command, run, core
