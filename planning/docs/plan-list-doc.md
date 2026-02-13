# Plan: `ody plan list` Documentation Page

## Overview

Write the documentation page for `ody plan list` as an MDX file at `packages/docs/content/docs/commands/plan/list.mdx`. This is a simple read-only command that scans the tasks directory and displays all pending tasks. The page is short but should use Fumadocs components for consistency.

---

## Command Breakdown

### What `ody plan list` Does

1. Resolves the tasks directory (`.ody/tasks/` by default, or the path set by `tasksDir` in config).
2. Scans for all `*.code-task.md` files using `Bun.Glob`.
3. For each file, parses the YAML frontmatter and checks if `status` is `pending`.
4. Extracts the title from the first `# Task: ...` or `# ...` heading.
5. Displays the count and a list of pending tasks with their titles and filenames.
6. If no task files exist at all, prints "No task files found."
7. If task files exist but none are pending, prints "No pending tasks."

### Flags

None. This command takes no flags or positional arguments.

### Output Format

```
Found 3 pending task(s):

  - Add email validation  (add-email-validation.code-task.md)
  - Fix test suite  (fix-test-suite.code-task.md)
  - Refactor auth module  (refactor-auth-module.code-task.md)
```

### Filtering Behavior

The command only shows tasks with `status: pending` in their YAML frontmatter. Tasks with `status: in_progress` or `status: completed` are excluded. This means:

- Tasks currently being worked on by the agent won't appear.
- Completed tasks won't appear (use `ody plan compact` to archive them).

### Title Parsing

Titles are extracted from the Markdown heading using the regex `/^#\s+(?:Task:\s*)?(.+)$/m`. This means:

- `# Task: Add Email Validation` extracts "Add Email Validation"
- `# Add Email Validation` also extracts "Add Email Validation"
- If no heading is found, the title defaults to "Untitled"

---

## Fumadocs Components to Use

### 1. Callout

**Where**: Multiple locations.

- **`type="info"`**: Note that only `pending` tasks are shown. Tasks that are `in_progress` or `completed` are excluded.
- **`type="info"`**: If the tasks directory doesn't exist or is empty, the command exits gracefully with an informational message.

### 2. Code Blocks (built-in)

**Where**: Usage example and sample output.

````mdx
```bash title="Terminal"
ody plan list
```
````

Titled code block for example output.

### 3. Cards / Card

**Where**: Related pages.

```mdx
<Cards>
  <Card title="ody plan new" href="/docs/commands/plan/new">
    Create new task plans to show up in this list
  </Card>
  <Card title="ody run" href="/docs/commands/run">
    Execute pending tasks
  </Card>
  <Card title="ody plan compact" href="/docs/commands/plan/compact">
    Archive completed tasks that no longer appear here
  </Card>
</Cards>
```

### 4. Tabs / Tab

**Where**: Show the different output states.

Use `<Tabs items={['Pending tasks found', 'No pending tasks', 'No task files']}>` to show the three possible outputs:

```
// Pending tasks found
Found 3 pending task(s):
  - Add email validation  (add-email-validation.code-task.md)
  ...

// No pending tasks
No pending tasks.

// No task files
No task files found.
```

### 5. Accordions / Accordion

**Where**: FAQ section.

- "Why don't I see my in-progress task?" -- Only `pending` tasks are shown. If the agent set a task to `in_progress`, it won't appear.
- "Where does the command look for tasks?" -- `.ody/tasks/` by default, or the `tasksDir` path from config.
- "Can I see all tasks regardless of status?" -- Not with this command. You'd need to inspect the `.ody/tasks/` directory directly.

---

## Page Structure (Section Outline)

```
---
title: ody plan list
description: List all pending task plans
---

## Overview
  Brief description of the command.
  <Callout type="info"> about pending-only filtering.

## Usage
  Code block with invocation.

## Output
  <Tabs> showing the three possible output states.

## Related
  <Cards> linking to plan new, run, and plan compact.

## FAQ
  <Accordions> with common questions.
```

---

## Notes

- Source: `packages/cli/src/cmd/plan/list.ts` (52 lines -- simple command).
- This page should be concise. The command does one thing with no flags.
- It's a good entry point for users checking on their task queue, so the Related section should clearly point to the natural next steps (run tasks, create new ones, archive old ones).
