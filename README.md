# ody

An agentic task orchestrator that delegates structured development work to AI coding agents. Describe what you need done, let ody generate a task plan, then run the agent loop to have it implemented automatically.

ody works with multiple AI backends (Claude Code, OpenCode, Codex) and manages the full lifecycle: planning tasks, executing them via an agent, validating results, and optionally committing changes.

## Requirements

- [Bun](https://bun.sh) v1.3.8+
- At least one supported AI coding agent installed and on your `$PATH`:
  - [`claude`](https://docs.anthropic.com/en/docs/claude-code) (Claude Code)
  - [`opencode`](https://opencode.ai) (OpenCode)
  - [`codex`](https://github.com/openai/codex) (Codex)

## Quick start

```bash
# Install dependencies
bun install

# Initialize ody in your project (interactive)
bun run packages/cli/src/index.ts init

# Create a task plan
bun run packages/cli/src/index.ts plan new

# Run the agent loop
bun run packages/cli/src/index.ts run
```

## Build

Compile a native binary:

```bash
bun run build
```

This produces `packages/cli/dist/ody`. Once built you can use `./ody` instead of the `bun run ...` invocations above:

```bash
./ody init
./ody plan new
./ody run
```

## How it works

1. **Plan** -- `ody plan new` prompts you for a description and sends it to the AI backend, which generates a structured `.code-task.md` file under `.ody/tasks/` with frontmatter, requirements, implementation steps, and acceptance criteria.
2. **Run** -- `ody run` starts a loop that picks pending tasks, sends them to the configured backend, monitors for a completion marker, runs validator commands, marks tasks as completed, and optionally git-commits changes.
3. **Repeat** -- The loop continues until all pending tasks are done or the iteration limit is reached.

## CLI commands

### `ody init`

Set up ody for the current project. Creates `.ody/` and writes `ody.json`.

| Flag | Alias | Description |
|---|---|---|
| `--backend` | `-b` | Agent backend: `claude`, `opencode`, or `codex` |
| `--maxIterations` | `-i` | Max loop iterations (0 = unlimited) |
| `--model` | `-m` | Model to use for the backend |
| `--shouldCommit` | `-c` | Commit after each completed task |
| `--notify` | `-n` | Notification preference: `false`, `all`, `individual` |
| `--dry-run` | | Print config without saving |

### `ody run [taskFile]`

Run the agent loop.

| Flag | Alias | Description |
|---|---|---|
| `taskFile` | (positional) | Path to a specific `.code-task.md` file |
| `--verbose` | | Stream agent output to terminal |
| `--once` | | Run a single interactive iteration |
| `--dry-run` | | Print command without executing (requires `--once`) |
| `--label` | `-l` | Filter tasks by label |
| `--iterations` | `-i` | Override max iterations |
| `--no-notify` | | Disable OS notifications for this run |

### `ody plan new`

Generate a new task plan from a description.

| Flag | Alias | Description |
|---|---|---|
| `--dry-run` | `-d` | Print prompt without sending to agent |
| `--verbose` | | Stream agent output |

### `ody plan edit`

Edit an existing task plan interactively.

### `ody plan list`

List all pending tasks.

### `ody plan compact`

Archive completed tasks to `.ody/history/` and delete the originals.

### `ody config`

Display the current configuration.

## Configuration

Configuration lives in `.ody/ody.json` (per-project). A global config can also be placed at `~/.ody/ody.json` or `~/.config/ody/ody.json`; local settings override global ones.

| Key | Type | Description |
|---|---|---|
| `backend` | `"claude"` \| `"opencode"` \| `"codex"` | Which AI backend to use |
| `maxIterations` | number | Max loop iterations (0 = unlimited) |
| `shouldCommit` | boolean | Git-commit after each task |
| `validatorCommands` | string[] | Shell commands to validate agent work |
| `model` | string | Model identifier for the backend |
| `skipPermissions` | boolean | Skip Claude Code permission checks (default `true`) |
| `tasksDir` | string | Subdirectory under `.ody/` for task files (default `"tasks"`) |
| `notify` | boolean \| `"all"` \| `"individual"` | OS notification behavior |

Prefer using `ody init` to generate or update configuration.

## Task file format

Tasks are Markdown files (`.code-task.md`) with YAML frontmatter:

```markdown
---
status: pending
created: 2026-02-12
started: null
completed: null
---

# Task title

## Description
...

## Acceptance Criteria
...
```

The `status` field transitions through `pending` -> `in_progress` -> `completed` as the agent works.

## Project structure

```
packages/
  cli/                        # @ody/cli -- the main (and only) package
    src/
      index.ts                # Entry point
      cmd/                    # CLI commands (citty)
      backends/               # Backend adapters (claude, opencode, codex)
      builders/               # Prompt templates for run/plan/edit
      lib/                    # Config, sequencer, logger, notifications
      util/                   # Stream handling, constants, helpers
    dist/                     # Build output (native binary)
```

The repo is a Bun workspaces monorepo (`packages/*`), currently containing only the CLI package.

## Development

```bash
# Lint
bun lint

# Format
bun fmt

# Type check
bun typecheck

# Run tests
bun test
```

## License

See [LICENSE](LICENSE) for details.
