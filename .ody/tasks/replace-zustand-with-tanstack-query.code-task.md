---
status: skip
created: 2026-02-23
started: null
completed: null
---
# Task: Hybrid migration — @tanstack/react-query for server state, Zustand for client state

## Description
Introduce `@tanstack/react-query` in the `@ody/desktop` Electron renderer to manage all server-derived state (data fetched from the Electron main process via IPC), while keeping Zustand for client-only and event-driven state. The current Zustand store is essentially a hand-rolled cache of IPC data with manual `isLoading` booleans and try/catch error handling — exactly the problem React Query solves. Four of six slices (Project, Config, Task, Auth) will be replaced by React Query queries and mutations. The Agent slice (event-driven streaming) and UI slice (client-only layout state) will remain in Zustand, and a new View slice will absorb orphaned client-only view state (filters, selections) from the removed slices.

## Background
The desktop package currently uses a single Zustand v5 store composed of six slices (Project, Config, Task, Agent, Auth, UI). Five of six slices hold data retrieved from the Electron main process via IPC calls (`api.*`), along with loading/error states managed manually. Five wrapper hooks (`useProjects`, `useConfig`, `useTasks`, `useAuth`, `useAgent`) bridge between Zustand and IPC by invoking `api.*` methods, writing results into the store, and toggling loading booleans. Components consume data either through these hooks or via direct `useStore` selectors.

There is no HTTP data fetching, no SSR, and no Zustand middleware (no persist, devtools, or immer). The `useAgent` hook is unique in that it subscribes to push events from the main process (e.g., `api.agent.onOutput`, `api.agent.onComplete`) for real-time streaming — a pattern that does not fit React Query's request/response model. The UI slice manages purely client-side state (`sidebarCollapsed`) with manual localStorage persistence.

No `@tanstack/react-query` usage exists in the codebase today.

## Technical Requirements
1. Install `@tanstack/react-query` as a dev dependency in `packages/desktop`
2. Keep `zustand` in `packages/desktop` for the Agent, UI, and new View slices
3. Create a `QueryClient` instance and wrap the renderer app in `QueryClientProvider`
4. Replace four Zustand slices (Project, Config, Task, Auth) with React Query queries and mutations that call the existing `api.*` IPC methods
5. Convert `useProjects`, `useConfig`, `useTasks`, and `useAuth` hooks to use `useQuery` and `useMutation` backed by IPC calls
6. Keep the `useAgent` hook backed by Zustand — the Agent slice's event-driven streaming pattern (`onOutput`, `onComplete`, `onIteration`, etc.) is not suited to React Query's request/response model
7. Keep the UI slice in Zustand for client-only layout state (`sidebarCollapsed`, `toggleSidebar`)
8. Create a new View slice in Zustand for client-only view state migrated from the removed slices: `labelFilter`, `statusFilter`, `selectedTaskPath` (from TaskSlice) and `configEditorPath` (from ConfigSlice)
9. Replace direct `useStore((s) => s.field)` selectors in components (`Layout`, `TaskBoard`, `ConfigEditor`, `AgentRunner`) that accessed removed slices with the appropriate React Query hook or the new View slice
10. Delete the four replaced Zustand slice files: `projectSlice.ts`, `configSlice.ts`, `taskSlice.ts`, `authSlice.ts`
11. Update `store/index.ts` to compose only `AgentSlice & UISlice & ViewSlice`
12. Ensure cache invalidation is wired correctly — e.g., after a mutation that saves config, the config query should be invalidated; after adding a project, the project list query should be invalidated

## Dependencies
- `@tanstack/react-query` — core library for queries and mutations
- `zustand` (retained) — for Agent, UI, and View slices
- Existing Electron IPC API surface (`api.projects.*`, `api.config.*`, `api.tasks.*`, `api.auth.*`, `api.agent.*`) remains unchanged
- React 19 (already in use)

## Implementation Approach

### Phase 0 — Setup
1. **Install dependencies**: Add `@tanstack/react-query` to `packages/desktop` devDependencies. Optionally add `@tanstack/react-query-devtools` for development.
2. **Set up QueryClientProvider**: Create a `QueryClient` in `src/renderer/lib/queryClient.ts` with sensible defaults (e.g., `staleTime`, `retry` settings appropriate for IPC which is local and fast). Wrap the renderer root in `App.tsx` with `QueryClientProvider`.
3. **Define query keys**: Create `src/renderer/lib/queryKeys.ts` with a structured key factory (e.g., `queryKeys.projects.all`, `queryKeys.projects.active`, `queryKeys.config.data`, `queryKeys.tasks.list`, `queryKeys.tasks.states`, `queryKeys.auth.all`) to ensure consistent cache keying and targeted invalidation.

### Phase 1 — Migrate server-state hooks
4. **Migrate useProjects**: Convert to `useQuery` for `api.projects.list()` and `api.projects.active()`. Convert `addProject`, `removeProject`, `switchProject` to `useMutation` with `onSuccess` invalidation. Keep the `api.projects.onSwitched` IPC listener in a `useEffect` that calls `queryClient.invalidateQueries` or `queryClient.setQueryData` on the active project query. Delete `projectSlice.ts`.
5. **Migrate useConfig**: Convert to `useQuery` for `api.config.load()` returning `{ merged, localConfigPath, layers }`. Convert `saveConfig`, `saveGlobal`, `resetGuiOverrides` to `useMutation` with invalidation. Convert `validateConfig` to `useMutation` (fire-and-forget validation). Move `configEditorPath` to the new View slice. Delete `configSlice.ts`.
6. **Migrate useTasks**: Convert to `useQuery` for `api.tasks.list()` and `api.tasks.states()` (two parallel queries). Keep `filteredTasks` as a `useMemo` derived from query data + View slice filter state. Move `labelFilter`, `statusFilter`, `selectedTaskPath` to the new View slice. Keep `readTask` as a plain function (one-off call). Delete `taskSlice.ts`.
7. **Migrate useAuth**: Convert to `useQuery` for `api.auth.list()`. Convert `saveJira`, `saveGitHub`, `removeJira`, `removeGitHub` to `useMutation` with `queryKeys.auth` invalidation on success. Delete `authSlice.ts`.

### Phase 2 — Slim down Zustand store
8. **Create ViewSlice**: Add `src/renderer/store/slices/viewSlice.ts` containing `labelFilter`, `statusFilter`, `selectedTaskPath`, `configEditorPath` with corresponding setters. This absorbs all client-only view state from the deleted slices.
9. **Update store/index.ts**: Change `AppStore` to `AgentSlice & UISlice & ViewSlice`. Remove imports for deleted slices.

### Phase 3 — Update consumers
10. **Update components**: Replace `useStore` selectors that accessed removed slice state with the new React Query hooks:
    - `AgentRunner.tsx` line 37 (`state.activeProjectPath`) → use `useProjects()` hook
    - `TaskBoard.tsx` line 56 (`state.activeProjectPath`) → use `useProjects()` hook
    - `ConfigEditor.tsx` line 23 (`state.configEditorPath`) → use `useStore` with ViewSlice selector
    - `Layout.tsx` lines 64–68 — `isRunning`, `resetAgentState`, `sidebarCollapsed`, `toggleSidebar` remain on Zustand (AgentSlice/UISlice); `setConfigEditorPath` moves to ViewSlice

### Phase 4 — Cleanup and verify
11. **Remove dead code**: Delete the four slice files (`projectSlice.ts`, `configSlice.ts`, `taskSlice.ts`, `authSlice.ts`). Verify no remaining imports reference them.
12. **Verify**: Run `bun typecheck`, `bun lint`, `bun fmt`, and `bun test` to catch regressions. Smoke-test each feature area in the desktop app.

## Acceptance Criteria

1. **Project Management Works**
   - Given the app is loaded
   - When the user opens the project list
   - Then projects are fetched via React Query (`useQuery` + IPC) and displayed, with `isLoading`/`isError` states from React Query replacing manual booleans

2. **Config Loading and Saving Works**
   - Given a project is selected
   - When the config panel is opened and a setting is changed
   - Then the config is loaded via query, saved via mutation, and the cache is invalidated to reflect the update

3. **Task Board Displays Tasks**
   - Given a project with tasks exists
   - When the task board is opened
   - Then tasks are fetched via React Query and displayed, filters work via the Zustand ViewSlice, and task refresh correctly re-fetches the query

4. **Agent Runner Streams Output**
   - Given a task is selected and the agent is started
   - When the agent produces output, iterations, and completion events
   - Then the UI updates in real-time via the Zustand AgentSlice — behavior is unchanged from pre-migration

5. **Auth Panel Functions**
   - Given the auth panel is opened
   - When auth credentials are loaded or updated
   - Then the data is fetched/mutated via React Query with proper loading and error states

6. **Zustand Reduced to Client/Event State Only**
   - Given the migration is complete
   - When reviewing the Zustand store
   - Then only three slices remain: AgentSlice (event-driven streaming), UISlice (layout state), and ViewSlice (filters/selections) — no server-derived data lives in Zustand

7. **No Regression in UI Behavior**
   - Given any component that previously consumed Zustand state
   - When interacting with the component
   - Then behavior is identical to pre-migration, including loading indicators, error toasts, and data freshness

## Files

### New
- `src/renderer/lib/queryClient.ts` — QueryClient instance with IPC-appropriate defaults
- `src/renderer/lib/queryKeys.ts` — centralized query key factory
- `src/renderer/store/slices/viewSlice.ts` — client-only view state (filters, selections, editor path)

### Modified
- `package.json` — add `@tanstack/react-query` to devDependencies
- `src/renderer/App.tsx` — wrap in `QueryClientProvider`
- `src/renderer/hooks/useProjects.ts` — rewrite with `useQuery`/`useMutation`
- `src/renderer/hooks/useConfig.ts` — rewrite with `useQuery`/`useMutation`
- `src/renderer/hooks/useTasks.ts` — rewrite with `useQuery`/`useMutation`, read filters from ViewSlice
- `src/renderer/hooks/useAuth.ts` — rewrite with `useQuery`/`useMutation`
- `src/renderer/store/index.ts` — slim to `AgentSlice & UISlice & ViewSlice`
- `src/renderer/components/Layout.tsx` — update selectors for moved state
- `src/renderer/components/AgentRunner.tsx` — replace `useStore` project selector with `useProjects()`
- `src/renderer/components/TaskBoard.tsx` — replace `useStore` project selector with `useProjects()`
- `src/renderer/components/ConfigEditor.tsx` — read `configEditorPath` from ViewSlice

### Deleted
- `src/renderer/store/slices/projectSlice.ts`
- `src/renderer/store/slices/configSlice.ts`
- `src/renderer/store/slices/taskSlice.ts`
- `src/renderer/store/slices/authSlice.ts`

## Metadata
- **Complexity**: High
- **Labels**: refactor, state-management, react-query, zustand, desktop, electron
