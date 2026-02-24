---
status: skip
created: 2026-02-23
started: null
completed: null
---
# Task: Replace Zustand with @tanstack/react-query

## Description
Remove zustand as the state management layer in the `@ody/desktop` Electron renderer and replace it with `@tanstack/react-query`. The current zustand store is essentially a hand-rolled cache of data fetched via Electron IPC, complete with manual `isLoading` booleans and try/catch error handling in wrapper hooks — exactly the problem react-query solves. This migration will eliminate boilerplate, provide automatic cache invalidation, stale-while-revalidate behavior, and a more declarative data-fetching model.

## Background
The desktop package currently uses a single zustand v5 store composed of five slices (Project, Config, Task, Agent, Auth). Each slice stores data retrieved from the Electron main process via IPC calls (`api.*`), along with loading/error states managed manually. Five wrapper hooks (`useProjects`, `useConfig`, `useTasks`, `useAuth`, `useAgent`) bridge between zustand and IPC by invoking `api.*` methods, writing results into the store, and toggling loading booleans. Components consume data either through these hooks or via direct `useStore` selectors.

There is no HTTP data fetching, no SSR, and no zustand middleware (no persist, devtools, or immer). The `useAgent` hook is unique in that it also subscribes to push events from the main process (e.g., `api.agent.onOutput`, `api.agent.onComplete`) for real-time streaming.

No `@tanstack/react-query` usage exists in the codebase today.

## Technical Requirements
1. Install `@tanstack/react-query` as a dependency in `packages/desktop`
2. Remove `zustand` from `packages/desktop` dependencies
3. Create a `QueryClient` instance and wrap the renderer app in `QueryClientProvider`
4. Replace all five zustand slices with react-query queries and mutations that call the existing `api.*` IPC methods
5. Convert `useProjects`, `useConfig`, `useTasks`, and `useAuth` hooks to use `useQuery` and `useMutation` backed by IPC calls
6. Handle the `useAgent` hook's real-time event stream pattern — use a combination of `useQuery` for initial state and direct React state (`useState`/`useReducer`) or `queryClient.setQueryData` for streaming IPC events (`onOutput`, `onComplete`, `onIteration`, etc.)
7. Replace all direct `useStore((s) => s.field)` selectors in components (`Layout`, `TaskBoard`, `TaskEditor`, `AgentRunner`) with the appropriate react-query hook consumption
8. Ensure UI-only state (filters like `labelFilter`, `statusFilter`, `selectedTaskPath` in TaskSlice) that does not come from IPC is managed with local component state or a lightweight context, since react-query is not designed for client-only UI state
9. Delete all zustand store files: `store/index.ts` and all five slice files under `store/slices/`
10. Ensure cache invalidation is wired correctly — e.g., after a mutation that creates a task, the task list query should be invalidated

## Dependencies
- `@tanstack/react-query` — core library for queries and mutations
- Existing Electron IPC API surface (`api.projects.*`, `api.config.*`, `api.tasks.*`, `api.auth.*`, `api.agent.*`) remains unchanged
- React 18+ (already in use) for concurrent features compatibility

## Implementation Approach
1. **Install dependencies**: Add `@tanstack/react-query` to `packages/desktop`. Optionally add `@tanstack/react-query-devtools` for development.
2. **Set up QueryClientProvider**: Create a `QueryClient` with sensible defaults (e.g., `staleTime`, `retry` settings appropriate for IPC which is local and fast). Wrap the renderer root component in `QueryClientProvider`.
3. **Define query keys**: Create a `queryKeys.ts` file with a structured key factory (e.g., `queryKeys.projects.all`, `queryKeys.tasks.list(projectPath)`, `queryKeys.config.data(projectPath)`) to ensure consistent cache keying and targeted invalidation.
4. **Migrate ProjectSlice**: Convert `useProjects` to use `useQuery` for fetching project lists and `useMutation` for add/remove operations with `onSuccess` invalidation. Move `activeProjectPath` to a React context or local state since it is UI selection state.
5. **Migrate ConfigSlice**: Convert `useConfig` to use `useQuery` for loading config data and layers, and `useMutation` for saving config. Move validation state into the mutation result or a derived query.
6. **Migrate TaskSlice**: Convert `useTasks` to use `useQuery` for task lists and task states, `useMutation` for task creation/updates. Move `labelFilter`, `statusFilter`, and `selectedTaskPath` to local component state or a shared context since they are purely UI concerns.
7. **Migrate AuthSlice**: Convert `useAuth` to use `useQuery` for loading auth store data and `useMutation` for auth operations.
8. **Migrate AgentSlice**: This is the most complex slice due to real-time streaming. Use `useMutation` for starting/stopping the agent. For streaming events (`onOutput`, `onComplete`, `onIteration`, `onAmbiguousMarker`), use `useEffect` to subscribe to IPC events and update query data via `queryClient.setQueryData` or manage with `useReducer` for the output array and status flags. Consider a custom `useAgentStream` hook that encapsulates the event subscription lifecycle.
9. **Update all consuming components**: Replace `useStore` selectors in `Layout.tsx`, `TaskBoard.tsx`, `TaskEditor.tsx`, `AgentRunner.tsx`, and all other components with the new react-query-based hooks. Ensure loading and error states from react-query (`isLoading`, `isError`, `error`) replace the manual boolean flags.
10. **Remove zustand**: Delete `store/index.ts`, all five slice files under `store/slices/`, and uninstall `zustand` from `package.json`. Remove any lingering zustand imports.
11. **Verify and test**: Ensure the app builds without errors. Walk through each feature area (projects, config, tasks, auth, agent runner) to verify data loads, mutations work, and cache invalidation triggers re-fetches as expected.

## Acceptance Criteria

1. **Project Management Works**
   - Given the app is loaded
   - When the user opens the project list
   - Then projects are fetched via IPC and displayed, with loading states shown during fetch

2. **Config Loading and Saving Works**
   - Given a project is selected
   - When the config panel is opened and a setting is changed
   - Then the config is loaded via query, saved via mutation, and the cache is invalidated to reflect the update

3. **Task Board Displays Tasks**
   - Given a project with tasks exists
   - When the task board is opened
   - Then tasks are fetched and displayed, filters work as UI-only state, and task mutations (create, update) correctly invalidate the task list

4. **Agent Runner Streams Output**
   - Given a task is selected and the agent is started
   - When the agent produces output, iterations, and completion events
   - Then the UI updates in real-time reflecting output lines, iteration count, and completion status

5. **Auth Panel Functions**
   - Given the auth panel is opened
   - When auth credentials are loaded or updated
   - Then the data is fetched/mutated via react-query with proper loading and error states

6. **Zustand Fully Removed**
   - Given the migration is complete
   - When searching the codebase for zustand imports or store files
   - Then zero references to zustand exist, the package is removed from dependencies, and all store slice files are deleted

7. **No Regression in UI Behavior**
   - Given any component that previously consumed zustand state
   - When interacting with the component
   - Then behavior is identical to pre-migration, including loading indicators, error handling, and data freshness

## Metadata
- **Complexity**: High
- **Labels**: refactor, state-management, react-query, desktop, electron
