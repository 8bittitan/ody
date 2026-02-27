---
status: completed
created: 2026-02-25
started: 2026-02-25
completed: 2026-02-25
---
# Task: Install TanStack Router Dependencies

## Description
Add `@tanstack/react-router`, `@tanstack/react-router-with-query`, `@tanstack/router-plugin`, and `@tanstack/router-devtools` to the desktop package. This is the foundational step that enables all subsequent routing work.

## Background
The desktop app (`packages/desktop`) currently has no routing library. View switching is handled entirely by a `useState<ViewId>` in `Layout.tsx` with a ternary chain rendering 9 views. The migration replaces this with `@tanstack/react-router` using hash history, which works with Electron's `file://` protocol. The `@tanstack/react-router-with-query` package integrates with the existing `@tanstack/react-query` setup. The router plugin enables file-based route generation via Vite.

## Technical Requirements
1. Add `@tanstack/react-router` and `@tanstack/react-router-with-query` as production dependencies in `packages/desktop/package.json`.
2. Add `@tanstack/router-plugin` and `@tanstack/router-devtools` as dev dependencies in `packages/desktop/package.json`.
3. Run `bun install` from the workspace root to resolve and link all new packages.
4. Verify the packages resolve correctly by checking `node_modules/@tanstack/react-router` exists.

## Dependencies
- None — this is the first task in the migration sequence.

## Implementation Approach
1. From the workspace root, run:
   ```sh
   bun add --cwd packages/desktop @tanstack/react-router @tanstack/react-router-with-query
   bun add --cwd packages/desktop -d @tanstack/router-plugin @tanstack/router-devtools
   ```
2. Verify `packages/desktop/package.json` now lists:
   - `@tanstack/react-router` in `dependencies`
   - `@tanstack/react-router-with-query` in `dependencies`
   - `@tanstack/router-plugin` in `devDependencies`
   - `@tanstack/router-devtools` in `devDependencies`
3. Run `bun install` to ensure lockfile is up to date.
4. Confirm no version conflicts with the existing `@tanstack/react-query@^5.90.21` dependency.

## Acceptance Criteria

1. **Dependencies installed**
   - Given the desktop package.json
   - When I inspect `dependencies` and `devDependencies`
   - Then all four `@tanstack` router packages are listed with appropriate version ranges

2. **Lockfile updated**
   - Given the workspace root
   - When I run `bun install`
   - Then it completes without errors and the lockfile reflects the new packages

3. **No conflicts with existing TanStack Query**
   - Given `@tanstack/react-query@^5.90.21` is already installed
   - When the router packages are added
   - Then there are no peer dependency warnings or version conflicts

## Metadata
- **Complexity**: Low
- **Labels**: setup, dependencies, desktop
