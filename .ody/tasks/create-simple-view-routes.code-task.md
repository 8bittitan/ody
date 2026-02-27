---
status: completed
created: 2026-02-25
started: 2026-02-25
completed: 2026-02-25
---
# Task: Create Simple View Route Files

## Description
Create route files for the six views that don't require search params: `/run`, `/plan`, `/import`, `/config`, `/auth`, and `/archive`. Each route file maps a path to its existing view component wrapped in an `<ErrorBoundary>`.

## Background
These views currently render via the ternary chain in `Layout.tsx`. Each has a simple mapping: the view ID maps to a component with no required URL parameters. The plan view is special — it renders `<PlanCreator>` alongside `<GenerationOutput>` in a two-column grid and manages plan generation streaming state locally. The import view receives `config` and navigation callbacks. Moving each to its own route file isolates them and enables code-splitting potential.

## Technical Requirements
1. Create 6 route files in `packages/desktop/src/renderer/routes/`:
   - `run.tsx` — renders `<AgentRunner />`
   - `plan.tsx` — renders `<PlanCreator />` + `<GenerationOutput />` in a grid, managing plan streaming state
   - `import.tsx` — renders `<TaskImport />` with navigation callbacks via `useNavigate()`
   - `config.tsx` — renders `<ConfigPanel />` with navigation callbacks
   - `auth.tsx` — renders `<AuthPanel />`
   - `archive.tsx` — renders `<ArchiveViewer />`
2. Each route file uses `createFileRoute` from `@tanstack/react-router`.
3. Each component is wrapped in `<ErrorBoundary>` matching current behavior.
4. Navigation callbacks that currently use `setActiveView` must use `useNavigate()`:
   - `config.tsx`: `onEditJson` navigates to `/config-editor?path=<configPath>`, `onOpenInitWizard` remains as-is (it opens a modal in the root layout, not a route change).
   - `import.tsx`: `onOpenAuth` navigates to `/auth`, `onOpenTaskBoard` navigates to `/tasks`.
   - `plan.tsx`: `onOpenTaskBoard` in `GenerationOutput` navigates to `/tasks`.
5. The plan route must own its streaming state (`planStreamOutput`, `isPlanGenerating`, `isPlanGeneratingRef`) and the IPC listeners for agent output/complete/stopped/verifyFailed — these are currently in `Layout.tsx` lines 77-131.

## Dependencies
- **add-tanstack-router-vite-plugin** — the Vite plugin must detect these route files.
- **create-root-route-layout** — `<Outlet />` in the root layout renders these routes.

## Implementation Approach
1. **`routes/run.tsx`**:
   ```tsx
   import { createFileRoute } from '@tanstack/react-router';
   import { AgentRunner } from '@/components/AgentRunner';
   import { ErrorBoundary } from '@/components/ErrorBoundary';

   export const Route = createFileRoute('/run')({
     component: RunPage,
   });

   function RunPage() {
     return (
       <ErrorBoundary title="Run view error">
         <AgentRunner />
       </ErrorBoundary>
     );
   }
   ```

2. **`routes/auth.tsx`** and **`routes/archive.tsx`** — same pattern as run, rendering `<AuthPanel />` and `<ArchiveViewer />` respectively.

3. **`routes/config.tsx`**:
   - Import `useNavigate` from `@tanstack/react-router`.
   - Pass `onEditJson` as `(configPath) => navigate({ to: '/config-editor', search: { path: configPath } })`.
   - For `onOpenInitWizard`, this triggers a modal that lives in the root layout. Either:
     - Expose a callback from root layout via context, OR
     - Use a custom DOM event (e.g., `window.dispatchEvent(new CustomEvent('ody:open-init-wizard'))`) listened to in `__root.tsx`.
   - Recommend the DOM event approach for simplicity since `InitWizard` is a modal, not a route.

4. **`routes/import.tsx`**:
   - Import `useNavigate` and `useConfig` (for `config` prop).
   - Pass `onOpenAuth={() => navigate({ to: '/auth' })}` and `onOpenTaskBoard={() => navigate({ to: '/tasks' })}`.

5. **`routes/plan.tsx`**:
   - Move plan generation state from `Layout.tsx`: `planStreamOutput`, `isPlanGenerating`, `isPlanGeneratingRef`, `resetPlanStream`.
   - Move the `useEffect` that listens to `api.agent.onOutput`, `api.agent.onComplete`, `api.agent.onStopped`, `api.agent.onVerifyFailed` (Layout.tsx lines 85-131).
   - Import `useNotifications` for `success` and `error` toasts on plan completion/failure.
   - Import `useTasks` for `loadTasks()` call on plan completion.
   - Render `<PlanCreator>` and `<GenerationOutput>` in the same `grid h-full gap-3 lg:grid-cols-[1.25fr_0.75fr]` layout.
   - `GenerationOutput.onOpenTaskBoard` becomes `navigate({ to: '/tasks' })`.

## Acceptance Criteria

1. **Each route renders its component**
   - Given the router is active
   - When I navigate to `/run`, `/plan`, `/import`, `/config`, `/auth`, or `/archive`
   - Then the correct view component renders inside the root layout's `<Outlet />`

2. **Error boundaries preserved**
   - Given a component throws an error
   - When the error boundary catches it
   - Then a user-friendly error message is shown without crashing the whole app

3. **Plan streaming works**
   - Given the plan route is active
   - When a plan generation is triggered
   - Then streaming output appears in `<GenerationOutput>` and completion/failure toasts fire

4. **Config edit navigation works**
   - Given the config route is active
   - When the user clicks "Edit JSON" on a config file
   - Then the app navigates to `/config-editor?path=<configPath>`

5. **Import navigation works**
   - Given the import route is active
   - When the user triggers "Open Auth" or "Open Task Board"
   - Then the app navigates to `/auth` or `/tasks` respectively

## Metadata
- **Complexity**: Medium
- **Labels**: routing, views, desktop
