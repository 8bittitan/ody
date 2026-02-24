---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Scaffold Electron Desktop App Package

## Description
Create the `@ody/desktop` package under `packages/desktop/` with Electron Forge + Vite + React. Set up the main process entry, preload script, renderer entry, and Forge/Vite configuration files. Verify the app launches a blank Electron window and that `@internal/*` packages can be imported in the main process.

## Background
The Electron app is the second major consumer of the `@internal/*` packages (alongside the CLI). It uses Electron Forge for build tooling, Vite for bundling (main, preload, and renderer), and React for the UI. The app architecture has three layers: main process (Node.js, spawns agents, handles IPC), preload script (bridges IPC to renderer), and renderer (React UI). This task sets up the scaffolding -- all feature implementation comes in later tasks.

## Technical Requirements
1. Create `packages/desktop/` directory with the full directory structure from the plan
2. Initialize `package.json` with `name: "@ody/desktop"`, `version: "0.0.1"`, `main: ".vite/build/main.js"`
3. Install all dependencies as specified in the plan:
   - Runtime: `@internal/*` workspace packages, `node-pty`, `zod`
   - Dev: Electron, Forge (CLI, makers, Vite plugin), Vite, TypeScript, React, Tailwind v4, shadcn deps, CodeMirror, xterm.js, Zustand
4. Create `forge.config.ts` with Vite plugin, DMG/Squirrel/Deb makers, packager config
5. Create three Vite configs: `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`
6. Create `tsconfig.json` for the desktop package
7. Create minimal main process entry (`src/main/index.ts`) that creates a `BrowserWindow`
8. Create minimal preload script (`src/preload/index.ts`) with `contextBridge` skeleton
9. Create minimal renderer entry (`src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/App.tsx`)
10. Add `start`, `package`, and `make` scripts to `package.json`
11. Verify `bun run start` from `packages/desktop/` launches a blank Electron window
12. Verify `@internal/*` imports work in `src/main/index.ts`

## Dependencies
- `update-workspace-structure` task must be completed
- All `extract-internal-*` tasks should be completed (for import verification)

## Implementation Approach
1. Create the full directory structure:
   ```
   packages/desktop/
     package.json
     forge.config.ts
     vite.main.config.ts
     vite.preload.config.ts
     vite.renderer.config.ts
     tsconfig.json
     components.json
     src/
       main/
         index.ts
       preload/
         index.ts
       renderer/
         index.html
         main.tsx
         App.tsx
   ```
2. Write `forge.config.ts`:
   - Use `VitePlugin` with entries for main and preload
   - Configure DMG, Squirrel, and Deb makers
   - Set `packagerConfig` with app name "Ody", bundle ID "com.ody.desktop"
3. Write `vite.renderer.config.ts` with `@tailwindcss/vite` and `@vitejs/plugin-react` plugins, `@` alias to `./src/renderer`
4. Write minimal `src/main/index.ts`:
   - Create `BrowserWindow` with `nodeIntegration: false`, `contextIsolation: true`, preload script path
   - Load the renderer URL (Vite dev server in dev, file path in prod)
   - Test import: `import { Config } from '@internal/config'` to verify workspace resolution
5. Write minimal `src/preload/index.ts` with empty `contextBridge.exposeInMainWorld('ody', {})`
6. Write minimal `src/renderer/App.tsx` with a "Hello from Ody Desktop" placeholder
7. Run `bun install` to resolve all dependencies
8. Run `bun run start` to verify the Electron window launches

## Acceptance Criteria

1. **App Launches**
   - Given the scaffolded desktop package
   - When running `bun run start` from `packages/desktop/`
   - Then an Electron window appears with the React renderer content

2. **Internal Package Imports Work**
   - Given the main process entry
   - When importing from `@internal/config`
   - Then the import resolves without errors

3. **Forge Config Valid**
   - Given `forge.config.ts`
   - When Forge processes it
   - Then it recognizes the Vite plugin and maker configurations

4. **Vite Configs Valid**
   - Given the three Vite config files
   - When the dev server starts
   - Then main, preload, and renderer all build without errors

5. **Package Scripts**
   - Given `packages/desktop/package.json`
   - When checking scripts
   - Then `start`, `package`, and `make` scripts are defined

## Metadata
- **Complexity**: Medium
- **Labels**: electron, scaffold, desktop
