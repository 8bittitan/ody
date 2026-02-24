---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement Zustand State Management Store

## Description
Set up the Zustand store with slices for project management, configuration, tasks, agent state, and authentication. This provides the centralized state management layer that all React components and hooks will consume.

## Background
The desktop app uses Zustand for state management due to its lightweight nature and minimal boilerplate. The store is organized into slices that correspond to the major feature areas: projects (active project, project list), config (loaded config, layer sources), tasks (task list, states, filters), agent (running state, iteration count, output), and auth (credential profiles). Each slice manages its own state and actions, composed into a single store.

## Technical Requirements
1. Create `src/renderer/store/index.ts` with the combined Zustand store
2. Create slice files under `src/renderer/store/slices/`:
   - `projectSlice.ts` -- project list, active project path, switching
   - `configSlice.ts` -- merged config, layer sources (global/local/gui), validation state
   - `taskSlice.ts` -- task summaries, task states, active filters (label, status), selected task
   - `agentSlice.ts` -- running state, current iteration, max iterations, output log, completion status, error state
   - `authSlice.ts` -- auth store (profiles), loading state
3. Each slice must define its state shape and action methods
4. Create custom hooks under `src/renderer/hooks/`:
   - `useProjects.ts` -- project list, active project, add/remove/switch actions
   - `useConfig.ts` -- config loading, saving, validation
   - `useTasks.ts` -- task list, states, filtering, refresh
   - `useAgent.ts` -- agent lifecycle (start, stop, output streaming)
   - `useAuth.ts` -- credential CRUD operations
   - `useTheme.ts` -- theme state, OS sync, class toggling
   - `useNotifications.ts` -- toast notifications wrapper
5. Hooks should bridge the Zustand store with IPC calls via `window.ody`

## Dependencies
- `implement-ipc-layer-and-preload` task must be completed first
- `setup-tailwind-shadcn-design-system` task must be completed first

## Implementation Approach
1. Create the Zustand store using the slice pattern:
   ```typescript
   // store/index.ts
   import { create } from 'zustand';
   import { createProjectSlice, type ProjectSlice } from './slices/projectSlice';
   import { createConfigSlice, type ConfigSlice } from './slices/configSlice';
   // ... other slices
   
   type AppStore = ProjectSlice & ConfigSlice & TaskSlice & AgentSlice & AuthSlice;
   
   export const useStore = create<AppStore>()((...a) => ({
     ...createProjectSlice(...a),
     ...createConfigSlice(...a),
     ...createTaskSlice(...a),
     ...createAgentSlice(...a),
     ...createAuthSlice(...a),
   }));
   ```
2. Implement each slice with typed state and actions:
   - `projectSlice`: `projects: Project[]`, `activeProject: string | null`, `setActiveProject`, `addProject`, `removeProject`
   - `configSlice`: `config: OdyConfig | null`, `layers: { global, local, gui }`, `loadConfig`, `saveConfig`, `resetGuiOverrides`
   - `taskSlice`: `tasks: TaskSummary[]`, `taskStates: TaskState[]`, `labelFilter: string | null`, `loadTasks`, `refreshTasks`
   - `agentSlice`: `isRunning: boolean`, `iteration: number`, `maxIterations: number`, `output: string[]`, `appendOutput`, `setRunning`, `clear`
   - `authSlice`: `authStore: AuthStore | null`, `loadAuth`, `saveJira`, `saveGitHub`, `removeProfile`
3. Create hooks that wrap store selectors and IPC calls:
   - Each hook selects relevant state from the store
   - Actions in hooks call IPC methods and update store state
   - Use `useEffect` for initial data loading where appropriate
4. `useTheme.ts` hook: manages theme preference, listens for `theme:changed` IPC events, toggles `dark` class on `<html>`
5. `useNotifications.ts` hook: wraps `sonner`'s `toast()` API with Art Deco variant styling

## Acceptance Criteria

1. **Store Created**
   - Given the Zustand store
   - When imported in a React component
   - Then it provides access to all slice state and actions

2. **Project Switching**
   - Given the project slice
   - When calling `setActiveProject(path)`
   - Then the active project updates and triggers config/task reload

3. **Config State Management**
   - Given the config slice
   - When calling `loadConfig()`
   - Then it fetches via IPC and stores the merged config with layer sources

4. **Agent State Tracking**
   - Given the agent slice
   - When an agent is running and output is streaming
   - Then `isRunning` is true, `iteration` updates, and `output` accumulates chunks

5. **Hooks Bridge IPC**
   - Given any custom hook (e.g., `useTasks`)
   - When its actions are called
   - Then they invoke the corresponding IPC methods and update the store

## Metadata
- **Complexity**: High
- **Labels**: state-management, zustand, hooks, desktop
