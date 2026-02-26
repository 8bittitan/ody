---
status: completed
created: 2026-02-25
started: 2026-02-25
completed: 2026-02-25
---
# Task: Create Router Instance with Hash History

## Description
Create the central router instance at `src/renderer/router.ts` using `createHashHistory` and `createRouter` from `@tanstack/react-router`. This module-level singleton is imported by `App.tsx` (for `<RouterProvider>`) and by any code that needs programmatic navigation (e.g., Electron IPC handlers).

## Background
The desktop app runs in Electron with `file://` protocol, so standard browser history (`pushState`) does not work. Hash history produces URLs like `file:///path/to/index.html#/tasks` which are fully compatible. The router imports the generated `routeTree` from `routeTree.gen.ts` produced by the Vite plugin. The `Register` interface declaration enables full type safety across all `useNavigate`, `<Link>`, and `useSearch` calls.

## Technical Requirements
1. Create `packages/desktop/src/renderer/router.ts`.
2. Import `createHashHistory` and `createRouter` from `@tanstack/react-router`.
3. Import `routeTree` from `./routeTree.gen` (the generated file).
4. Create a `hashHistory` instance via `createHashHistory()`.
5. Export a `router` instance via `createRouter({ routeTree, history: hashHistory, defaultPreload: 'intent' })`.
6. Declare the `Register` module augmentation so TypeScript knows the router's type:
   ```ts
   declare module '@tanstack/react-router' {
     interface Register {
       router: typeof router
     }
   }
   ```
7. The router must be a **module-level singleton** so it can be imported from both React components and non-React code (IPC handlers).

## Dependencies
- **add-tanstack-router-vite-plugin** — the Vite plugin must be configured so `routeTree.gen.ts` exists for import.

## Implementation Approach
1. Create `packages/desktop/src/renderer/router.ts` with the following structure:
   ```ts
   import { createHashHistory, createRouter } from '@tanstack/react-router';
   import { routeTree } from './routeTree.gen';

   const hashHistory = createHashHistory();

   export const router = createRouter({
     routeTree,
     history: hashHistory,
     defaultPreload: 'intent',
   });

   declare module '@tanstack/react-router' {
     interface Register {
       router: typeof router;
     }
   }
   ```
2. Ensure the `@` path alias (`src/renderer/`) works for this file — since it's in `src/renderer/` directly, relative imports are fine.
3. This file will initially fail to compile if `routeTree.gen.ts` doesn't exist yet. Either create a minimal placeholder route tree or ensure the Vite plugin runs first (e.g., run `bun run start` briefly to trigger generation).

## Acceptance Criteria

1. **File created**
   - Given the desktop package
   - When I check `src/renderer/router.ts`
   - Then it exports a `router` constant created with `createRouter` and `createHashHistory`

2. **Type registration**
   - Given the router module
   - When TypeScript resolves `@tanstack/react-router`
   - Then the `Register` interface includes the router type, enabling typed navigation

3. **Hash history**
   - Given the router is used in the app
   - When navigation occurs
   - Then URLs use hash format (e.g., `#/tasks`, `#/editor?taskPath=...`)

4. **Module singleton**
   - Given `router.ts` is imported from multiple modules
   - When each module accesses `router`
   - Then they all reference the same instance

## Metadata
- **Complexity**: Low
- **Labels**: routing, setup, desktop
