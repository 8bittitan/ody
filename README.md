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

