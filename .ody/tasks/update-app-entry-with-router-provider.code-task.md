---
status: completed
created: 2026-02-25
started: 2026-02-25
completed: 2026-02-25
---
# Task: Update App.tsx Entry Point with RouterProvider

## Description
Replace the `<Layout />` component in `App.tsx` with `<RouterProvider router={router} />` from `@tanstack/react-router`. This wires the entire application to use the router for view rendering.

## Background
Currently `App.tsx` renders `<QueryClientProvider>` wrapping `<ErrorBoundary>` wrapping `<Layout />`. After migration, `<Layout />` is replaced by `<RouterProvider>`, which renders `__root.tsx` (the new root layout) and child route components via `<Outlet />`. The `ErrorBoundary` can remain around the `RouterProvider` as a top-level crash handler. The `useTheme()` hook call at the top of `App` should be preserved. The `<Toaster>` component stays outside the router.

## Technical Requirements
1. Modify `packages/desktop/src/renderer/App.tsx`.
2. Import `RouterProvider` from `@tanstack/react-router`.
3. Import `router` from `./router`.
4. Replace `<Layout />` with `<RouterProvider router={router} />`.
5. Keep `<QueryClientProvider>` wrapping the router provider.
6. Keep `<ErrorBoundary>` wrapping the router provider.
7. Keep `<Toaster>` outside/after the router provider.
8. Keep the `useTheme()` call.
9. Remove the `Layout` import.

## Dependencies
- **create-router-instance-with-hash-history** — the `router` export must exist.
- **create-root-route-layout** — the root route must exist for `RouterProvider` to render.

## Implementation Approach
1. Open `packages/desktop/src/renderer/App.tsx`.
2. Replace the import:
   ```diff
   - import { Layout } from './components/Layout';
   + import { RouterProvider } from '@tanstack/react-router';
   + import { router } from './router';
   ```
3. Update the JSX:
   ```diff
     <QueryClientProvider client={queryClient}>
       <ErrorBoundary title="Application crashed">
   -     <Layout />
   +     <RouterProvider router={router} />
       </ErrorBoundary>
       <Toaster ... />
     </QueryClientProvider>
   ```
4. Verify the `useTheme()` hook is still called — it applies the theme class to the document and should run regardless of routing.

## Acceptance Criteria

1. **App renders via router**
   - Given the app starts
   - When the renderer loads
   - Then `RouterProvider` renders the root layout and the default `/tasks` route

2. **QueryClientProvider wraps router**
   - Given the app component tree
   - When the router renders
   - Then it has access to the React Query client for data fetching hooks

3. **Theme still applies**
   - Given the `useTheme()` hook
   - When the app mounts
   - Then the theme class is applied to the document element

4. **Toaster still works**
   - Given a toast notification is triggered
   - When it fires
   - Then the toast appears in the top-right corner

5. **Layout import removed**
   - Given the updated `App.tsx`
   - When I inspect the imports
   - Then there is no import of `Layout` from `./components/Layout`

## Metadata
- **Complexity**: Low
- **Labels**: routing, entry-point, desktop
