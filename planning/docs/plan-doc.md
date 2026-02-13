# Plan: `ody plan` Documentation Page (Parent Command Overview)

## Overview

Write the documentation page for `ody plan` as an MDX file at `packages/docs/content/docs/commands/plan/index.mdx`. This is a parent command that groups task planning subcommands. The page serves as an overview and navigation hub for the four subcommands: `new`, `list`, `edit`, and `compact`.

---

## Command Breakdown

### What `ody plan` Does

`ody plan` is not an executable command on its own -- it is a parent command that groups four subcommands for managing task plans:

| Subcommand         | Description                                                                |
| ------------------ | -------------------------------------------------------------------------- |
| `ody plan new`     | Create a new task plan by having the agent generate a `.code-task.md` file |
| `ody plan list`    | List all pending tasks                                                     |
| `ody plan edit`    | Edit an existing task plan using the agent                                 |
| `ody plan compact` | Archive completed tasks into a historical record and delete the originals  |

Running `ody plan` without a subcommand displays help text with the available subcommands.

### Shared Flags

The parent `plan` command defines two flags that are inherited by all subcommands:

| Flag        | Alias | Type      | Default | Description                                 |
| ----------- | ----- | --------- | ------- | ------------------------------------------- |
| `--dry-run` | `-d`  | `boolean` | `false` | Run without sending the prompt to the agent |
| `--verbose` | —     | `boolean` | `false` | Stream the agent's work-in-progress output  |

### Task File Lifecycle

The plan subcommands manage `.code-task.md` files through a lifecycle:

1. **`plan new`** -- Creates a task with `status: pending`.
2. **`plan edit`** -- Modifies an existing task (any status).
3. **`run`** -- Picks up `pending` tasks, sets them to `in_progress`, then `completed`.
4. **`plan list`** -- Shows tasks still at `status: pending`.
5. **`plan compact`** -- Archives `completed` tasks and deletes the originals.

### Task File Format

All task files follow this structure:

```markdown
---
status: pending
created: 2025-02-11
started: null
completed: null
---

# Task: Concise Task Name

## Description

What needs to be implemented and why.

## Background

Context and background information.

## Technical Requirements

1. First requirement
2. Second requirement

## Dependencies

- First dependency
- Second dependency

## Implementation Approach

1. First step
2. Second step

## Acceptance Criteria

1. **Criterion Name**
   - Given precondition
   - When action
   - Then expected result

## Metadata

- **Complexity**: Low/Medium/High
- **Labels**: comma-separated labels
```

### Directory Structure

Task files live in `.ody/tasks/` by default (configurable via `tasksDir` in config). Archived tasks are written to `.ody/history/`.

---

## Fumadocs Components to Use

### 1. Cards / Card

**Where**: Primary navigation to each subcommand. This is the most important component on this page.

```mdx
<Cards>
  <Card title="plan new" href="/docs/commands/plan/new">
    Create a new task plan with the agent
  </Card>
  <Card title="plan list" href="/docs/commands/plan/list">
    List all pending tasks
  </Card>
  <Card title="plan edit" href="/docs/commands/plan/edit">
    Edit an existing task plan
  </Card>
  <Card title="plan compact" href="/docs/commands/plan/compact">
    Archive completed tasks
  </Card>
</Cards>
```

### 2. Steps / Step

**Where**: Illustrate the full task lifecycle from creation through archival.

Walk through the lifecycle:

1. Create a task plan (`plan new`)
2. Review pending tasks (`plan list`)
3. Optionally refine a plan (`plan edit`)
4. Execute the task (`run`)
5. Archive completed tasks (`plan compact`)

### 3. TypeTable

**Where**: Document the shared parent flags.

```mdx
<TypeTable
  type={{
    '--dry-run / -d': {
      type: 'boolean',
      default: 'false',
      description: 'Run without sending the prompt to the agent',
    },
    '--verbose': {
      type: 'boolean',
      default: 'false',
      description: "Stream the agent's work-in-progress output to stdout",
    },
  }}
/>
```

### 4. Files / Folder / File

**Where**: Show the `.ody/` directory structure for task management.

```mdx
<Files>
  <Folder name=".ody" defaultOpen>
    <File name="ody.json" />
    <File name="progress.txt" />
    <Folder name="tasks" defaultOpen>
      <File name="add-auth.code-task.md" />
      <File name="fix-tests.code-task.md" />
    </Folder>
    <Folder name="history">
      <File name="archive-2025-02-11.md" />
    </Folder>
  </Folder>
</Files>
```

### 5. Callout

**Where**: A few informational notes.

- **`type="info"`**: Note that `ody plan` itself doesn't execute anything -- it requires a subcommand.
- **`type="info"`**: Explain that the `tasksDir` config option can change where tasks are stored (default: `tasks`).

### 6. Code Blocks (built-in)

**Where**: Show the full task file template with a titled code block:

````mdx
```markdown title=".ody/tasks/example.code-task.md"
---
status: pending
created: 2025-02-11
started: null
completed: null
---

# Task: Example Task

...
```
````

### 7. Accordions / Accordion

**Where**: FAQ section.

- "Do I need to create task files manually?" -- No, `ody plan new` has the agent generate them. But you can create them manually if they follow the format.
- "Where are tasks stored?" -- `.ody/tasks/` by default, configurable via `tasksDir` in config.
- "What happens to completed tasks?" -- They stay in the tasks directory until you run `ody plan compact` to archive them.

---

## Page Structure (Section Outline)

```
---
title: ody plan
description: Plan and manage task files for the agent
---

## Overview
  Brief description: parent command for task planning.
  <Callout type="info"> that it requires a subcommand.

## Subcommands
  <Cards> linking to each subcommand page.

## Shared Flags
  <TypeTable> with --dry-run and --verbose.

## Task Lifecycle
  <Steps> illustrating the full create-list-edit-run-compact flow.

## Task File Format
  Code block with the full task file template.

## Directory Structure
  <Files> showing .ody/tasks/ and .ody/history/.
  <Callout type="info"> about tasksDir config.

## FAQ
  <Accordions> with common questions.
```

---

## Notes

- Source: `packages/cli/src/cmd/plan/index.ts` (28 lines -- just defines the parent and registers subcommands).
- This page is primarily a navigation hub. Most detail belongs on the individual subcommand pages.
- The task file format section is important here because it's shared context for all subcommands. Individual subcommand pages can reference back to this page rather than repeating the full template.
- The lifecycle steps section is unique to this page and provides the conceptual glue between the subcommands and `ody run`.
