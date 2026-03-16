---
status: completed
created: 2026-03-15
started: 2026-03-16
completed: 2026-03-16
---
# Task: Support concurrent desktop agent jobs per project and run kind

## Description
Refactor the desktop app's local Electron orchestration so it can run more than one backend process at a time without mixing state, output, or lifecycle controls. The first supported concurrency target is one task runner and one plan generator per project, with room to extend later to additional job kinds or multiple runs per project.

## Background
The desktop app currently assumes a single active agent process for the entire window. `packages/desktop/src/main/ipc.ts` creates one `AgentRunner` instance, `packages/desktop/src/main/agent.ts` only tracks one child process at a time, and renderer state in `packages/desktop/src/renderer/hooks/useAgent.ts` plus `packages/desktop/src/renderer/store/slices/agentSlice.ts` is global rather than scoped. This blocks several expected workflows:

- running agents for multiple projects at the same time,
- generating a plan while a task run is in progress,
- showing independent output/progress for each project and job kind.

The user wants to keep execution local to Electron instead of moving to a server-backed architecture. That means the Electron main process should become a local job manager responsible for creating, tracking, streaming, and stopping independent jobs.

## Technical Requirements
1. Replace the singleton desktop-agent execution model with a multi-job registry in the Electron main process, keyed at minimum by `projectPath` and job `kind` (`run`, `plan`), or by a generated `jobId` if a stable identifier is needed for future expansion.
2. Allow at least these concurrent combinations in one app window:
   - one task run in project A while another task run is active in project B,
   - one plan generation in a project while a task run is active in that same project,
   - one plan generation in one project while another plan or task run is active elsewhere.
3. Preserve the current rule that a single job slot should reject duplicate starts for the same project/kind pair unless the product explicitly allows multiple simultaneous runs of the same kind in one project.
4. Scope all start/stop/status/output IPC traffic to a specific job identity so renderer state and logs never collide across projects or job kinds.
5. Refactor renderer state management so job lifecycle, iteration counters, output buffers, completion state, and errors are stored per job instead of in one global agent slice.
6. Update the run and plan UI flows so they operate against scoped job state rather than the global active-project runner assumption.
7. Keep the current local execution model and existing backend/config resolution paths; do not introduce a remote server, network protocol, or new auth layer in this task.
8. Preserve existing task-run safety behavior around completion-marker verification and stop semantics, but make those checks apply to the specific job instance that executed the task run.

## Dependencies
- `packages/desktop/src/main/agent.ts` already encapsulates a single backend child-process lifecycle and should remain the per-job primitive.
- `packages/desktop/src/main/ipc.ts` currently owns agent IPC registration and is the correct place to add a local job registry or delegate to a new main-process service module.
- `packages/desktop/src/renderer/types/ipc.ts` defines the current unscoped IPC contracts and will need new job-scoped request/response/event payloads.
- `packages/desktop/src/renderer/hooks/useAgent.ts`, `packages/desktop/src/renderer/store/slices/agentSlice.ts`, and run/plan UI components will need to consume scoped job data.

## Implementation Approach
1. Introduce a main-process desktop job manager module (either extracted from `packages/desktop/src/main/ipc.ts` or kept adjacent to it) that owns a registry such as `Map<string, AgentRunner>` where the key is derived from `projectPath` plus job kind.
2. Define a shared job identity model in `packages/desktop/src/renderer/types/ipc.ts`, for example:
   - `type AgentJobKind = 'run' | 'plan';`
   - `type AgentJobKey = string;`
   - request payloads carrying `projectPath`, `kind`, and any run-specific options,
   - event payloads carrying `jobKey`, `projectPath`, `kind`, and event-specific fields.
3. Refactor `registerIpcHandlers` so task runs, plan generation, and any other agent-backed flow request a job from the registry instead of reusing one shared `AgentRunner`.
4. Keep `AgentRunner` responsible for one child process, but make its emitted events and completion handling flow through callbacks supplied by the job manager so the main process can tag them with the correct job identity before sending them to the renderer.
5. Split or generalize renderer state:
   - replace the single `AgentSlice` booleans and output array with a keyed structure such as `jobs: Record<string, AgentJobState>`,
   - add actions like `ensureJob`, `setJobRunning`, `appendJobOutput`, `setJobIteration`, `setJobError`, `resetJob`,
   - keep selector helpers so components can easily read one job's state.
6. Refactor `useAgent` into either:
   - a generic `useAgentJob(jobKey)` hook, or
   - separate wrappers like `useRunAgent(projectPath)` and `usePlanAgent(projectPath)` built on top of a shared keyed store.
7. Update `packages/desktop/src/renderer/components/AgentRunner.tsx` and related plan UI to render and control the correct scoped job rather than implicitly binding to the active project's single global run.
8. Maintain current protections around forced project switching, but make the logic aware of project-scoped running jobs so the app only stops the affected project's running jobs instead of assuming one global process.
9. Validate the new architecture by exercising concurrent cases in the desktop UI and by adding focused unit coverage where practical for keying, duplicate-run rejection, and state routing.

## Scope Notes
- This task is limited to local Electron orchestration and UI state refactoring.
- This task should not add a server, remote workers, or persistence for background jobs beyond current desktop app behavior.
- This task may update plan-related and run-related desktop components together because concurrency support crosses both flows inside the same package.
- This task should leave unrelated CLI, docs, and internal package behavior unchanged unless a shared type update is unavoidable.

## Acceptance Criteria

1. **Concurrent project task runs**
   - Given two configured desktop projects
   - When the user starts a task run in project A and then starts another task run in project B
   - Then both jobs can remain active concurrently, with independent output, progress, and stop controls

2. **Concurrent run and plan in one project**
   - Given a task run is already active for a project
   - When the user starts a new plan generation for that same project
   - Then the plan generation starts successfully without interrupting the task run, and both jobs report status independently

3. **Scoped output and lifecycle events**
   - Given multiple jobs are active at the same time
   - When backend output, iteration updates, completion notifications, or verification failures occur
   - Then each update is routed only to the matching project/job state in the renderer

4. **Duplicate slot rejection**
   - Given a task run is already active for a specific project
   - When the user attempts to start another task run for that same project and job kind
   - Then the desktop app rejects the duplicate start with a clear user-facing response while leaving the original job untouched

5. **Project switching safety remains intact**
   - Given a project has a running task job
   - When the user switches away from that project through the desktop UI
   - Then the app applies the intended stop/safety behavior only to the relevant running job(s) and does not corrupt unrelated concurrent jobs in other projects

6. **No mixed renderer state**
   - Given the renderer reloads or rehydrates while jobs are active
   - When job status is fetched from the main process
   - Then the renderer can reconstruct per-job running state without collapsing everything into one global agent status

## Metadata
- **Complexity**: High
- **Labels**: desktop, electron, agent, ipc, concurrency
