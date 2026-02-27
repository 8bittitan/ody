---
status: completed
created: 2026-02-25
started: 2026-02-25
completed: 2026-02-25
---
# Task: Create Index Redirect Route

## Description
Create `src/renderer/routes/index.tsx` that redirects the root path (`/`) to `/tasks`. This ensures the app always lands on the tasks view when first loaded or when the hash is empty.

## Background
The current `Layout.tsx` defaults to `useState<ViewId>('tasks')`, meaning the tasks view is the initial view. With routing, navigating to `/` (or an empty hash `#/`) needs to redirect to `/tasks` to preserve this behavior. TanStack Router supports this via `beforeLoad` throwing a `redirect`.

## Technical Requirements
1. Create `packages/desktop/src/renderer/routes/index.tsx`.
2. Use `createFileRoute` and `redirect` from `@tanstack/react-router`.
3. The route's `beforeLoad` hook should throw `redirect({ to: '/tasks' })`.
4. No component is needed since the redirect happens before rendering.

## Dependencies
- **add-tanstack-router-vite-plugin** — the Vite plugin must be configured to detect this route file.
- **create-router-instance-with-hash-history** — the router must exist.

## Implementation Approach
1. Create `packages/desktop/src/renderer/routes/index.tsx`:
   ```tsx
   import { createFileRoute, redirect } from '@tanstack/react-router';

   export const Route = createFileRoute('/')({
     beforeLoad: () => {
       throw redirect({ to: '/tasks' });
     },
   });
   ```
2. Verify by navigating to `#/` — it should immediately redirect to `#/tasks`.

## Acceptance Criteria

1. **Root path redirects**
   - Given the app loads with an empty hash or `#/`
   - When the router processes the route
   - Then the URL changes to `#/tasks` and the tasks view renders

2. **No flash of empty content**
   - Given the redirect happens in `beforeLoad`
   - When the root path is accessed
   - Then no intermediate empty component renders before the redirect

## Metadata
- **Complexity**: Low
- **Labels**: routing, desktop
