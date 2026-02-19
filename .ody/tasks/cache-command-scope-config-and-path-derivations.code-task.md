---
status: completed
created: 2026-02-19
started: 2026-02-19
completed: 2026-02-19
---
# Task: Cache Command-Scope Config and Path Derivations

## Description
Reduce repeated config/path derivation overhead in hot command paths by computing immutable command-scope values once and reusing them.

## Background
Commands and utilities repeatedly call `Config.get(...)` and recompute joined paths such as tasks directory paths across loops and helper calls (`run`, prompt builders, and task utilities). The overhead is small per call but becomes measurable in iterative loops and high-frequency operations. Centralizing and reusing command-scope values improves efficiency and makes data flow clearer.

## Technical Requirements
1. Identify repeated config/path derivations in hot command flows (`run`, `plan`, `task import`, task utilities).
2. Compute immutable values once per command execution (for example: resolved tasks directory path, notify setting normalization, validation command string).
3. Thread precomputed values through helper functions where appropriate instead of re-reading config globally.
4. Preserve all existing behavior and command outputs.
5. Avoid introducing mutable global caches that could cause stale config across runs.
6. Keep refactor small and localized to avoid readability regressions.
7. Add/adjust tests where behavior contract is touched.

## Dependencies
- `packages/cli/src/cmd/run.ts` -- iterative hot path with repeated derived values.
- `packages/cli/src/cmd/plan.ts` -- repeated task directory derivation on multiple plan generations.
- `packages/cli/src/cmd/task/import.ts` -- command-scoped config/path values.
- `packages/cli/src/builders/runPrompt.ts` -- repeated prompt derivation inputs from config.
- `packages/cli/src/util/task.ts` -- task directory resolution utilities.

## Implementation Approach
1. Audit command-level repeated `Config.get` and path joins.
2. Introduce local constants for resolved values at command start.
3. Refactor utility signatures where needed to accept resolved path/config context.
4. Keep `Config.load` lifecycle unchanged and avoid process-wide mutable caches.
5. Validate that command outputs and behavior are unchanged after refactor.

## Acceptance Criteria

1. **Repeated derivations are reduced**
   - Given hot command paths
   - When reviewing code after refactor
   - Then repeated config/path recomputation is replaced by command-scope reuse

2. **No stale global caching introduced**
   - Given multiple CLI invocations with potentially different configs
   - When commands run
   - Then behavior reflects current loaded config without cross-run stale state

3. **Functional behavior remains identical**
   - Given current command usage patterns
   - When running key commands (`run`, `plan`, `task import`)
   - Then outputs and side effects remain consistent

4. **Prompt generation still uses correct inputs**
   - Given run prompt construction
   - When command-scope values are supplied
   - Then generated prompts still include correct tasks dir, validation commands, and shouldCommit values

5. **Refactor is covered by existing or updated tests**
   - Given related unit tests
   - When executed
   - Then tests pass without regressions

## Metadata
- **Complexity**: Low
- **Labels**: performance, config, refactor, cli
