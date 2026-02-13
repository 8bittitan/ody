---
status: completed
created: 2026-02-12
started: 2026-02-13
completed: 2026-02-13
---
# Task: Remove --once Flag and Logic from Run Command

## Description
Remove the `--once` flag, the `--dry-run` flag (which depends on `--once`), and all associated logic from the `ody run` command. This includes removing the PTY-based single-execution code path in the run command, the `buildOnceCommand` method from the backend harness interface and all backend implementations, and any related references throughout the codebase.

## Background
The `ody run` command currently supports two execution modes: a default loop mode that runs the agent repeatedly with piped stdio, and a `--once` mode that spawns the agent exactly once in an interactive PTY session. The `--once` mode uses `Bun.spawn` with the `terminal` option for real TTY support and includes a `--dry-run` sub-option for debugging. Each backend (Claude, Opencode, Codex) implements a separate `buildOnceCommand` method that produces commands tailored for interactive/PTY execution. This dual-mode complexity is being removed to simplify the run command to only the loop-based execution path.

## Technical Requirements
1. Remove the `once` argument definition from the run command args (line ~37-40 in `run.ts`)
2. Remove the `dry-run` argument definition from the run command args (line ~42-46 in `run.ts`)
3. Remove the entire `--once` code path in the run command's `run` function (lines ~124-184 in `run.ts`), including the PTY spawn logic, dry-run handling, and completion detection via the `data` callback
4. Remove the `buildOnceCommand` abstract method from the `Harness` base class in `packages/cli/src/backends/harness.ts`
5. Remove the `buildOnceCommand` method from the `Backend` facade in `packages/cli/src/backends/backend.ts`
6. Remove the `buildOnceCommand` implementation from each backend: `claude.ts`, `opencode.ts`, and `codex.ts`
7. Update documentation references in `README.md` (line ~76-77)
8. Ensure the remaining loop mode code path still functions correctly after removal

## Dependencies
- `packages/cli/src/cmd/run.ts` — primary run command with `--once` and `--dry-run` arg definitions and the once-mode code path
- `packages/cli/src/backends/harness.ts` — abstract `Harness` class declaring `buildOnceCommand`
- `packages/cli/src/backends/backend.ts` — `Backend` facade delegating `buildOnceCommand` to harness
- `packages/cli/src/backends/claude.ts` — Claude backend `buildOnceCommand` implementation
- `packages/cli/src/backends/opencode.ts` — Opencode backend `buildOnceCommand` implementation
- `packages/cli/src/backends/codex.ts` — Codex backend `buildOnceCommand` implementation
- `README.md` — documents the `--once` flag in CLI usage

## Implementation Approach
1. **Remove arg definitions in `run.ts`**: Delete the `once` and `dry-run` entries from the `args` object in the run command definition.
2. **Remove the once-mode code path in `run.ts`**: Delete the entire conditional block that checks `args.once`, including the dry-run branch, the PTY spawn logic with the `terminal` option and `data` callback, the completion marker detection, and the early return. Ensure the remaining loop-mode code starts cleanly without the `if (args.once)` guard.
3. **Remove `buildOnceCommand` from `Harness` base class**: Delete the abstract method declaration from `packages/cli/src/backends/harness.ts`.
4. **Remove `buildOnceCommand` from `Backend` facade**: Delete the method from `packages/cli/src/backends/backend.ts` that delegates to the harness.
5. **Remove `buildOnceCommand` from all backend implementations**: Delete the method from `claude.ts`, `opencode.ts`, and `codex.ts`.
6. **Update `README.md`**: Remove or update the line(s) referencing the `--once` flag.
7. **Clean up any unused imports or variables**: After removing the once-mode code path, check `run.ts` for any imports or variables that were only used in that path (e.g., PTY-related types) and remove them.
8. **Validate the build**: Run `bun run build` from the project root to confirm no compile errors were introduced.

## Acceptance Criteria

1. **Flag Removed from CLI**
   - Given the `ody run` command
   - When a user passes the `--once` flag
   - Then the CLI rejects it as an unknown argument or ignores it (no once-mode behavior executes)

2. **Dry-run Flag Removed**
   - Given the `ody run` command
   - When a user passes the `--dry-run` flag
   - Then the CLI rejects it as an unknown argument or ignores it

3. **Loop Mode Unaffected**
   - Given the `ody run` command without `--once`
   - When run with default arguments
   - Then the agent executes in the standard loop mode exactly as before

4. **Backend Interface Clean**
   - Given the `Harness` abstract class and `Backend` facade
   - When inspected
   - Then no `buildOnceCommand` method exists on either

5. **Backend Implementations Clean**
   - Given each backend implementation (Claude, Opencode, Codex)
   - When inspected
   - Then no `buildOnceCommand` method exists on any of them

6. **Build Succeeds**
   - Given all changes applied
   - When `bun run build` is executed from the project root
   - Then the build completes without errors

## Metadata
- **Complexity**: Medium
- **Labels**: cli, refactor, run-command, cleanup
