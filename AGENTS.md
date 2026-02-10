# AGENTS

Guidance for agentic coding in this repository.
Focus on Bun + TypeScript CLI tooling.

## Repo summary

- Structure: Bun workspaces monorepo (`packages/*`).
- Runtime: Bun (Bun APIs used in code).
- Language: TypeScript with ESM (`type: module`).
- CLI package: `packages/cli` (package name `@ody/cli`).
- Entry point: `packages/cli/src/index.ts`.
- CLI framework: `citty` commands in `packages/cli/src/cmd`.
- Backends live in `packages/cli/src/backends` and implement `Harness`.
- Prompt building lives in `packages/cli/src/builders/prompt.ts`.
- Shared utilities in `packages/cli/src/lib` and `packages/cli/src/util`.
- Config is stored under `.ody/ody.json` in the project root.
- Agent prompt template lives in `.ody/prompt.md`.
- Shared TypeScript config: root `tsconfig.json` (packages extend it).
- Formatter: `oxfmt` (see `.oxfmtrc.json` at root).
- Linter: `oxlint` (see `.oxlintrc.json` at root).

## Commands

### Install

- `bun install`

### Run (dev)

- `bun run index.ts` (as documented in `README.md`).
- `bun run src/index.ts` (explicit entry path if needed, from `packages/cli`).

### Build (compile binary)

- `bun run build` (from root, runs build across all workspaces).
- `bun run build` (from `packages/cli`, builds just the CLI).
- Output: `packages/cli/dist/ody` (native executable built from `src/index.ts`).

### Lint

- `bunx oxlint .`
- Scope to source only: `bunx oxlint src` (from `packages/cli`).

### Format

- `bunx oxfmt -w .`
- Scope to source only: `bunx oxfmt -w src` (from `packages/cli`).

### Tests

- No tests or `test` script are currently configured.
- If you add Bun tests: run all with `bun test`.
- Run a single test file with `bun test path/to/file.test.ts`.

## Configuration

- `Config.load()` must run before any `Config.get()` or `Config.all()`.
- Config schema is defined with `zod` in `packages/cli/src/lib/config.ts`.
- Current keys in `.ody/ody.json`:
- `backend`: one of `opencode`, `claude`, `codex`.
- `maxIterations`: number of loop iterations.
- `shouldCommit`: boolean toggling git commit behavior for agents.
- `validatorCommands`: array of shell commands to validate work.
- Prefer updating config via the CLI (`ody init`) when possible.

## Code style and conventions

### Imports

- Use ESM `import`/`export`; avoid `require`.
- Prefer `import type` for type-only imports.
- Put `import type` statements at the top of the file.
- Group imports: external + Node builtins first, blank line, then internal.
- Keep relative imports (`./` or `../`) within `src`.
- No path aliases are currently used.

### Formatting

- Single quotes for strings (enforced by `oxfmt`).
- Semicolons are used.
- Trailing commas in multi-line objects/arrays/params.
- Two-space indentation (current code style).
- Let `oxfmt` handle layout rather than manual formatting.

### Types

- Prefer `type` aliases for shapes; use `interface` only if needed.
- Avoid `any` except at system boundaries (e.g., JSON parsing).
- Use `zod` for runtime validation and parsing.
- Keep function return types inferred unless public API clarity is needed.
- Use `import type` when referencing types across modules.

### Naming

- `PascalCase` for classes (e.g., `Backend`).
- `camelCase` for functions, variables, and class members.
- `UPPER_SNAKE_CASE` for constants (e.g., `BASE_DIR`).
- File names are lower-case and match their primary export.

### Error handling

- Wrap external I/O and process calls in `try/catch`.
- Use `log` from `@clack/prompts` for messaging.
- If a fatal condition must continue the stack, throw after logging.
- For recoverable errors, prefer `log.warn` or `log.error`.

### Logging

- Prefer `log` from `@clack/prompts` over `console.*`.
- In CLI flows, log start/end messages for long operations.

### Async and process control

- Use `async/await` instead of raw promise chains.
- For spawned processes, use `Bun.spawn` and `await proc.exited`.
- Stream output with `TextDecoder` when reading `proc.stdout`.
- Always close loops or break when completion markers appear.

### Collections and flow

- Use `const` by default; use `let` only when reassignment is needed.
- Keep functions small; extract helpers when logic grows.
- Prefer early returns to reduce nesting.

### CLI command structure

- Use `defineCommand` from `citty`.
- Provide `meta` with `name` and `description`.
- Define `args` with `type`, `default`, and `description`.
- Use `setup` for async configuration loading.
- Use `run` for the command action.

### Files and I/O

- Prefer `Bun.file()` for reads and `Bun.write()` for writes.
- Use `fs/promises` for filesystem tasks not covered by Bun.
- Use `path` for path joins instead of string concatenation.

### Prompts and sequencing

- The agent prompt is built in `packages/cli/src/builders/prompt.ts`.
- Ordering uses `createSequencer()` from `packages/cli/src/lib/sequencer.ts`.
- Maintain the single-feature focus and completion marker behavior.

## Lint/format configuration

- Lint config: `.oxlintrc.json` (currently minimal).
- Format config: `.oxfmtrc.json` (single quotes, import sorting).
- `experimentalSortImports.internalPattern` uses `~/*`.

## Cursor/Copilot rules

- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` found.

## When adding new code

- Keep new modules under `src/` and export via direct imports.
- Update CLI commands only through `src/cmd/*`.
- Add new backends under `src/backends` extending `Harness`.
- Add tests (if any) under `src/` with `.test.ts` suffix.
- Update `README.md` if run/build instructions change.

## Notes

- Update this file if new tooling or rules are added.

## Agent safety notes

- Do not edit `.ody/ody.json` unless a task requires it.
- Avoid committing generated `ody` binary unless requested.
- Respect `shouldCommit` behavior when running agents.

## Quick checks

- `bun run build` to validate build output.
- `bun lint` to validate lint.
- `bun fmt` to normalize formatting.
- `bun test path/to/file.test.ts` for a single test file (if tests exist).
