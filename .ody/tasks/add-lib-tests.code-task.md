---
status: completed
created: 2026-02-11
started: 2026-02-12
completed: 2026-02-12
---
# Task: Add Unit Tests for lib Directory

## Description
Add comprehensive unit tests for all modules in `./packages/cli/src/lib/` — covering `config.ts`, `logger.ts`, `notify.ts`, and `sequencer.ts`. Tests should be placed in a new `__tests__` directory within `lib`, following the same conventions established in `util/__tests__/`.

## Background
The `lib` directory contains four core utility modules used throughout the CLI:
- **config.ts** — Configuration loading, parsing (via Zod), and access (namespace with `load`, `parse`, `all`, `get`)
- **logger.ts** — Consola logger instance with a fatal-exit reporter
- **notify.ts** — Cross-platform desktop notification sender (macOS/Linux)
- **sequencer.ts** — Simple incrementing counter factory

The `util/__tests__` directory already has tests using Bun's native test runner (`bun:test`). The lib modules currently have zero test coverage. Adding tests here improves confidence in the configuration system, notification logic, and small utilities.

## Technical Requirements
1. Create the directory `packages/cli/src/lib/__tests__/`
2. Add test files: `config.test.ts`, `logger.test.ts`, `notify.test.ts`, `sequencer.test.ts`
3. Use `bun:test` imports (`describe`, `test`, `expect`, `mock`, `spyOn`, `beforeEach`, `afterEach`) — no external test frameworks
4. Mock external side effects (file system reads via `Bun.file`, shell via `bun` tagged template `$`, `process.exit`, `process.platform`) rather than hitting real I/O
5. Use `mock.module` for module-level mocks (e.g., mocking `bun`'s `$` export in notify tests)
6. All tests must pass via `bun test`

## Dependencies
- `bun:test` — Bun's built-in test framework (already configured in the project)
- `zod` — Used by `config.ts` for schema validation; tests should exercise schema edge cases
- `@clack/prompts` — Used by `config.ts` for `log.error`; spy on it to suppress output and verify calls
- `consola` — Used by `logger.ts` via `createConsola`; test the reporter behavior
- `bun` shell (tagged template `$`) — Used by `notify.ts`; must be mocked via `mock.module` to avoid real OS notifications

## Implementation Approach

### 1. Create `packages/cli/src/lib/__tests__/` directory with four test files

### 2. `sequencer.test.ts` — Pure-function tests (simplest, do first)
- Default initial value starts at 0, first `next()` returns 1
- Custom initial value (e.g., 10) — first `next()` returns 11
- Multiple sequential calls return incrementing values (1, 2, 3)
- Multiple independent sequencers maintain separate state

### 3. `config.test.ts` — Test the `Config` namespace
Focus on `Config.parse` (pure Zod validation) and the access guards (`Config.all`, `Config.get`).

**`Config.parse` — valid input:**
- Valid full config with `backend: 'claude'`, `maxIterations: 5` succeeds and returns typed object
- Applies defaults: `shouldCommit` → false, `tasksDir` → `'tasks'`, `notify` → false, `skipPermissions` → true
- `maxIterations: 0` is valid (schema uses `.nonnegative()`)
- Each valid backend (`'opencode'`, `'claude'`, `'codex'`) succeeds
- Valid `notify` variants: `true`, `false`, `'all'`, `'individual'`
- Optional fields can be omitted (`model`, `validatorCommands`, `skipPermissions`, `tasksDir`, `notify`)

**`Config.parse` — invalid input:**
- Missing `backend` throws ZodError
- Missing `maxIterations` throws ZodError
- Invalid `backend` value (e.g., `'invalid-backend'`) throws ZodError
- `maxIterations` as negative number throws ZodError
- `maxIterations` as float (e.g., `1.5`) throws ZodError
- `backend` as empty string throws ZodError

**Access guards (`Config.all`, `Config.get`):**
- `Config.all()` throws `Error('Config not loaded')` when config is unset
- `Config.get('backend')` throws `Error('Config not loaded')` when config is unset
- Spy on `log.error` from `@clack/prompts` to verify it is called before the throw
- **Important:** The `Config` namespace holds module-level mutable state (`let config`). Since there is no public `reset` method, tests must either:
  - Reset internal state between tests using `mock.module` to re-import the module fresh, OR
  - Accept test ordering constraints and group guard tests before any loading tests
  - The simplest approach: test the guard behavior by importing a fresh module via `mock.module` or by testing guards in a separate `describe` block that runs before any `parse`/`load` calls

### 4. `notify.test.ts` — Test `sendNotification`
The function uses the `$` tagged template from `bun` to run shell commands. Mock strategy:
- Use `mock.module('bun', ...)` to replace the `$` export with a mock function
- Mock `process.platform` by overriding the property via `Object.defineProperty`

**Test cases:**
- On `darwin`, the mock `$` is called and the template includes `osascript` and the title/message
- On `linux`, the mock `$` is called and the template includes `notify-send` and the title/message
- On unsupported platform (e.g., `win32`), `$` is never called — function resolves without error
- When `$` rejects/throws, the function still resolves without throwing (error swallowed by try/catch)

**Note on `.quiet()`:** The real code chains `.quiet()` on the shell result. The mock must return an object with a `.quiet()` method that returns a resolved promise.

### 5. `logger.test.ts` — Test the logger instance
- Logger is defined and has expected properties
- `logger.level` equals 4
- The fatal reporter calls `process.exit(1)` when a log entry with `type: 'fatal'` is processed
  - Mock `process.exit` via `spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); })` to prevent actual exit
  - Call `logger.fatal('test')` and verify `process.exit` was called with `1`

## Acceptance Criteria

1. **Sequencer tests pass**
   - Given a new sequencer with default initial value
   - When `next()` is called three times
   - Then the return values are 1, 2, 3

2. **Config parse validates correctly**
   - Given a raw object with `backend: 'claude'` and `maxIterations: 5`
   - When `Config.parse` is called
   - Then it returns a valid `OdyConfig` object with defaults applied

3. **Config parse rejects invalid input**
   - Given a raw object with `backend: 'invalid-backend'`
   - When `Config.parse` is called
   - Then a Zod validation error is thrown

4. **Config access guards work**
   - Given config has not been loaded
   - When `Config.all()` or `Config.get('backend')` is called
   - Then an error is thrown with message `'Config not loaded'`

5. **Notification sends platform-appropriate command**
   - Given `process.platform` is mocked as `'darwin'`
   - When `sendNotification('Title', 'Body')` is called
   - Then the mocked `$` is invoked and the template string contains `osascript`

6. **Notification is no-op on unsupported platforms**
   - Given `process.platform` is mocked as `'win32'`
   - When `sendNotification('Title', 'Body')` is called
   - Then the mocked `$` is never called and the function resolves

7. **Notification swallows errors**
   - Given the mocked shell command rejects
   - When `sendNotification` is called
   - Then no error is thrown and the promise resolves

8. **Logger is properly configured**
   - Given the logger module is imported
   - When its properties are inspected
   - Then `logger.level` is 4

9. **Logger fatal reporter triggers exit**
   - Given `process.exit` is mocked
   - When `logger.fatal('test')` is called
   - Then `process.exit` was called with `1`

10. **All tests pass**
    - Given the full test suite
    - When `bun test` is run
    - Then all tests pass with zero failures

## Metadata
- **Complexity**: Medium
- **Labels**: testing, lib, unit-tests
