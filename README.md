# ody

An agentic task orchestrator that delegates structured development work to AI coding agents. Describe what you need done, let ody generate a task plan, then run the agent loop to have it implemented automatically.

ody works with multiple AI backends (Claude Code, OpenCode, Codex) and manages the full lifecycle: planning tasks, executing them via an agent, validating results, and optionally committing changes.

## Requirements

- [Bun](https://bun.sh) v1.3.8+
- At least one supported AI coding agent installed and on your `$PATH`:
  - [`claude`](https://docs.anthropic.com/en/docs/claude-code) (Claude Code)
  - [`opencode`](https://opencode.ai) (OpenCode)
  - [`codex`](https://github.com/openai/codex) (Codex)

## Installation

### Install script (recommended)

The fastest way to install `ody`. The script auto-detects your OS and architecture, fetches the latest release binary, and places it on your system:

```bash
curl -fsSL https://raw.githubusercontent.com/8bittitan/ody/main/install.sh | sh
```

By default the binary is installed to `$HOME/.local/bin`. To customize the install location, set `ODY_INSTALL_DIR`:

```bash
ODY_INSTALL_DIR=/usr/local/bin curl -fsSL https://raw.githubusercontent.com/8bittitan/ody/main/install.sh | sh
```

### Download a release binary

Pre-built binaries are available on the [GitHub Releases](https://github.com/8bittitan/ody/releases) page. Download the binary for your platform:

- `ody-darwin-arm64` -- macOS Apple Silicon
- `ody-darwin-x64` -- macOS Intel
- `ody-linux-x64` -- Linux x86_64
- `ody-linux-arm64` -- Linux ARM64

After downloading, make it executable and move it to a directory on your `$PATH`:

```bash
chmod +x ody-darwin-arm64
mv ody-darwin-arm64 /usr/local/bin/ody
```

### Build from source

Requires [Bun](https://bun.sh) v1.3.8+.

```bash
git clone https://github.com/8bittitan/ody.git
cd ody
bun install
bun run build
```

The compiled binary is output to `packages/cli/dist/ody`.

## Quick start

Once installed (see [Installation](#installation) above), initialize ody in your project and start using it:

```bash
# Initialize ody in your project (interactive)
ody init

# Create a task plan
ody plan

# Run the agent loop
ody run
```

If running from a cloned source checkout instead, use `bun run packages/cli/src/index.ts` in place of `ody`:

```bash
bun install
bun run packages/cli/src/index.ts init
bun run packages/cli/src/index.ts plan
bun run packages/cli/src/index.ts run
```

## Build

Compile a native binary:

```bash
bun run build
```

This produces `packages/cli/dist/ody`. Once built you can use the compiled binary directly:

```bash
packages/cli/dist/ody init
packages/cli/dist/ody plan
packages/cli/dist/ody run
```

## How it works

1. **Plan** -- `ody plan` prompts you for a description and sends it to the AI backend, which generates structured `.code-task.md` files under the configured tasks directory (default `.ody/tasks/`).
2. **Run** -- `ody run` starts a loop that picks pending tasks, sends them to the configured backend, monitors for a completion marker, runs validator commands, marks tasks as completed, and optionally git-commits changes.
3. **Repeat** -- The loop continues until all pending tasks are done or the iteration limit is reached.

## CLI commands

### `ody init`

Set up ody for the current project. Creates `.ody/` and writes `ody.json`.

| Flag              | Alias | Description                                           |
| ----------------- | ----- | ----------------------------------------------------- |
| `--backend`       | `-b`  | Agent backend: `claude`, `opencode`, or `codex`       |
| `--maxIterations` | `-i`  | Max loop iterations (0 = unlimited)                   |
| `--model`         | `-m`  | Model to use for the backend                          |
| `--shouldCommit`  | `-c`  | Commit after each completed task                      |
| `--agent`         | `-a`  | Agent profile/persona for the backend harness         |
| `--notify`        | `-n`  | Notification preference: `false`, `all`, `individual` |
| `--dry-run`       |       | Print config without saving                           |

### `ody run [taskFile]`

Run the agent loop.

| Flag           | Alias        | Description                             |
| -------------- | ------------ | --------------------------------------- |
| `taskFile`     | (positional) | Path to a specific `.code-task.md` file |
| `--verbose`    |              | Stream agent output to terminal         |
| `--label`      | `-l`         | Filter tasks by label                   |
| `--iterations` | `-i`         | Override max iterations                 |
| `--no-notify`  |              | Disable OS notifications for this run   |

### `ody plan [planFile]`

Generate task plans.

- Without a positional file argument, enters an interactive loop where you describe tasks and the AI generates `.code-task.md` files.
- With a positional `planFile`, reads that planning document and generates one or more task files.

| Flag        | Alias        | Description                                         |
| ----------- | ------------ | --------------------------------------------------- |
| `planFile`  | (positional) | Path to a planning document to decompose into tasks |
| `--dry-run` | `-d`         | Print prompt without sending to agent               |
| `--verbose` |              | Stream agent output                                 |

### `ody task list`

List all pending tasks.

### `ody task edit`

Edit an existing task plan interactively. Presents a selectable list of tasks, then opens the configured backend harness in interactive/TUI mode with the selected task context and edit prompt preloaded.

| Flag        | Alias | Description                           |
| ----------- | ----- | ------------------------------------- |
| `--dry-run` | `-d`  | Print prompt without sending to agent |

### `ody task import`

Import a task from an external source and generate a `.code-task.md` file.

| Flag        | Alias  | Description                                              |
| ----------- | ------ | -------------------------------------------------------- |
| `--jira`    |        | Jira ticket key or URL (for example `PROJ-123`)          |
| `--github`  | `--gh` | GitHub issue URL or shorthand (for example `org/repo#1`) |
| `--dry-run` | `-d`   | Print prompt without sending to agent                    |
| `--verbose` |        | Stream agent output                                      |

### `ody compact`

Archive completed tasks and progress into `.ody/history/YYYY-MM-DD/`.

- Writes archived tasks to `tasks.md`
- Writes progress entries to `progress.md`
- Deletes archived completed task files from the active tasks directory
- Clears `.ody/progress.txt`

### `ody config`

Display the current configuration.

### `ody auth`

Manage authentication credentials for external integrations.

#### `ody auth jira`

Store Jira credentials (email + API token). Supports `--profile` (defaults to `default`).

#### `ody auth github`

Store GitHub credentials (personal access token). Supports `--profile` (defaults to `default`).

#### `ody auth list`

List configured Jira/GitHub profiles (tokens are masked).

### `ody update`

Check for and install CLI updates from GitHub Releases.

| Flag      | Alias | Description                                   |
| --------- | ----- | --------------------------------------------- |
| `--check` | `-c`  | Check only; do not download/install an update |

## Configuration

Configuration lives in `.ody/ody.json` (per-project). A global config can also be placed at `~/.ody/ody.json` or `~/.config/ody/ody.json`; local settings override global ones.

| Key                 | Type                                        | Description                                                   |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| `backend`           | `"claude"` \| `"opencode"` \| `"codex"`     | Which AI backend to use                                       |
| `maxIterations`     | number                                      | Max loop iterations (0 = unlimited)                           |
| `shouldCommit`      | boolean                                     | Git-commit after each task                                    |
| `validatorCommands` | string[]                                    | Shell commands to validate agent work                         |
| `model`             | string \| `{ run?: string; plan?: string; edit?: string }` | Default model or per-command model overrides                  |
| `skipPermissions`   | boolean                                     | Skip Claude Code permission checks (default `true`)           |
| `agent`             | string                                      | Backend agent profile/persona (default `"build"`)             |
| `tasksDir`          | string                                      | Subdirectory under `.ody/` for task files (default `"tasks"`) |
| `notify`            | boolean \| `"all"` \| `"individual"`        | OS notification behavior                                      |
| `jira`              | `{ baseUrl: string; profile?: string }`     | Jira integration settings                                     |
| `github`            | `{ profile?: string }`                      | GitHub integration settings                                   |

Prefer using `ody init` to generate or update configuration.

`notify: true` is treated as `"all"` at runtime.

## Task file format

Tasks are Markdown files (`.code-task.md`) with YAML frontmatter and required sections.

```markdown
---
status: pending
created: 2026-02-12
started: null
completed: null
---

# Task: Add example feature

## Description

A clear description of what needs to be implemented and why.

## Background

Relevant context and background information.

## Technical Requirements

1. First requirement
2. Second requirement

## Dependencies

- Dependency details

## Implementation Approach

1. First implementation step
2. Second implementation step

## Acceptance Criteria

1. **Example Criterion**
   - Given some precondition
   - When an action happens
   - Then an expected result occurs

## Metadata

- **Complexity**: Medium
- **Labels**: example, feature
```

The `status` field transitions through `pending` -> `in_progress` -> `completed` as the agent works.

## Project structure

```
packages/
  cli/                        # @ody/cli -- the main CLI package
    src/
      index.ts                # Entry point
      cmd/                    # CLI commands (citty)
      backends/               # Backend adapters (claude, opencode, codex)
      builders/               # Prompt templates for run/plan/edit
      lib/                    # Config, sequencer, logger, notifications
      util/                   # Stream handling, constants, helpers
    dist/                     # Build output (native binary)
  docs/                       # @ody/docs -- documentation site/assets
```

The repo is a Bun workspaces monorepo (`packages/*`).

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
