---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement Agent Runner (Process Spawning + Streaming)

## Description
Implement the `AgentRunner` class in the Electron main process that handles spawning agent processes, streaming output to the renderer, detecting completion markers, handling ambiguous markers, performing post-run task verification, and managing the agent lifecycle (start, stop, graceful/force termination).

## Background
The Agent Runner is the most critical piece of the desktop app. It mirrors the CLI's run loop but operates through IPC. It spawns the configured backend as a child process using `node:child_process`, streams stdout/stderr to the renderer via `agent:output` events, detects the `<woof>COMPLETE</woof>` marker, and manages iteration counting. Post-run verification checks task states to confirm the agent actually completed its work. The runner supports both single-task mode (specific task file) and multi-task mode (loop through all tasks).

## Technical Requirements
1. Create `src/main/agent.ts` with the `AgentRunner` class
2. Implement `runLoop(win, opts)` method:
   - Build prompt using `buildRunPrompt()` from `@internal/builders`
   - Build command using `Backend.buildCommand()` from `@internal/backends`
   - Loop through iterations (respecting maxIterations, 0 = infinite)
   - Send `agent:started`, `agent:iteration`, `agent:complete` events
   - Detect `<woof>COMPLETE</woof>` completion marker in accumulated output
   - Detect ambiguous markers (partial `<woof>` tags without exact match)
   - Post-run verification: check task states via `getTaskStatus`/`getTaskStates`
   - Send `agent:verifyFailed` event if verification fails
3. Implement `spawnAndStream(win, cmd)` method:
   - Spawn process with `child_process.spawn()`
   - Stream stdout/stderr to renderer via `agent:output`
   - Accumulate output for marker detection
   - Return marker detection result on process exit
4. Implement `stop()` method with two modes:
   - Graceful: set `aborted` flag, let current iteration finish
   - Force: send `SIGKILL` to process immediately
5. Wire IPC handlers:
   - `agent:run` -- starts the run loop
   - `agent:stop` -- stops the agent
   - `agent:dryRun` -- returns the command array without executing
6. Send Electron `Notification` on completion (respecting `notify` config)
7. Support label filtering (`--label` equivalent via `taskFiles` option)
8. Support iteration override (from run configuration)

## Dependencies
- `implement-ipc-layer-and-preload` task must be completed
- `implement-zustand-store` task must be completed
- `extract-internal-backends` task must be completed
- `extract-internal-builders` task must be completed
- `extract-internal-tasks` task must be completed

## Implementation Approach
1. Create `AgentRunner` class:
   ```typescript
   class AgentRunner {
     private proc: ChildProcess | null = null;
     private aborted = false;
     
     async runLoop(win: BrowserWindow, opts: RunOptions) {
       const config = Config.all();
       const backend = new Backend(config.backend);
       const model = Config.resolveModel('run', config);
       const maxIterations = opts.iterations ?? config.maxIterations;
       const prompt = buildRunPrompt({ /* template vars */ });
       
       win.webContents.send('agent:started');
       
       for (let i = 1; !this.aborted && (maxIterations === 0 || i <= maxIterations); i++) {
         win.webContents.send('agent:iteration', i, maxIterations);
         const cmd = backend.buildCommand(prompt, model);
         const result = await this.spawnAndStream(win, cmd, opts.projectDir);
         
         // Ambiguous marker detection
         if (result.hasAmbiguousMention && !result.hasStrictMatch) {
           win.webContents.send('agent:ambiguousMarker');
         }
         
         // Post-run verification
         await this.verifyTaskStates(win, opts, result);
         
         if (result.hasStrictMatch) break;
       }
       
       win.webContents.send('agent:complete');
       this.sendNotification(config);
     }
   }
   ```
2. Implement `spawnAndStream`:
   - Use `spawn(bin, args, { cwd: projectDir })`
   - Pipe stdout/stderr through event listeners
   - Accumulate full output for marker scanning
   - Return `{ hasStrictMatch, hasAmbiguousMention }` on process close
3. Implement stop with two modes:
   - Graceful: `this.aborted = true` (loop exits after current iteration)
   - Force: `this.proc?.kill('SIGKILL')` + `this.aborted = true`
4. Wire `agent:run` handler to create `AgentRunner` and call `runLoop`
5. Wire `agent:stop` handler to call `stop(mode)`
6. Wire `agent:dryRun` handler to build and return the command array
7. Notification: use Electron's `Notification` API based on `notify` config value

## Acceptance Criteria

1. **Agent Spawns and Streams**
   - Given a valid backend configuration
   - When starting an agent run
   - Then the agent process spawns and output streams to the renderer

2. **Completion Detection**
   - Given agent output containing `<woof>COMPLETE</woof>`
   - When detected
   - Then the loop stops and `agent:complete` event is sent

3. **Ambiguous Marker Warning**
   - Given agent output containing "woof" but not the exact completion marker
   - When the iteration ends
   - Then `agent:ambiguousMarker` event is sent

4. **Graceful Stop**
   - Given a running agent
   - When graceful stop is requested
   - Then the current iteration finishes before the loop exits

5. **Force Stop**
   - Given a running agent
   - When force stop is requested
   - Then the process is immediately killed with SIGKILL

6. **Post-Run Verification**
   - Given a completed agent run in single-task mode
   - When the task status is not "completed"
   - Then `agent:verifyFailed` event is sent with details

7. **Dry Run**
   - Given a run configuration
   - When calling dry run
   - Then the command array is returned without spawning

## Metadata
- **Complexity**: High
- **Labels**: agent, process-spawning, electron, desktop
