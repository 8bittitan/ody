---
status: pending
created: 2026-02-10
started: null
completed: null
---
# Task: Add Unit Tests for Util Modules

## Description
Introduce the first test suite for the repository, covering all modules in `packages/cli/src/util`. This establishes the testing foundation for the project using Bun's built-in test runner and provides coverage for the three utility modules: `constants.ts`, `stream.ts`, and `inputPrompt.ts`.

## Background
The repository currently has zero test files and no configured `test` script. The `AGENTS.md` notes that "No tests or `test` script are currently configured" and recommends using `bun test` if tests are added. The `packages/cli/src/util` directory contains three small, self-contained modules that are ideal candidates for the first test suite:

- **`constants.ts`** — Exports five string/array constants (`BASE_DIR`, `ODY_FILE`, `PRD_FILE`, `TASKS_DIR`, `ALLOWED_BACKENDS`).
- **`stream.ts`** — Exports a `Stream` namespace with a `toOutput` method that consumes a `ReadableStream`, optionally printing chunks and invoking an `onChunk` callback.
- **`inputPrompt.ts`** — Exports `getRandomValidatorPlaceholder()` which returns a random command string from a hardcoded list.

## Technical Requirements
1. Use Bun's built-in test framework (`bun:test`) — `describe`, `test`, `expect`, `mock`, `spyOn`, and related APIs.
2. Place test files adjacent to their source files using the `.test.ts` suffix convention (e.g., `packages/cli/src/util/constants.test.ts`).
3. Create one test file per source module (three test files total).
4. Tests must be runnable via `bun test packages/cli/src/util` from the project root.
5. Do not introduce any external test dependencies — Bun's test runner is sufficient.
6. Mock external side effects (e.g., `@clack/prompts` logging in `stream.ts`) to keep tests isolated and fast.

## Dependencies
- **Bun runtime** — Already the project runtime; `bun:test` is built-in and requires no installation.
- **`@clack/prompts`** — Used inside `stream.ts`; its `log.message` call should be mocked in tests to avoid terminal output and to assert print behavior.

## Implementation Approach
1. **Create `packages/cli/src/util/constants.test.ts`**
   - Verify each exported constant has the expected value and type.
   - Verify `ALLOWED_BACKENDS` contains exactly the three expected backend strings.
   - Verify none of the constants are accidentally `undefined` or empty.

2. **Create `packages/cli/src/util/stream.test.ts`**
   - Mock `@clack/prompts` `log.message` to capture print calls without terminal output.
   - Test `Stream.toOutput` with a simple `ReadableStream` that emits known chunks and verify the accumulated output.
   - Test the `shouldPrint: true` option and assert that `log.message` is called for each non-empty chunk.
   - Test the `onChunk` callback receives the accumulated string after each chunk.
   - Test early termination by returning `true` from `onChunk` and verify the stream stops consuming.
   - Test with an empty stream and confirm it returns an empty string.

3. **Create `packages/cli/src/util/inputPrompt.test.ts`**
   - Test that `getRandomValidatorPlaceholder()` returns a string.
   - Test that the returned value is always one of the known placeholder commands.
   - Call the function multiple times and verify all results are within the expected set.
   - Mock `Math.random` to force specific indices and verify deterministic output for edge cases (first element, last element).

4. **Verify all tests pass**
   - Run `bun test packages/cli/src/util` from the project root and confirm zero failures.
   - Run `bun test` from the project root to ensure no regressions or configuration issues.

## Acceptance Criteria

1. **Constants are tested for correctness**
   - Given the `constants.ts` module is imported in its test file
   - When the test suite runs
   - Then all five constants (`BASE_DIR`, `ODY_FILE`, `PRD_FILE`, `TASKS_DIR`, `ALLOWED_BACKENDS`) are verified to have their expected values and types

2. **Stream.toOutput accumulates output correctly**
   - Given a `ReadableStream` that emits the chunks `["hello ", "world"]`
   - When `Stream.toOutput` is called with that stream
   - Then the returned promise resolves to `"hello world"`

3. **Stream.toOutput prints when shouldPrint is true**
   - Given a `ReadableStream` with non-empty chunks and `shouldPrint: true`
   - When `Stream.toOutput` is called
   - Then `@clack/prompts` `log.message` is called for each non-empty chunk

4. **Stream.toOutput supports early termination via onChunk**
   - Given a `ReadableStream` with multiple chunks and an `onChunk` callback that returns `true` after the first chunk
   - When `Stream.toOutput` is called
   - Then the stream stops consuming after the first chunk and returns only that content

5. **getRandomValidatorPlaceholder returns valid commands**
   - Given the `inputPrompt.ts` module is imported
   - When `getRandomValidatorPlaceholder()` is called repeatedly
   - Then every returned value is one of the six known placeholder command strings

6. **All tests pass via Bun test runner**
   - Given the three test files exist in `packages/cli/src/util/`
   - When `bun test packages/cli/src/util` is run from the project root
   - Then all tests pass with zero failures

## Metadata
- **Complexity**: Low
- **Labels**: testing, util, bun, foundation
