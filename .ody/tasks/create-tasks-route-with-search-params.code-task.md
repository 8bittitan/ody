---
status: completed
created: 2026-02-25
started: 2026-02-25
completed: 2026-02-25
---
# Task: Create Tasks Route with Search Params

## Description
Create `src/renderer/routes/tasks.tsx` for the `/tasks` route. This route renders `<TaskBoard>` and uses validated search params (`label` and `status`) to replace the `labelFilter` and `statusFilter` state that currently lives in the Zustand `ViewSlice`.

## Background
The tasks view is the primary view of the application. Currently, `TaskBoard` reads `labelFilter` and `statusFilter` from the Zustand `ViewSlice` via `useStore`. With the router migration, these filters move to URL search params (e.g., `#/tasks?label=frontend&status=pending`). This makes filter state shareable, bookmarkable, and inspectable in the URL. The `TaskBoard` component also provides navigation callbacks for opening the plan view, archive view, and task editor.

## Technical Requirements
1. Create `packages/desktop/src/renderer/routes/tasks.tsx`.
2. Define a `tasksSearchSchema` using `zod` (v4) with optional `label` (string) and optional `status` (string) fields.
3. Use `createFileRoute('/tasks')` with `validateSearch: tasksSearchSchema`.
4. Create a `TasksPage` wrapper component that:
   - Reads search params via `Route.useSearch()`.
   - Uses `useNavigate()` for navigation callbacks.
   - Passes `labelFilter={label}` and `statusFilter={status}` to `<TaskBoard>`.
   - Passes `onOpenPlan={() => navigate({ to: '/plan' })}`.
   - Passes `onOpenArchive={() => navigate({ to: '/archive' })}`.
   - Passes `onOpenEditor={(taskPath) => navigate({ to: '/editor', search: { taskPath } })}`.
5. Wrap `<TaskBoard>` in `<ErrorBoundary title="Task view error">`.
6. `TaskBoard` may need to be updated to accept `labelFilter` and `statusFilter` as props instead of reading from the store. Alternatively, the search params can be set into the store for backward compatibility during migration — but the preferred approach is passing as props.

## Dependencies
- **add-tanstack-router-vite-plugin** — the Vite plugin must detect this route file.
- **create-root-route-layout** — `<Outlet />` in the root layout renders this route.

## Implementation Approach
1. Create `packages/desktop/src/renderer/routes/tasks.tsx`:
   ```tsx
   import { createFileRoute, useNavigate } from '@tanstack/react-router';
   import { z } from 'zod/v4';
   import { ErrorBoundary } from '@/components/ErrorBoundary';
   import { TaskBoard } from '@/components/TaskBoard';

   const tasksSearchSchema = z.object({
     label: z.string().optional(),
     status: z.string().optional(),
   });

   export const Route = createFileRoute('/tasks')({
     validateSearch: tasksSearchSchema,
     component: TasksPage,
   });

   function TasksPage() {
     const { label, status } = Route.useSearch();
     const navigate = useNavigate();

     return (
       <ErrorBoundary title="Task view error">
         <TaskBoard
           labelFilter={label}
           statusFilter={status}
           onOpenPlan={() => navigate({ to: '/plan' })}
           onOpenArchive={() => navigate({ to: '/archive' })}
           onOpenEditor={(taskPath) =>
             navigate({ to: '/editor', search: { taskPath } })
           }
         />
       </ErrorBoundary>
     );
   }
   ```
2. Review `TaskBoard` component to understand how it currently consumes `labelFilter` and `statusFilter` from the store. Update it to accept these as props (or support both prop and store-based consumption for a transitional period).
3. When filters change inside `TaskBoard`, instead of calling `setLabelFilter()` / `setStatusFilter()` on the store, call `navigate({ search: (prev) => ({ ...prev, label: newLabel }) })`.
4. Ensure the `status` search param type aligns with the `TaskStatus | 'all'` type used by `TaskBoard`.

## Acceptance Criteria

1. **Route renders TaskBoard**
   - Given the router navigates to `/tasks`
   - When the route renders
   - Then `<TaskBoard>` is displayed within an error boundary

2. **Search params control filters**
   - Given the URL is `#/tasks?label=frontend&status=pending`
   - When `TaskBoard` renders
   - Then it shows only tasks matching `label=frontend` and `status=pending`

3. **Filter changes update URL**
   - Given the user changes the label filter in TaskBoard
   - When the filter updates
   - Then the URL search params update to reflect the new filter

4. **Navigation callbacks work**
   - Given the user clicks "Open Editor" on a task
   - When the callback fires
   - Then the app navigates to `/editor?taskPath=<path>`

5. **Default state (no params)**
   - Given the URL is `#/tasks` with no search params
   - When TaskBoard renders
   - Then no filters are applied (show all tasks)

## Metadata
- **Complexity**: Medium
- **Labels**: routing, views, search-params, desktop
