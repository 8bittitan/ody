---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Extract @internal/backends Package

## Description
Extract the backend harness abstraction, concrete backend implementations (Claude, OpenCode, Codex), and backend detection utilities from `@ody/cli` into a new `@internal/backends` workspace package. The key refactor is replacing `Bun.which()` with a Node.js-compatible alternative for backend binary detection.

## Background
`@internal/backends` provides the `Backend` factory, `Harness` interface, and individual backend command builders. Each backend has two modes: `buildCommand()` (non-interactive, for loop-based agent runs) and `buildInteractiveCommand()` (for PTY/terminal sessions). The `getAvailableBackends()` utility detects which backends are installed on the system. Currently these live in `packages/cli/src/backends/`. The only refactor needed is in `util.ts` where `Bun.which()` must be replaced with a runtime-agnostic check.

## Technical Requirements
1. Create `internal/backends/` directory with `package.json`, `tsconfig.json`, and `src/index.ts` barrel export
2. Move files from `packages/cli/src/backends/` to `internal/backends/src/`:
   - `harness.ts` -- no changes (pure types)
   - `backend.ts` -- no changes (pure factory)
   - `claude.ts` -- no changes (pure data transformation)
   - `opencode.ts` -- no changes (pure data transformation)
   - `codex.ts` -- no changes (pure data transformation)
   - `util.ts` -- refactor: replace `Bun.which()` with Node-compatible binary detection
3. `Bun.which()` replacement: use `child_process.execSync('which <binary>')` on macOS/Linux or `where <binary>` on Windows, wrapped in try/catch to return `null` if not found
4. Package depends on `@internal/config` (workspace dependency)
5. `package.json`: `name: "@internal/backends"`, `version: "0.0.1"`, `private: true`, `type: "module"`

## Dependencies
- `extract-internal-config` task must be completed first

## Implementation Approach
1. Create `internal/backends/` directory structure:
   ```
   internal/backends/
     package.json
     tsconfig.json
     src/
       index.ts
       harness.ts
       backend.ts
       claude.ts
       opencode.ts
       codex.ts
       util.ts
   ```
2. Write `package.json` with `@internal/config` as workspace dependency
3. Write `tsconfig.json` extending root config
4. Copy `harness.ts`, `backend.ts`, `claude.ts`, `opencode.ts`, `codex.ts` from CLI with no modifications
5. Copy `util.ts` and refactor `Bun.which()`:
   ```typescript
   import { execSync } from 'node:child_process';
   import { platform } from 'node:process';
   
   function which(binary: string): string | null {
     try {
       const cmd = platform === 'win32' ? `where ${binary}` : `which ${binary}`;
       return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim() || null;
     } catch {
       return null;
     }
   }
   ```
6. Update any import paths that referenced CLI-internal paths to use `@internal/config`
7. Create barrel export: `Backend`, `Harness`, `CommandOptions` type, `getAvailableBackends`
8. Run `bun install` and verify workspace resolution

## Acceptance Criteria

1. **Package Structure**
   - Given the `internal/backends/` directory
   - When inspecting its contents
   - Then it contains all backend source files and configuration

2. **No Bun APIs**
   - Given the `internal/backends/src/` files
   - When searching for `Bun.` references
   - Then none are found

3. **Binary Detection Works**
   - Given the `getAvailableBackends()` function
   - When called in a Node.js environment
   - Then it correctly detects installed backends without using Bun APIs

4. **Both Command Modes Preserved**
   - Given any backend implementation
   - When checking its public methods
   - Then both `buildCommand()` and `buildInteractiveCommand()` are available

5. **Exports Complete**
   - Given the barrel export
   - When checking exported members
   - Then it exports `Backend`, `Harness`, `CommandOptions` type, and `getAvailableBackends`

## Metadata
- **Complexity**: Medium
- **Labels**: extraction, internal-packages, backends
