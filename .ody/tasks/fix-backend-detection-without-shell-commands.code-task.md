---
status: completed
created: 2026-02-23
started: 2026-02-23
completed: 2026-02-23
---
# Task: Fix Backend Detection Without Shell Commands

## Description
Replace shell-based backend binary detection in `@internal/backends` with an in-process PATH scan so backend availability does not depend on external `which`/`where` commands. This prevents false negatives in constrained environments while preserving current behavior and public APIs.

## Background
`getAvailableBackends()` in `internal/backends/src/util.ts` currently calls `execSync('which <binary>')` on POSIX and `execSync('where <binary>')` on Windows. This works on most developer machines, but it introduces an unnecessary dependency on shell tooling. In minimal containers, hardened runtime environments, or restricted PATHs, `which`/`where` may be unavailable even when `opencode`, `claude`, or `codex` are installed and executable.

This causes `getAvailableBackends()` to return an empty list incorrectly, which impacts backend selection in both CLI and desktop flows:
- `packages/cli/src/cmd/init.ts` (`ody init` backend prompt)
- `packages/desktop/src/main/ipc.ts` (`backends:available` IPC handler)

The fix should keep `getAvailableBackends()` return shape and callsites unchanged while making detection runtime-local and platform-correct.

## Technical Requirements
1. Remove shell execution dependency from `internal/backends/src/util.ts` (`execSync`, `which`, `where`)
2. Implement executable lookup by scanning `process.env.PATH` entries directly
3. Support platform differences:
   - POSIX: test exact binary names (`opencode`, `claude`, `codex`)
   - Windows: respect `PATHEXT` and test extension variants (e.g., `.exe`, `.cmd`, `.bat`, `.com`)
4. Treat non-readable/missing PATH entries safely (no thrown errors)
5. Preserve current public contract:
   - `getAvailableBackends(): { label: string; value: string }[]`
   - Existing labels/values remain unchanged
6. Keep implementation compatible with both Bun and Node runtimes (no Bun-specific APIs)

## Dependencies
- `internal/backends/src/util.ts` (primary implementation file)
- Existing consumers that rely on `getAvailableBackends()`:
  - `packages/cli/src/cmd/init.ts`
  - `packages/desktop/src/main/ipc.ts`
- Node built-ins for filesystem/path/process access

## Implementation Approach
1. In `internal/backends/src/util.ts`, remove `node:child_process` usage and introduce filesystem/path-based helpers.
2. Add a helper to split PATH safely:
   - Read `process.env.PATH`
   - Split using `path.delimiter`
   - Filter empty segments
3. Add a helper to compute candidate executable names:
   - POSIX: `[binary]`
   - Windows: `[binary]` plus `PATHEXT`-expanded variants (`binary.exe`, etc.)
   - Normalize extension comparison case-insensitively on Windows
4. For each PATH directory, test candidates using filesystem checks (e.g., `existsSync` + `statSync(...).isFile()`), wrapped to avoid hard failures on permission errors.
5. Update `getAvailableBackends()` to call the new helper for `opencode`, `claude`, and `codex` with no API changes.
6. Validate with project checks:
   - `bun run typecheck`
   - `bun run lint`

## Acceptance Criteria

1. **No shell command dependency**
   - Given `internal/backends/src/util.ts`
   - When inspecting imports and implementation
   - Then it no longer uses `execSync`, `which`, or `where`

2. **Backend detection works without `which`/`where`**
   - Given an environment where backend binaries are on PATH but `which`/`where` commands are unavailable
   - When `getAvailableBackends()` is called
   - Then installed backends are still detected correctly

3. **Windows compatibility**
   - Given a Windows environment with backend executables resolved via PATHEXT
   - When `getAvailableBackends()` is called
   - Then executable variants (e.g., `.exe`/`.cmd`) are detected correctly

4. **Consumers remain unchanged**
   - Given existing callsites in CLI and desktop
   - When integrating the updated utility
   - Then no callsite code changes are required for normal behavior

5. **Validation passes**
   - Given the repository workspace
   - When running `bun run typecheck` and `bun run lint`
   - Then both commands complete successfully

## Metadata
- **Complexity**: Low
- **Labels**: backends, cli, desktop, reliability, cross-platform
