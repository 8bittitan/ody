---
status: completed
created: 2026-03-09
started: 2026-03-10
completed: 2026-03-10
---
# Task: Make Plan Command Interactive by Default

## Description
Invert the plan command's default behavior so that running `ody plan` (with no flags and no positional argument) launches the agent interactively — the way `-i` / `--interactive` works today. Add a new `--yolo` flag that triggers the current default behavior (collect descriptions via the clack TUI, then run the agent non-interactively in the background). Remove the `-i` / `--interactive` flag entirely.

## Background
The `plan` command currently has three modes:
1. **Default** (no flags, no positional arg) — prompts the user via `@clack/prompts` to type task descriptions, then spawns the backend non-interactively with piped stdio per description.
2. **Interactive** (`-i`) — launches the backend interactively with inherited stdio so the user can converse with the agent directly.
3. **Batch** (positional `planFile` arg) — reads a planning document and spawns the backend non-interactively.

Interactive mode is the more useful default because it lets the agent ask clarifying questions and decompose work collaboratively. The current default (background execution per description) is better suited for a "fire and forget" workflow, which the `--yolo` flag name captures.

## Technical Requirements
1. Remove the `interactive` arg definition from the `defineCommand` args object in `packages/cli/src/cmd/plan.ts`.
2. Add a `yolo` arg: `type: 'boolean'`, no alias, default `false`, description along the lines of "Skip interactive mode — prompt for descriptions and generate plans in the background".
3. Restructure the `run` function's branching:
   - **Batch mode** (positional `planFile` provided): unchanged, takes precedence over everything.
   - **Yolo mode** (`--yolo` flag, no `planFile`): execute the current default-mode logic (clack TUI loop → non-interactive backend per description).
   - **Default** (no flags, no `planFile`): execute the current interactive-mode logic (build interactive prompt, spawn backend with inherited stdio).
4. Re-export `buildInteractivePlanPrompt` from `internal/builders/src/index.ts` so it can be imported through the barrel instead of directly from the source file. Update the import in `plan.ts` accordingly.
5. `--dry-run` and `--verbose` remain in the arg definitions but only apply to yolo and batch modes (they are irrelevant when stdio is inherited). No validation needed — they are simply unused in interactive mode.

## Dependencies
- `packages/cli/src/cmd/plan.ts` — the command definition and all three execution branches.
- `internal/builders/src/index.ts` — barrel exports for prompt builders.
- `internal/builders/src/planPrompt.ts` — contains `buildInteractivePlanPrompt` (read-only, no changes needed).

## Implementation Approach
1. In `internal/builders/src/index.ts`, add `buildInteractivePlanPrompt` to the re-exports from `./planPrompt`.
2. In `packages/cli/src/cmd/plan.ts`:
   - Remove the `interactive` arg.
   - Add the `yolo` arg (`type: 'boolean'`, default `false`).
   - Update the import of `buildInteractivePlanPrompt` to come from `@internal/builders` instead of `@internal/builders/src/planPrompt`.
   - Reorder the `run` function branching: batch first (unchanged), then `args.yolo` triggers the existing clack-TUI-then-background logic, then the `else` default triggers the existing interactive logic.
3. Verify no other files reference the `--interactive` or `-i` flag for the plan command (docs, tests, other commands).

## Acceptance Criteria

1. **Interactive by default**
   - Given the user runs `ody plan` with no flags and no positional argument
   - When the command executes
   - Then the backend is launched interactively with inherited stdio, identical to the previous `-i` behavior

2. **Yolo flag triggers background mode**
   - Given the user runs `ody plan --yolo`
   - When the command executes
   - Then the clack TUI prompts for task descriptions and the backend runs non-interactively per description, identical to the previous default behavior

3. **Interactive flag removed**
   - Given the user runs `ody plan -i` or `ody plan --interactive`
   - When the command executes
   - Then citty reports an unknown flag error

4. **Batch mode unchanged**
   - Given the user runs `ody plan ./some-plan.md`
   - When the command executes
   - Then batch mode runs regardless of whether `--yolo` is also passed

5. **Dry-run works with yolo**
   - Given the user runs `ody plan --yolo --dry-run`
   - When the command executes
   - Then the generated prompt is logged without spawning the backend

6. **Barrel export updated**
   - Given a consumer imports from `@internal/builders`
   - When they reference `buildInteractivePlanPrompt`
   - Then the function is available without reaching into the internal source path

## Metadata
- **Complexity**: Low
- **Labels**: cli, plan, ux
