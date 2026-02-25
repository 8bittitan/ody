# Concurrent Agents — Parallel Task Execution

## Overview

Run multiple agent processes in parallel within a single project, each working on a different task. The orchestrator reads pending tasks from disk, spawns up to 3 agents concurrently, and uses `fs.watch` to detect when an agent claims a task (writes `status: in_progress`) before spawning the next.

Each agent receives the `LOOP_PROMPT` with a `LABEL FILTER` scoped to the currently unclaimed pending tasks. The agent reads frontmatter, picks the highest-priority `pending` task from the list, and works on it. The filter scoping plus natural `in_progress` deconfliction prevents collisions.

## Architecture

```
User clicks "Start" with N pending tasks
         |
         v
    +---------------+
    |  IPC handler   | -- calls runParallel() if N > 1
    +-------+-------+
            v
    +----------------------------------------------+
    |  AgentRunner.runParallel()                    |
    |                                               |
    |  1. Read pending tasks from disk              |
    |  2. Spawn agent 1 with full pending list      |
    |  3. Start fs.watch on tasks dir               |
    |  4. On claim detected (pending -> in_progress)|
    |     - Re-read pending tasks                   |
    |     - Spawn next agent with updated list      |
    |  5. On agent exit:                            |
    |     - Re-read pending tasks                   |
    |     - Spawn replacement if tasks remain       |
    |  6. When all agents done + no pending -> done |
    +----------------------------------------------+
```

## Constants

In `agent.ts`:

```ts
const MAX_CONCURRENCY = 3;
```

Static value. No config property.

## Mode Selection

| Scenario | Mode | Method |
|---|---|---|
| User selects a specific task | Sequential | `runLoop` (existing, unchanged) |
| User runs all pending tasks (no specific selection) | Parallel | `runParallel` (new) |
| User filters by label (multiple results) | Parallel | `runParallel` with filtered list |

The IPC handler decides based on `taskFiles.length`:

- `taskFiles.length === 1` -> single-task mode -> `runLoop` (existing)
- `taskFiles.length > 1` or unset -> parallel mode -> `runParallel` (new)

## Prompt Strategy

Each parallel agent gets the existing `LOOP_PROMPT` + `LABEL FILTER`:

```
1. Look in the .ody/tasks directory for .code-task.md files. Read the YAML frontmatter
   of each file and find tasks with "status: pending". Select the single highest-priority
   pending task (use your judgement; not necessarily the first listed).
2. Update the selected task's YAML frontmatter: set "status: in_progress" ...
...

LABEL FILTER
Only consider the following task files:
  - 001-auth-module.code-task.md
  - 003-api-endpoints.code-task.md
  - 005-database-schema.code-task.md
```

The agent still decides which task to work on from the filtered list. The orchestrator just controls what's in the list by removing already-claimed tasks before each spawn.

## Spawn Orchestration with File Watching

### Initial batch

1. Read all task files, filter to `status: pending`
2. Spawn agent 1 with full pending list as the `LABEL FILTER`
3. Start `fs.watch` on the tasks directory
4. When a `.code-task.md` file changes and its status is now `in_progress`:
   - Re-read all task statuses from disk
   - Filter to `status: pending` only -> updated spawn queue
   - If `activeWorkers < MAX_CONCURRENCY` and queue is non-empty, spawn next agent with updated list
5. Repeat until `MAX_CONCURRENCY` reached or no pending tasks remain

### Queue backfill (on agent exit)

6. When any agent process exits:
   - Re-read task statuses from disk
   - Filter to `status: pending`
   - If pending tasks remain and not aborted, spawn a replacement agent with the current pending list
7. When all agents have exited and no pending tasks remain, emit `agent:complete`

### Why this works

- The `LABEL FILTER` scopes each agent to only consider available tasks
- Even if the list is slightly stale (race between prompt construction and agent reading disk), the agent's own frontmatter check for `status: pending` provides correctness
- The `fs.watch` trigger is faster than a fixed delay — spawn happens as soon as a claim is detected
- Duplicate `fs.watch` events are harmless — re-reading pending tasks is idempotent, and the concurrency guard prevents over-spawning

## File Changes

### 1. `packages/desktop/src/main/agent.ts`

**Refactor process tracking** from single proc to a Map:

- Replace `private proc: ChildProcessWithoutNullStreams | null = null` with `private procs = new Map<string, ChildProcessWithoutNullStreams>()`
- `isRunning()` -> `return this.procs.size > 0`
- `spawnAndStream` gains a `key` parameter (default `'loop'`):
  - `this.procs.set(key, proc)` instead of `this.proc = proc`
  - `this.procs.delete(key)` instead of `this.proc = null`
- `stop()` iterates the map:
  - Graceful: `this.aborted = true` (workers check this flag)
  - Force: `SIGKILL` every entry, then `this.procs.clear()`

**`runLoop`** — minimal change:

- Calls `this.spawnAndStream(win, cmd, cwd, 'loop')` (passes the key)
- Everything else stays the same

**New `spawnAndStreamTagged` helper**:

- Wraps `spawnAndStream` to prefix output chunks with `[taskLabel] `
- Sends prefixed text to renderer via `agent:output`
- Feeds raw text to the completion marker detector

**New `runParallel` method**:

- Guards with `isRunning()` check
- Creates a `Backend` instance from config
- Reads pending task files from disk via `getTaskStates`
- Applies label filter if `opts.taskFiles` is provided
- Sets up `fs.watch` on the tasks directory
- Manages a spawn queue and active worker map
- On file change: re-reads pending tasks, updates spawn queue, tries to spawn next worker
- On worker exit: re-reads pending tasks, spawns replacement if available
- Waits for all workers via `Promise.race` loop
- Cleans up watcher, sends `agent:complete`

**New `getPendingTaskFiles` helper**:

- Calls `getTaskStates(undefined, tasksDirPath)`
- Filters to `status === 'pending'`
- Returns file paths

**New `waitForAllWorkers` helper**:

- Loop: `while (activeWorkers.size > 0) await Promise.race(activeWorkers.values())`

### 2. `packages/desktop/src/main/ipc.ts` (~line 606-642)

**Change the `agent:run` handler**:

```ts
const taskFiles = options.taskFiles;
const isParallel = !taskFiles || taskFiles.length !== 1;

if (isParallel) {
  await agentRunner.runParallel(win, { projectDir, taskFiles }, config);
} else {
  await agentRunner.runLoop(win, { projectDir, taskFiles, iterations }, config);
}
```

**`agent:stop` handler** — no structural change. `agentRunner.stop()` handles the refactored `procs` map.

### 3. `packages/desktop/src/renderer/types/ipc.ts`

**Add event to `IpcEvents`**:

```ts
'agent:task:spawned': [remainingCount: number];
```

**Add to `OdyApi.agent`**:

```ts
onTaskSpawned: (listener: Listener<IpcEvents['agent:task:spawned']>) => () => void;
```

### 4. `packages/desktop/src/preload.ts`

**Add listener binding**:

```ts
onTaskSpawned: (listener) => addListener('agent:task:spawned', listener),
```

**Add to `removeAllListeners`**:

```ts
ipcRenderer.removeAllListeners('agent:task:spawned');
```

### 5. `packages/desktop/src/renderer/store/slices/agentSlice.ts`

**Add parallel tracking state**:

```ts
isParallel: boolean;
parallelRemaining: number;

setParallel: (isParallel: boolean) => void;
setParallelRemaining: (count: number) => void;
```

**Update `resetAgentState`** to clear:

```ts
isParallel: false,
parallelRemaining: 0,
```

The existing `output: string[]` stays as the unified stream. Prefixed lines (`[agent] ...`) go here.

### 6. `packages/desktop/src/renderer/hooks/useAgent.ts`

**In `start()`**:

```ts
const isParallel = !opts.taskFiles || opts.taskFiles.length !== 1;
setParallel(isParallel);
```

**Add event listener for `agent:task:spawned`**:

```ts
const unbindTaskSpawned = api.agent.onTaskSpawned((remainingCount) => {
  setParallelRemaining(remainingCount);
});
```

**Expose** `isParallel` and `parallelRemaining` from the hook return.

### 7. `packages/desktop/src/renderer/components/AgentRunner.tsx`

**Modify status text** (~line 258) to show parallel progress:

```tsx
{isRunning
  ? isParallel
    ? `Running in parallel (max 3) -- ${parallelRemaining} tasks remaining`
    : `Iteration ${iteration} of ${maxIterations || '...'} -- Running...`
  : `Ready. ${taskFilesForRun.length} task${taskFilesForRun.length === 1 ? '' : 's'} selected.`}
```

**Hide "Iteration limit" input** when multiple tasks are selected (iterations don't apply in parallel mode — each task gets one agent spawn).

## Files NOT Changed

| File | Reason |
|---|---|
| `internal/backends/` | Stateless command builders — no process state |
| `internal/builders/` | `LOOP_PROMPT` + `LABEL FILTER` already works as needed |
| `internal/config/` | No config changes (static constant) |
| `internal/tasks/` | Read-only usage; `getTaskStates` supports concurrent reads |
| `packages/cli/` | CLI stays sequential for now |
| `AgentOutput.tsx` | Prefixed output renders naturally in the existing `<pre>` block |

## Behaviors

| Scenario | Behavior |
|---|---|
| User selects a specific task | `runLoop` — single-task mode, unchanged |
| User runs all pending tasks | `runParallel` — up to 3 agents, file-watch staggered |
| Agent claims a task | Writes `in_progress` -> `fs.watch` fires -> orchestrator re-reads pending list -> spawns next agent with updated filter |
| Agent finishes | Process exits -> orchestrator re-reads pending -> spawns replacement if tasks remain |
| User clicks Stop (graceful) | `aborted = true` -> no new spawns; running agents finish current task |
| User clicks Stop (force) | `SIGKILL` all processes immediately |
| All tasks completed | `agent:complete` event -> UI shows done state |

## Edge Cases

- **Race between watcher and agent**: The watcher might fire before the agent writes `in_progress`, or the same file change could trigger multiple events. Mitigation: `spawnNextWorker` checks `procs.size < MAX_CONCURRENCY` before spawning, and the spawn queue is always re-read from disk, so stale state self-corrects.
- **`fs.watch` reliability on macOS**: Can sometimes fire duplicate events. Harmless — re-reading the pending list is idempotent, and the concurrency guard prevents over-spawning.
- **No pending tasks at start**: `runParallel` sends `agent:complete` immediately and returns.
- **Agent picks a task not in its filter**: Should not happen — the `LABEL FILTER` restricts scope. Even if it did, the task would get completed, which is fine.
- **All tasks claimed before MAX_CONCURRENCY**: If there are only 2 pending tasks, only 2 agents spawn. The watcher and exit handler re-check before every spawn.

## Execution Order

1. `agent.ts` — refactor `proc` to `procs`, add `runParallel`, `spawnAndStreamTagged`, helpers
2. `ipc.ts` — dispatch to `runParallel` when multiple tasks
3. `types/ipc.ts` — add `agent:task:spawned` event type
4. `preload.ts` — wire new event listener
5. `agentSlice.ts` — add `isParallel`, `parallelRemaining` state
6. `useAgent.ts` — populate parallel state, bind new event
7. `AgentRunner.tsx` — render parallel status, hide iteration input in parallel mode
