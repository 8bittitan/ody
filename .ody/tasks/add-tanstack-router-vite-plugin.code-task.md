---
status: completed
created: 2026-02-25
started: 2026-02-25
completed: 2026-02-25
---
# Task: Add TanStack Router Vite Plugin

## Description
Configure the `@tanstack/router-plugin` Vite plugin in `vite.renderer.config.ts` to enable file-based route generation. The plugin watches `src/renderer/routes/` and generates `src/renderer/routeTree.gen.ts` automatically.

## Background
The desktop app uses Vite 7.3.1 with `@vitejs/plugin-react` (with React Compiler babel plugin) and `@tailwindcss/vite`. The TanStack Router Vite plugin must be added to this plugin chain. It should be listed first in the plugins array so route generation runs before other transforms. The plugin scans `.tsx` files in the routes directory and produces a typed route tree that the router instance imports.

## Technical Requirements
1. Import `TanStackRouterVite` from `@tanstack/router-plugin/vite` in `vite.renderer.config.ts`.
2. Add `TanStackRouterVite()` as the **first** plugin in the `plugins` array (before `tailwindcss()` and `react()`).
3. Configure `routesDirectory` to `'./src/renderer/routes'`.
4. Configure `generatedRouteTree` to `'./src/renderer/routeTree.gen.ts'`.
5. Create the empty `src/renderer/routes/` directory so the plugin has a target.
6. Decide whether to gitignore `routeTree.gen.ts` — recommend committing it so CI builds don't require the Vite dev server.

## Dependencies
- **install-tanstack-router-dependencies** — `@tanstack/router-plugin` must be installed first.

## Implementation Approach
1. Open `packages/desktop/vite.renderer.config.ts`.
2. Add the import at the top:
   ```ts
   import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
   ```
3. Insert `TanStackRouterVite({ routesDirectory: './src/renderer/routes', generatedRouteTree: './src/renderer/routeTree.gen.ts' })` as the first entry in the `plugins` array.
4. Create the directory `packages/desktop/src/renderer/routes/` (can be empty or contain a `.gitkeep`).
5. Verify by running the Vite dev server briefly — it should not error even with an empty routes directory (the plugin generates an empty route tree).

## Acceptance Criteria

1. **Plugin configured**
   - Given `vite.renderer.config.ts`
   - When I inspect the plugins array
   - Then `TanStackRouterVite` is the first plugin with correct `routesDirectory` and `generatedRouteTree` options

2. **Routes directory exists**
   - Given the desktop package source tree
   - When I check `src/renderer/routes/`
   - Then the directory exists

3. **Vite starts without errors**
   - Given the updated config
   - When I run `bun run start` or the Vite dev server
   - Then it starts without plugin-related errors

4. **Route tree generated**
   - Given route files exist in `src/renderer/routes/`
   - When Vite processes the files
   - Then `src/renderer/routeTree.gen.ts` is created with typed route definitions

## Metadata
- **Complexity**: Low
- **Labels**: setup, vite, desktop
