# ody

ody is a Bun + TypeScript CLI for running agent-style workflows against configurable backends. It includes prompt building, a simple command system, and backend adapters so you can run the CLI locally or build a native binary.

## Requirements

- Bun v1.3.8

## Quick start

Install dependencies:

```bash
bun install
```

Run the CLI:

```bash
bun run src/index.ts
```

## CLI commands

Run commands with `./ody` after a build, or use `bun run src/index.ts` in development.

- `--help` displays usage definitions
- `init` initializes `.ody` configuration in the current project
  - Options: `--backend/-b`, `--dir/-d`, `--maxIterations/-i`, `--provider/-p`, `--model/-m`, `--shouldCommit/-c`
- `run` executes the agent loop
  - Options: `--verbose`, `--once`, `--dry-run` (only with `--once`)
- `task new` creates a task entry in `.ody/prd.json`
  - Options: `--category`

Example:

```bash
bun run src/index.ts --help
bun run src/index.ts init
bun run src/index.ts run --once
bun run src/index.ts task new
```

## Build

Compile a native executable:

```bash
bun run build
```

Output binary:

```bash
./ody
```

## Configuration

- `.ody/ody.json` stores runtime settings (backend choice, iteration limits, validators)
- `.ody/prompt.md` is the prompt template
- Prefer generating or updating config via the CLI (`ody init`) when available

## Project structure

- `src/index.ts` entry point
- `src/cmd` CLI commands
- `src/backends` backend implementations
- `src/builders/prompt.ts` prompt assembly
- `src/lib` and `src/util` shared utilities

## Development

Lint:

```bash
bun lint
```

Format:

```bash
bun fmt
```

Tests:

- No tests are configured yet
