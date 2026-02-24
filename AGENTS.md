# AGENTS

Guidance for agentic coding in this repository.

## Repo summary

- **Monorepo**: Bun workspaces — `packages/*` (cli, desktop, docs) and `internal/*` (shared libs).
- **Runtime**: Bun (uses Bun APIs: `Bun.spawn`, `Bun.file`, `Bun.write`, `Bun.Glob`).
- **Language**: TypeScript with ESM (`type: module`), strict mode enabled.
- **CLI package**: `packages/cli` (`@ody/cli`), entry point `packages/cli/src/index.ts`.
- **Desktop package**: `packages/desktop` (`@ody/desktop`), Electron + React + TailwindCSS.
- **Docs package**: `packages/docs` (`@ody/docs`), Next.js 16 + fumadocs.
- **Internal packages** (shared by cli and desktop):
  - `@internal/config` — config loading, schema (zod v4), constants.
  - `@internal/auth` — credential storage (Jira, GitHub).
  - `@internal/backends` — `Harness` abstract class + `Backend` wrapper (Claude, Opencode, Codex).
  - `@internal/builders` — prompt template construction.
  - `@internal/tasks` — task file parsing, frontmatter, label filtering.
  - `@internal/integrations` — Jira, GitHub API clients, HTTP retry utilities.
- **CLI framework**: `citty` — commands in `packages/cli/src/cmd/`.
- **Config**: `.ody/ody.json` (local) merged with `~/.ody/ody.json` (global). Schema validated with zod.
- **Formatter**: `oxfmt` (config: `.oxfmtrc.json`).
- **Linter**: `oxlint` with plugins: `unicorn`, `typescript`, `oxc` (config: `.oxlintrc.json`).

## Commands

### Install

- `bun install`

### Build

- `bun run build` — builds all workspace packages.
- `bun run build:cli` — builds only `@ody/cli` (output: `packages/cli/dist/ody`).

### Lint

- `bun lint` — run oxlint across the repo.
- `bun lint:fix` — auto-fix lint issues.

### Format

- `bun fmt` — format all files with oxfmt.

### Typecheck

- `bun typecheck` — typecheck all workspace packages.
- CLI uses `bunx tsgo --noEmit`; other packages use `bunx tsc --noEmit`.

### Tests

- `bun test` — run all tests across workspaces (via `bun run --filter '*' test`).
- `bun test path/to/file.test.ts` — run a single test file.
- Example: `bun test packages/cli/src/util/__tests__/stream.test.ts`
- Test framework: `bun:test` (built-in: `describe`, `test`, `expect`, `mock`, `spyOn`).
- Tests live in `__tests__/` directories adjacent to source, named `<module>.test.ts`.

### Run (dev)

- `bun run src/index.ts` (from `packages/cli`) — run the CLI in dev mode.

## Code style and conventions

### Imports

- ESM `import`/`export` only; no `require`.
- Use `import type` for type-only imports, placed at the top of the file.
- Order: external/Node builtins first, blank line, then `@internal/*`, then relative (`./`/`../`).
- `oxfmt` auto-sorts imports; internal patterns: `~/*` and `@internal/*`.

### Formatting

- Single quotes for strings.
- Semicolons required.
- Trailing commas in multi-line constructs.
- Two-space indentation.
- Let `oxfmt` handle layout — run `bun fmt` before committing.

### Types

- Prefer `type` aliases; use `interface` only when extension is needed.
- Avoid `any` except at system boundaries (e.g., JSON parsing).
- Use `zod` (v4) for runtime validation and schema definition.
- Keep return types inferred unless public API clarity requires them.
- `verbatimModuleSyntax` is enabled — `import type` is mandatory for type-only imports.

### Naming

- `PascalCase` for classes and type aliases (e.g., `Backend`, `OdyConfig`).
- `camelCase` for functions, variables, and members.
- `UPPER_SNAKE_CASE` for constants (e.g., `BASE_DIR`, `TASKS_DIR`).
- File names: lower-case, matching primary export (e.g., `config.ts`, `stream.ts`).

### Patterns

- **Namespace pattern**: core modules export a TypeScript `namespace` grouping related functions and types (`Config`, `Auth`, `Jira`, `GitHub`, `Http`, `Stream`).
- **Abstract class + wrapper**: `Harness` (abstract) is subclassed by each backend; `Backend` wraps a `Harness` with config-derived defaults.
- **Lazy subcommands**: CLI uses `() => import('./cmd/x').then(m => m.xCmd)` for code-splitting.
- **Prompt templates**: template strings with `{PLACEHOLDER}` tokens replaced via `.replace()`.
- **Completion marker**: `<woof>COMPLETE</woof>` signals agent task completion.

### Error handling

- Wrap external I/O and process calls in `try/catch`.
- Use `log` from `@clack/prompts` for user-facing messages.
- Fatal errors: `log.error()` then `process.exit(1)`.
- Recoverable errors: `log.warn` or `log.error` without exit.
- `outro` from `@clack/prompts` only at the end of a happy path or on prompt cancellation.

### Async and process control

- `async/await` over raw promise chains.
- `Bun.spawn` for subprocesses; `await proc.exited` for completion.
- Stream output via `TextDecoder` when reading `proc.stdout`.
- Non-interactive: `stdio: ['ignore', 'pipe', 'pipe']`. Interactive: `['inherit', 'inherit', 'inherit']`.

### Files and I/O

- `Bun.file()` for reads, `Bun.write()` for writes.
- `Bun.Glob` for directory traversal.
- `path.join()` for path construction — no string concatenation.
- `fs/promises` only when Bun APIs don't cover the operation.

### CLI command structure

- `defineCommand` from `citty` with `meta` (`name`, `description`), `args`, `setup`, `run`.
- `setup` handles async config loading; `run` contains the command action.
- `Config.load()` must run before `Config.get()` or `Config.all()`.

## CI pipeline

CI runs on PRs to `main` and pushes to `main` (`.github/workflows/ci.yml`):
- **lint**: `bun lint`
- **test**: `bun run test`
- **type-check**: `bun typecheck`

## Quick checks

Run before pushing:
- `bun lint` — validate lint.
- `bun fmt` — normalize formatting.
- `bun typecheck` — check types across all packages.
- `bun test` — run all tests.

## When adding new code

- New modules go under `src/` in the appropriate package.
- New CLI commands: `packages/cli/src/cmd/`.
- New backends: `internal/backends/src/` extending `Harness`.
- New shared logic: appropriate `internal/` package.
- Tests: `__tests__/<module>.test.ts` alongside the source file.
- Update `README.md` if run/build instructions change.

## Rules

- NEVER update multiple packages within `packages/` unless explicitly asked.
- Do not edit `.ody/ody.json` unless a task requires it.
- Do not commit the generated `ody` binary unless requested.
- Respect `shouldCommit` config when running agents.
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` exist.

## MCPs

When you need to search docs, use `context7` tools.
