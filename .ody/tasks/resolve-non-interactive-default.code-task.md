---
status: completed
created: 2026-03-11
started: 2026-03-11
completed: 2026-03-11
---
# Task: Make Resolve Command Non-Interactive by Default

## Description
Change the `ody resolve` command so it spawns the backend harness in a non-interactive piped process by default (matching how the `run` command works), instead of launching an interactive terminal session. Add an `--interactive` / `-i` flag to opt into the current interactive behavior, and a `--verbose` / `-v` flag to control whether agent output is streamed to the terminal.

## Background
The `resolve` command currently defaults to interactive mode (`stdio: ['inherit', 'inherit', 'inherit']` with `buildInteractiveCommand`), while the `run` command uses piped non-interactive execution (`stdio: ['ignore', 'pipe', 'pipe']` with `buildCommand`). The resolve command should align with the run command's execution model for consistency, reserving interactive mode as an explicit opt-in.

The command lives at `packages/cli/src/cmd/resolve.ts` and uses a dependency-injection pattern via `ResolveDeps` for testability. The existing `executeResolveDryRun` function already implements piped execution, and `executeResolveInteractive` handles the interactive path. The `--dry-run` flag only affects the prompt content (preview vs. actual changes) and should remain unchanged.

## Technical Requirements
1. Add `--interactive` / `-i` boolean arg (default `false`) to the `resolveCmd` args definition.
2. Add `--verbose` / `-v` boolean arg (default `false`) to the `resolveCmd` args definition.
3. Change the default execution path in `runResolve` to use non-interactive piped execution (`buildCommand`, `stdio: ['ignore', 'pipe', 'pipe']`).
4. When running non-interactively (the new default and dry-run), show a `@clack/prompts` spinner. Hide the spinner when `--verbose` is active, and instead stream agent output to the terminal.
5. When `--interactive` is passed, use the current interactive behavior (`buildInteractiveCommand`, `stdio: ['inherit', 'inherit', 'inherit']`).
6. When `--interactive` and `--dry-run` are both passed, log a warning that `--dry-run` is ignored when using interactive mode, then proceed with interactive execution.
7. Completion detection: check exit code only (no `<woof>COMPLETE</woof>` marker detection). This matches current behavior.
8. Update the `ResolveArgs` type to include the new `interactive` and `verbose` fields.
9. Extend the `ResolveDeps` type to support the new execution function signature for non-interactive runs (accepting verbose/spinner concerns), or refactor the existing `executeDryRun` / `executeInteractive` deps to accommodate the three modes cleanly.
10. Pass `interactive` and `verbose` args through from the `resolveCmd` `run` handler to `runResolve`.

## Dependencies
- `@clack/prompts` `spinner` — already used by the `run` command; import it in `resolve.ts`.
- `Stream.toOutput` from `../util/stream` — already imported and used in the dry-run path.
- Existing `Backend.buildCommand` and `Backend.buildInteractiveCommand` methods — no changes needed.

## Implementation Approach
1. Add the two new args (`interactive`, `verbose`) to the `resolveCmd` args definition in the `defineCommand` call, following the same pattern as `dry-run`.
2. Update `ResolveArgs` to include `interactive?: boolean` and `verbose?: boolean`.
3. Introduce a new default execution function (e.g., `executeResolveNonInteractive`) that:
   - Accepts a `verbose` boolean parameter.
   - Spawns the backend with `buildCommand` and piped stdio.
   - When not verbose: creates and starts a `@clack/prompts` spinner.
   - Streams stdout and stderr through `Stream.toOutput` with `shouldPrint` tied to the `verbose` flag.
   - Stops the spinner on completion (or on error with the failure message).
   - Returns the exit code.
4. Update the `ResolveDeps` type — add a new dep (e.g., `executeNonInteractive`) or refactor the existing `executeDryRun` dep to accept verbose/spinner options. The dry-run path and default path both use non-interactive execution; they differ only in the prompt content. Consider unifying them under a single non-interactive executor that takes a `verbose` flag.
5. Refactor the control flow in `runResolve`:
   - If `interactive` and `dryRun` are both true: `deps.log.warn(...)` about dry-run being ignored, then run interactive.
   - If `interactive`: run interactive (current behavior).
   - If `dryRun`: log info, run non-interactive with the dry-run prompt.
   - Default: run non-interactive with the normal prompt.
6. Update the `resolveCmd` `run` handler to pass `interactive` and `verbose` from parsed args to `runResolve`.
7. Update existing tests for `runResolve` to cover the new default behavior and flag combinations.

## Acceptance Criteria

1. **Default non-interactive execution**
   - Given the user runs `ody resolve <url>` without `--interactive`
   - When the backend harness executes
   - Then it spawns with piped stdio (`['ignore', 'pipe', 'pipe']`) using `buildCommand`, and a spinner is shown

2. **Verbose output streaming**
   - Given the user runs `ody resolve <url> --verbose`
   - When the backend harness executes non-interactively
   - Then agent stdout and stderr are printed to the terminal, and no spinner is shown

3. **Interactive flag**
   - Given the user runs `ody resolve <url> --interactive`
   - When the backend harness executes
   - Then it spawns with inherited stdio (`['inherit', 'inherit', 'inherit']`) using `buildInteractiveCommand`

4. **Interactive short flag**
   - Given the user runs `ody resolve <url> -i`
   - When the backend harness executes
   - Then it behaves identically to `--interactive`

5. **Dry-run unchanged**
   - Given the user runs `ody resolve <url> --dry-run`
   - When the backend harness executes
   - Then it spawns non-interactively with the dry-run prompt, respecting `--verbose` for output

6. **Interactive + dry-run warning**
   - Given the user runs `ody resolve <url> --interactive --dry-run`
   - When the command starts
   - Then a warning is logged that `--dry-run` is ignored in interactive mode, and the command proceeds interactively

7. **Non-zero exit code handling**
   - Given the backend process exits with a non-zero code
   - When running in any mode
   - Then the CLI exits with that same code

8. **Existing tests updated**
   - Given the existing test suite for `runResolve`
   - When tests are run
   - Then all tests pass, covering the new default path, `--interactive`, `--verbose`, and flag combinations

## Metadata
- **Complexity**: Medium
- **Labels**: cli, resolve, refactor
