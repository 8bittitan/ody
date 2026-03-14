---
status: completed
created: 2026-03-14
started: 2026-03-14
completed: 2026-03-14
---
# Task: Move resolve and review commands under a new pr subcommand group

## Description
Restructure the CLI so that `ody resolve` and `ody review` become `ody pr resolve` and `ody pr review`. This groups PR-related commands under a single `pr` parent, matching the existing subcommand pattern used by `auth/` and `task/`. The old top-level `resolve` and `review` commands are removed entirely (no backward-compatible aliases).

## Background
The CLI currently has `resolve` and `review` as top-level commands. Both operate on GitHub pull requests — `resolve` addresses PR comments and `review` performs an interactive PR review. Grouping them under `pr` improves command discoverability and creates a natural namespace for future PR-related subcommands. The codebase already has two subcommand group examples (`auth/`, `task/`) that establish the pattern to follow.

## Technical Requirements
1. Create a new directory `packages/cli/src/cmd/pr/`.
2. Create `packages/cli/src/cmd/pr/index.ts` exporting `prCmd` — a dispatch-only `defineCommand` with `meta` and `subCommands` (no `args`, no `run`), following the exact pattern of `auth/index.ts` and `task/index.ts`.
3. Move `packages/cli/src/cmd/resolve.ts` to `packages/cli/src/cmd/pr/resolve.ts`. No changes to the module's internal logic are needed.
4. Move `packages/cli/src/cmd/review.ts` to `packages/cli/src/cmd/pr/review.ts`. No changes to the module's internal logic are needed.
5. Update `packages/cli/src/index.ts`: remove the `resolve` and `review` entries from `subCommands` and add a single `pr` entry using the lazy-import pattern: `pr: () => import('./cmd/pr').then((m) => m.prCmd)`.
6. Move `packages/cli/src/cmd/__tests__/resolve.test.ts` to `packages/cli/src/cmd/pr/__tests__/resolve.test.ts`. Update the relative import path from `'../resolve'` (unchanged since the test moves one level deeper alongside the source).
7. Move `packages/cli/src/cmd/__tests__/review.test.ts` to `packages/cli/src/cmd/pr/__tests__/review.test.ts`. Update the relative import path from `'../review'` (unchanged since the test moves one level deeper alongside the source).
8. Ensure the `meta.name` field in `resolveCmd` stays `'resolve'` and in `reviewCmd` stays `'review'` (citty uses these for help output within the group).
9. Remove the now-empty original files after moving (no stale files left behind).

## Dependencies
- `citty` framework's `defineCommand` and `subCommands` — already used throughout the codebase.
- No changes to `@internal/*` packages are required; all imports in `resolve.ts` and `review.ts` use package-level paths (`@internal/builders`, `@internal/integrations`, etc.) that are unaffected by the move.

## Implementation Approach
1. Create `packages/cli/src/cmd/pr/` directory and `packages/cli/src/cmd/pr/__tests__/` directory.
2. Move `resolve.ts` and `review.ts` into `packages/cli/src/cmd/pr/`.
3. Move `resolve.test.ts` and `review.test.ts` into `packages/cli/src/cmd/pr/__tests__/`.
4. Create `packages/cli/src/cmd/pr/index.ts` following the `auth/index.ts` pattern:
   - `defineCommand` with `meta: { name: 'pr', description: 'Manage pull requests' }`
   - `subCommands` with lazy imports for `resolve` and `review`
5. Update `packages/cli/src/index.ts` — replace the two lazy-import entries with a single `pr` entry.
6. Delete the original `packages/cli/src/cmd/resolve.ts` and `packages/cli/src/cmd/review.ts`.
7. Run `bun typecheck` to verify no broken imports.
8. Run `bun test packages/cli/src/cmd/pr/__tests__/resolve.test.ts` and `bun test packages/cli/src/cmd/pr/__tests__/review.test.ts` to verify tests pass.
9. Run `bun lint` and `bun fmt` to ensure code style compliance.

## Acceptance Criteria

1. **PR subcommand group exists**
   - Given the CLI is built
   - When the user runs `ody pr --help`
   - Then help output lists `resolve` and `review` as available subcommands

2. **PR review works at new path**
   - Given valid configuration and a GitHub PR URL
   - When the user runs `ody pr review <GITHUB_PR_URL>`
   - Then the review command executes identically to the old `ody review` behavior

3. **PR resolve works at new path**
   - Given valid configuration and a GitHub PR comment URL
   - When the user runs `ody pr resolve <GITHUB_COMMENT_URL>`
   - Then the resolve command executes identically to the old `ody resolve` behavior

4. **Old commands are removed**
   - Given the CLI is built
   - When the user runs `ody resolve` or `ody review`
   - Then the CLI does not recognize the command (shows unknown command error or general help)

5. **Tests pass at new location**
   - Given the test files have been moved to `packages/cli/src/cmd/pr/__tests__/`
   - When `bun test` is run
   - Then all existing resolve and review tests pass without modification to test logic

6. **No stale files remain**
   - Given the refactor is complete
   - When inspecting `packages/cli/src/cmd/`
   - Then `resolve.ts` and `review.ts` no longer exist at the top level, and no orphaned test files remain in `packages/cli/src/cmd/__tests__/` for these commands

7. **CI checks pass**
   - Given all changes are applied
   - When `bun lint`, `bun fmt`, and `bun typecheck` are run
   - Then all pass with no errors

## Metadata
- **Complexity**: Low
- **Labels**: cli, refactor, commands
