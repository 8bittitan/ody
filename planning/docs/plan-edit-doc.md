# Plan: `ody plan edit` Documentation Page

## Overview

Write the documentation page for `ody plan edit` as an MDX file at `packages/docs/content/docs/commands/plan/edit.mdx`. This command lets the user select an existing task plan and have the configured backend agent modify it in place. The page should document the interactive flow, the edit prompt, flags, and how the file is preserved.

---

## Command Breakdown

### What `ody plan edit` Does

1. Resolves the tasks directory (`.ody/tasks/` by default).
2. Scans for all `*.code-task.md` files using `Bun.Glob`.
3. If no task files exist, prints "No task files found." and exits.
4. For each file, parses the title from the Markdown heading and presents a selectable list (via `@clack/prompts` `select`).
5. The user picks a task to edit.
6. Reads the full content of the selected file.
7. Builds an edit prompt via `buildEditPlanPrompt()` that includes:
   - The file path.
   - The current file content (embedded in a Markdown code block).
   - Instructions to edit the file in place, preserve the YAML frontmatter structure, and not change `status`, `created`, `started`, or `completed` unless explicitly asked.
8. Spawns the backend agent with the edit prompt.
9. Shows a spinner ("Opening editor agent") while the agent works, or streams output if `--verbose` is set.
10. Watches for the `<woof>COMPLETE</woof>` completion marker.
11. Prints "Task plan updated" on success.

### Flags

| Flag        | Alias | Type      | Default | Description                                           |
| ----------- | ----- | --------- | ------- | ----------------------------------------------------- |
| `--dry-run` | `-d`  | `boolean` | `false` | Print the edit prompt without sending it to the agent |
| `--verbose` | —     | `boolean` | `false` | Stream agent output instead of showing a spinner      |

### The Edit Prompt

The prompt sent to the agent includes:

````
You are editing an existing task plan file.

FILE PATH
{path to the selected task file}

CURRENT FILE CONTENT
```markdown
{full file content}
````

INSTRUCTIONS

1. Read the current content of the task plan file at the path above.
2. Ask the user what changes they want to make (if interactive), or apply improvements.
3. Edit the file in place. Preserve the YAML frontmatter structure and all required sections.
4. Do NOT change status, created, started, or completed fields unless explicitly asked.
5. Keep the same filename and location.

When finished, output: <woof>COMPLETE</woof>.

````

### Key Behaviors

- **All task files are shown**, regardless of status. Unlike `plan list` (which filters to `pending`), `plan edit` lets you edit any task -- pending, in-progress, or completed.
- **The agent edits in place** -- the file path and filename are preserved.
- **Frontmatter is protected** -- the prompt instructs the agent not to change status fields unless explicitly asked.
- **The agent may interact with the user** -- the edit prompt says "Ask the user what changes they want to make (if running interactively)." In practice, since the backend is non-interactive (piped stdio with spinner, or verbose streaming), the agent applies improvements based on its analysis.

---

## Fumadocs Components to Use

### 1. Steps / Step

**Where**: Walk through the interactive flow.

1. Select a task file from the list
2. Agent reads the current content
3. Agent modifies the file in place
4. File is updated, frontmatter preserved

### 2. TypeTable

**Where**: Document flags.

```mdx
<TypeTable
  type={{
    "--dry-run / -d": {
      type: "boolean",
      default: "false",
      description: "Print the edit prompt without sending it to the agent",
    },
    "--verbose": {
      type: "boolean",
      default: "false",
      description: "Stream agent output instead of showing a spinner",
    },
  }}
/>
````

### 3. Callout

**Where**: Multiple locations.

- **`type="info"`**: Note that all task files are shown in the selection list, not just pending ones. This differs from `plan list`.
- **`type="info"`**: The agent preserves frontmatter fields (`status`, `created`, `started`, `completed`) by default. To change these, you'd need to edit the file manually.
- **`type="idea"`**: Suggest using `--dry-run` to inspect the full edit prompt before sending it to the agent, especially if you want to understand what context the agent receives.

### 4. Tabs / Tab

**Where**: Usage examples.

````mdx
```bash tab="Interactive"
ody plan edit
```

```bash tab="Verbose"
ody plan edit --verbose
```

```bash tab="Dry run"
ody plan edit --dry-run
```
````

### 5. Accordions / Accordion

**Where**: FAQ section.

- "Can I edit only pending tasks?" -- No, the selection list shows all task files regardless of status. This is intentional -- you may want to refine a completed task's documentation or fix an in-progress task.
- "Will the agent change the task status?" -- No, the prompt explicitly instructs the agent to preserve `status`, `created`, `started`, and `completed` fields.
- "What if I want to change the filename?" -- The edit prompt instructs the agent to keep the same filename. To rename a task file, do it manually in the filesystem.
- "Can I undo an edit?" -- There's no built-in undo. Use git to revert changes if the file is tracked.

### 6. Cards / Card

**Where**: Related pages.

```mdx
<Cards>
  <Card title="ody plan new" href="/docs/commands/plan/new">
    Create a new task plan from scratch
  </Card>
  <Card title="ody plan list" href="/docs/commands/plan/list">
    See which tasks are pending
  </Card>
  <Card title="ody run" href="/docs/commands/run">
    Execute task plans with the agent
  </Card>
</Cards>
```

### 7. Code Blocks (built-in)

**Where**: Show the edit prompt template and example dry-run output.

---

## Page Structure (Section Outline)

```
---
title: ody plan edit
description: Edit an existing task plan using the agent
---

## Overview
  Brief description of the command.
  <Callout type="info"> that all task files are shown, not just pending.

## Usage
  Code block tab group with examples.

## Flags
  <TypeTable> with --dry-run and --verbose.

## Interactive Flow
  <Steps> walking through the selection and edit process.
  <Callout type="info"> about frontmatter preservation.

## Edit Prompt
  Code block showing the prompt template the agent receives.
  <Callout type="idea"> about using --dry-run to inspect the prompt.

## Related
  <Cards> linking to plan new, plan list, and run.

## FAQ
  <Accordions> with common questions.
```

---

## Notes

- Source: `packages/cli/src/cmd/plan/edit.ts` and `packages/cli/src/builders/editPlanPrompt.ts`.
- Key distinction from `plan new`: the edit command works with an existing file and preserves its structure/frontmatter. The new command creates from scratch.
- The edit prompt embeds the full file content, so the agent has complete context. This is important to mention for users wondering how the agent knows what to change.
- The agent's behavior depends on the backend. With Claude in interactive mode, it may ask the user for guidance. With piped stdio (default), it applies improvements autonomously.
