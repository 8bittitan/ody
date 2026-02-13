# Plan: `ody run` Documentation Page

## Overview

Write the documentation page for `ody run` as an MDX file at `packages/docs/content/docs/commands/run.mdx`. This is the core command of the CLI -- it executes the agent loop that picks up task files and implements them. The page must document both execution modes (loop and once), all flags, the completion marker mechanism, notification behavior, task file targeting, and label filtering.

---

## Command Breakdown

### What `ody run` Does

1. Loads the Ody configuration and instantiates the configured backend (OpenCode, Claude, or Codex).
2. Resolves which tasks to run:
   - **No arguments**: The agent scans `.ody/tasks/` for `.code-task.md` files with `status: pending` and picks the highest-priority one.
   - **Positional `taskFile` argument**: Runs a single specific `.code-task.md` file.
   - **`--label` flag**: Filters tasks by a label found in the `**Labels**:` line of the task body.
   - `taskFile` and `--label` are mutually exclusive -- the command exits with an error if both are provided.
3. Builds a run prompt via `buildRunPrompt()` which instructs the agent to:
   - Find the next pending task (or the specified one).
   - Update its frontmatter to `status: in_progress`.
   - Implement the task following its Technical Requirements and Implementation Approach.
   - Run validator commands (if configured).
   - Update frontmatter to `status: completed`.
   - Append a progress note to `.ody/progress.txt`.
   - Optionally create a git commit (if `shouldCommit` is true and validators pass).
4. Executes in one of two modes:
   - **`--once` mode**: Spawns the backend process once with a pseudo-terminal (PTY), streams output directly to stdout. The process is killed when the `<woof>COMPLETE</woof>` marker is detected.
   - **Loop mode** (default): Spawns the backend process repeatedly up to `maxIterations` (0 = unlimited). Each iteration pipes stdout/stderr, watches for the completion marker. A spinner shows progress unless `--verbose` is set.
5. Sends OS notifications based on the `notify` config setting (overridable with `--no-notify`).

### Flags

| Flag           | Alias | Type                     | Default     | Description                                                         |
| -------------- | ----- | ------------------------ | ----------- | ------------------------------------------------------------------- |
| `taskFile`     | —     | positional               | —           | Path to a specific `.code-task.md` file to run                      |
| `--verbose`    | —     | `boolean`                | `false`     | Stream agent output to stdout in real-time                          |
| `--once`       | —     | `boolean`                | `false`     | Run a single iteration instead of the loop                          |
| `--dry-run`    | —     | `boolean`                | `false`     | Print the command that would be executed (only valid with `--once`) |
| `--label`      | `-l`  | `string`                 | —           | Filter tasks by label                                               |
| `--iterations` | `-i`  | `string` (parsed to int) | from config | Override the number of loop iterations (0 = unlimited)              |
| `--no-notify`  | —     | `boolean`                | `false`     | Disable OS notifications even if enabled in config                  |

### Execution Modes

#### Once Mode (`--once`)

- Spawns a single backend process with a pseudo-terminal (PTY).
- Terminal dimensions match the current shell (`process.stdout.columns` x `process.stdout.rows`).
- Output is written directly to stdout in real-time (interactive terminal feel).
- When `<woof>COMPLETE</woof>` is detected in the output stream, the process is killed.
- Exits with the backend process's exit code.
- Supports `--dry-run` to inspect the command without executing.

#### Loop Mode (default)

- Spawns the backend process repeatedly, up to `maxIterations` iterations (0 = unlimited).
- Each iteration uses piped stdio (`['ignore', 'pipe', 'pipe']`), not a PTY.
- Output is consumed via `Stream.toOutput()`:
  - If `--verbose` is set, output is printed to stdout.
  - Otherwise a spinner shows progress.
- When `<woof>COMPLETE</woof>` is detected, the loop breaks.
- If running a single task file (positional arg), `maxIterations` defaults to `1`.
- `--iterations` flag overrides the config value.

### Completion Marker

The agent signals task completion by outputting `<woof>COMPLETE</woof>` in its stdout stream. This is how Ody knows the agent has finished:

- In once mode: the PTY data callback accumulates output and checks for the marker.
- In loop mode: the `Stream.toOutput()` `onChunk` callback checks the accumulated buffer.
- The marker is emitted by the agent when all pending tasks are done (loop) or the specific task is done (single task).

### Notification Behavior

Notifications are controlled by the `notify` config setting:

| Config value      | Behavior                                         |
| ----------------- | ------------------------------------------------ |
| `false` (default) | No notifications                                 |
| `"all"`           | Single notification when the entire run finishes |
| `"individual"`    | Notification after each loop iteration completes |

The `--no-notify` flag overrides any config setting and disables all notifications. Notifications use `osascript` on macOS and `notify-send` on Linux.

### Task File Format

Task files must end with `.code-task.md` and live in the tasks directory (`.ody/tasks/` by default). They contain YAML frontmatter with `status`, `created`, `started`, and `completed` fields, followed by Markdown content with Description, Technical Requirements, Implementation Approach, and Metadata sections.

### Label Filtering

When `--label` is used, Ody scans all `.code-task.md` files for a `**Labels**: ...` line in the body. Labels are comma-separated. Only tasks matching the given label (case-insensitive) are passed to the agent prompt. If no tasks match, the command exits with a warning.

---

## Fumadocs Components to Use

### 1. Tabs / Tab

**Where**: Show the two execution modes side by side.

Use `<Tabs items={['Loop Mode', 'Once Mode']}>` with a `<Tab>` for each mode. Each tab contains:

- A description of the mode
- An example invocation code block
- Behavioral differences (PTY vs piped stdio, spinner vs streamed output)

Also use tabs for usage examples:

````mdx
```bash tab="Basic"
ody run
```

```bash tab="Single task"
ody run .ody/tasks/add-auth.code-task.md
```

```bash tab="By label"
ody run --label auth
```

```bash tab="Once mode"
ody run --once --verbose
```

```bash tab="Dry run"
ody run --once --dry-run
```
````

### 2. TypeTable

**Where**: Document each CLI flag.

```mdx
<TypeTable
  type={{
    taskFile: {
      type: 'string (positional)',
      description: 'Path to a specific .code-task.md file to run',
    },
    '--verbose': {
      type: 'boolean',
      default: 'false',
      description: 'Stream agent output to stdout in real-time',
    },
    '--once': {
      type: 'boolean',
      default: 'false',
      description: 'Run a single iteration instead of the loop',
    },
    '--dry-run': {
      type: 'boolean',
      default: 'false',
      description: 'Print the command without executing (only with --once)',
    },
    '--label / -l': {
      type: 'string',
      description: 'Filter tasks by label from task file metadata',
    },
    '--iterations / -i': {
      type: 'string',
      default: 'from config',
      description: 'Override max loop iterations. 0 = unlimited',
    },
    '--no-notify': {
      type: 'boolean',
      default: 'false',
      description: 'Disable OS notifications even if enabled in config',
    },
  }}
/>
```

### 3. Steps / Step

**Where**: Document the agent's workflow within a single iteration.

Walk through what the agent does when it runs:

1. Find the next pending task (or the specified one)
2. Set task status to `in_progress`
3. Implement the task
4. Run validator commands
5. Set task status to `completed`
6. Append progress note
7. Optionally create a git commit
8. Output `<woof>COMPLETE</woof>` when finished

### 4. Callout

**Where**: Multiple locations.

- **`type="warn"`**: On `--dry-run` -- note it only works with `--once`.
- **`type="warn"`**: On `taskFile` and `--label` -- note they are mutually exclusive.
- **`type="info"`**: On the completion marker -- explain how it works and that it's required for the loop to terminate.
- **`type="info"`**: On `--iterations` -- when a single task file is passed, `maxIterations` defaults to `1` (not the config value).
- **`type="info"`**: On notifications -- macOS uses `osascript`, Linux uses `notify-send`; silently ignored on other platforms.

### 5. Accordions / Accordion

**Where**: FAQ section.

- "How does the agent know when to stop?" -- explain `<woof>COMPLETE</woof>` marker.
- "What's the difference between `--once` and `--iterations 1`?" -- once mode uses PTY with direct terminal output; loop mode with iterations=1 uses piped stdio and a spinner.
- "Can I run tasks from a different directory?" -- explain `tasksDir` config option.
- "What happens if a validator command fails?" -- the agent is instructed to fix failures on its own; the commit is skipped if validators still fail.
- "How are labels matched?" -- case-insensitive match against comma-separated `**Labels**:` line in task body.

### 6. Cards / Card

**Where**: Related pages at the bottom.

```mdx
<Cards>
  <Card title="ody init" href="/docs/commands/init">
    Set up Ody configuration before running
  </Card>
  <Card title="ody plan new" href="/docs/commands/plan/new">
    Create task files for the agent to execute
  </Card>
  <Card title="Configuration" href="/docs/configuration">
    Configure maxIterations, validators, and notification settings
  </Card>
</Cards>
```

### 7. Files / Folder / File

**Where**: Show the task directory structure and output files.

```mdx
<Files>
  <Folder name=".ody" defaultOpen>
    <File name="ody.json" />
    <File name="progress.txt" />
    <Folder name="tasks" defaultOpen>
      <File name="add-auth.code-task.md" />
      <File name="fix-tests.code-task.md" />
    </Folder>
  </Folder>
</Files>
```

### 8. Code Blocks (built-in)

**Where**: Throughout the page.

- Titled code blocks for the run prompt template (show what gets sent to the agent)
- Example task file with YAML frontmatter
- Dry run JSON output example

---

## Page Structure (Section Outline)

```
---
title: ody run
description: Execute the agent loop to implement task plans
---

## Overview
  Brief description: the core command that executes tasks.
  <Callout type="info"> about requiring ody init first.

## Usage
  Code block tab group with common invocations.

## Flags
  <TypeTable> with all flags documented.
  <Callout type="warn"> about taskFile and --label being mutually exclusive.
  <Callout type="warn"> about --dry-run only working with --once.

## Execution Modes
  <Tabs items={['Loop Mode', 'Once Mode']}>
    Loop mode description, behavior, spinner, iteration control.
    Once mode description, PTY behavior, dry-run support.

## Agent Workflow
  <Steps> showing what the agent does in each iteration.

## Task Files
  <Files> showing the .ody/ directory structure.
  Brief description of the .code-task.md format and frontmatter fields.

## Label Filtering
  How --label works, case-insensitive matching, the **Labels** line format.

## Completion Marker
  <Callout type="info"> explaining <woof>COMPLETE</woof>.
  How it differs between once mode and loop mode.

## Notifications
  Table of notification config values and behavior.
  <Callout type="info"> about platform support (macOS / Linux).

## Related
  <Cards> linking to ody init, ody plan new, configuration.

## FAQ
  <Accordions> with common questions.
```

---

## Notes

- All content is derived from `packages/cli/src/cmd/run.ts`, `packages/cli/src/builders/runPrompt.ts`, `packages/cli/src/util/task.ts`, `packages/cli/src/util/stream.ts`, and `packages/cli/src/lib/notify.ts`.
- The run prompt template (loop vs single-task) should be shown to help users understand what instructions the agent receives.
- The `<woof>COMPLETE</woof>` marker is critical to document clearly -- it's the mechanism that controls loop termination.
- The `taskFile` positional argument sets `maxIterations` to `1` implicitly; this is an important behavioral detail to call out.
