---
status: completed
created: 2026-02-25
started: 2026-02-25
completed: 2026-02-25
---
# Task: Create Editor Route with Search Params

## Description
Create `src/renderer/routes/editor.tsx` for the `/editor` route. This route renders `<TaskEditor>` and uses a required `taskPath` search param to identify which task file to edit. This replaces the `selectedTaskPath` state in the Zustand `ViewSlice`.

## Background
The task editor is a "hidden" view — it doesn't appear in the sidebar and is only reachable via programmatic navigation from `TaskBoard` (when a user clicks to edit a task). Currently, `Layout.tsx` calls `setSelectedTaskPath(taskPath)` then `setActiveView('editor')`. With routing, the task path is encoded in the URL search params: `#/editor?taskPath=.ody/tasks/my-task.code-task.md`. The `TaskEditor` component currently reads `selectedTaskPath` from the Zustand store; it must be updated to accept it as a prop or read from the route search params.

## Technical Requirements
1. Create `packages/desktop/src/renderer/routes/editor.tsx`.
2. Define an `editorSearchSchema` using `zod` (v4) with a required `taskPath` (string) field.
3. Use `createFileRoute('/editor')` with `validateSearch: editorSearchSchema`.
4. Create an `EditorPage` wrapper that:
   - Reads `taskPath` from `Route.useSearch()`.
   - Uses `useNavigate()` for the back button.
   - Passes `taskPath` to `<TaskEditor>`.
   - Passes `onBack={() => navigate({ to: '/tasks' })}`.
5. Wrap in `<ErrorBoundary title="Editor view error">`.
6. Update `TaskEditor` to accept `taskPath` as a prop instead of reading `selectedTaskPath` from the store. The component currently uses `useStore((state) => state.selectedTaskPath)` — this needs to change.

## Dependencies
- **add-tanstack-router-vite-plugin** — the Vite plugin must detect this route file.
- **create-root-route-layout** — `<Outlet />` in the root layout renders this route.

## Implementation Approach
1. Create `packages/desktop/src/renderer/routes/editor.tsx`:
   ```tsx
   import { createFileRoute, useNavigate } from '@tanstack/react-router';
   import { z } from 'zod/v4';
   import { ErrorBoundary } from '@/components/ErrorBoundary';
   import { TaskEditor } from '@/components/TaskEditor';

   const editorSearchSchema = z.object({
     taskPath: z.string(),
   });

   export const Route = createFileRoute('/editor')({
     validateSearch: editorSearchSchema,
     component: EditorPage,
   });

   function EditorPage() {
     const { taskPath } = Route.useSearch();
     const navigate = useNavigate();

     return (
       <ErrorBoundary title="Editor view error">
         <TaskEditor
           taskPath={taskPath}
           onBack={() => navigate({ to: '/tasks' })}
         />
       </ErrorBoundary>
     );
   }
   ```
2. Open `TaskEditor.tsx` and update its interface:
   - Add `taskPath: string` to props (or rename as needed).
   - Remove the `useStore((state) => state.selectedTaskPath)` call.
   - Use the prop value instead.
3. The `onBack` callback in `Layout.tsx` currently also calls `setSelectedTaskPath(null)` — with routing, this cleanup is no longer needed since the state is in the URL.
4. Ensure the `taskPath` value handles special characters (slashes, dots) — TanStack Router's search param serialization handles URL encoding automatically.

## Acceptance Criteria

1. **Route renders TaskEditor**
   - Given the URL is `#/editor?taskPath=.ody/tasks/my-task.code-task.md`
   - When the route renders
   - Then `<TaskEditor>` is displayed with the correct task loaded

2. **Back button navigates to tasks**
   - Given the editor is open
   - When the user clicks the back button
   - Then the app navigates to `/tasks`

3. **Required param enforced**
   - Given the URL is `#/editor` with no `taskPath` param
   - When the route tries to validate
   - Then validation fails and the route does not render (or redirects)

4. **Task path encoding**
   - Given a task path with special characters like `.ody/tasks/add-email-validation.code-task.md`
   - When encoded in the URL
   - Then it is properly encoded and decoded without data loss

## Metadata
- **Complexity**: Medium
- **Labels**: routing, views, search-params, desktop
