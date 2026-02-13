# Plan: `ody plan new` Documentation Page

## Overview

Write the documentation page for `ody plan new` as an MDX file at `packages/docs/content/docs/commands/plan/new.mdx`. This command creates new task plans by prompting the user for a description and then having the configured backend agent generate a structured `.code-task.md` file. The page should document the interactive flow, what gets generated, the prompt template, and flags.

---

## Command Breakdown

### What `ody plan new` Does

1. Instantiates the configured backend from the Ody config.
2. Prompts the user for a task description (validated to be non-empty).
3. Builds a plan prompt via `buildPlanPrompt()` that instructs the agent to:
   - Create exactly one `.code-task.md` file in the tasks directory (`.ody/tasks/`).
   - Use a kebab-case filename ending in `.code-task.md`.
   - Follow a strict file format with YAML frontmatter and required Markdown sections.
   - Output `<woof>COMPLETE</woof>` when done.
4. Creates the `.ody/tasks/` directory if it doesn't exist.
5. Spawns the backend agent with the plan prompt.
6. Shows a spinner while the agent works (unless `--verbose` is set, in which case output is streamed).
7. Watches for the `<woof>COMPLETE</woof>` completion marker.
8. After the task is generated, asks if the user wants to create another plan.
9. Loops back to step 2 if yes, exits if no.

### Flags

| Flag        | Alias | Type      | Default | Description                                                         |
| ----------- | ----- | --------- | ------- | ------------------------------------------------------------------- |
| `--dry-run` | `-d`  | `boolean` | `false` | Print the prompt that would be sent to the agent without executing  |
| `--verbose` | —     | `boolean` | `false` | Stream the agent's output in real-time instead of showing a spinner |

### The Plan Prompt

The prompt sent to the agent includes:

- An overview explaining that it generates structured code task files.
- Rules: create exactly one task, write to the tasks directory, use kebab-case filenames, include all required sections.
- The full file format template with YAML frontmatter (`status: pending`, `created: {date}`, `started: null`, `completed: null`) and all required Markdown sections.
- The user's task description.
- An output instruction to emit `<woof>COMPLETE</woof>` when finished.

The prompt template is adapted from Anthropic's `code-task-generator` skill.

### Generated File Format

Each generated file follows this structure:

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

### Loop Behavior

The command runs in a loop:

1. Prompt for task description.
2. Generate the task file.
3. Ask "Would you like to add another plan?"
4. If yes, go to step 1. If no (or cancelled), exit.

This allows creating multiple task plans in a single session.

---

## Fumadocs Components to Use

### 1. Steps / Step

**Where**: Walk through the interactive flow.

1. Enter a task description
2. Agent generates the `.code-task.md` file (spinner or verbose output)
3. File is written to `.ody/tasks/`
4. Optionally create another plan

### 2. TypeTable

**Where**: Document flags.

```mdx
<TypeTable
  type={{
    '--dry-run / -d': {
      type: 'boolean',
      default: 'false',
      description: 'Print the prompt without sending it to the agent',
    },
    '--verbose': {
      type: 'boolean',
      default: 'false',
      description: 'Stream agent output instead of showing a spinner',
    },
  }}
/>
```

### 3. Callout

**Where**: Multiple locations.

- **`type="info"`**: Explain that the agent generates the entire file -- the user only provides a description. The agent fills in Technical Requirements, Implementation Approach, Acceptance Criteria, etc.
- **`type="idea"`**: Suggest giving detailed, specific descriptions for better task plans. Example: "Add email validation to the user registration form using zod, including error messages" is better than "add validation".
- **`type="info"`**: Note that `--dry-run` prints the full prompt, which is useful for debugging or understanding what the agent receives.

### 4. Tabs / Tab

**Where**: Show usage examples.

````mdx
```bash tab="Interactive"
ody plan new
```

```bash tab="Verbose"
ody plan new --verbose
```

```bash tab="Dry run"
ody plan new --dry-run
```
````

### 5. Files / Folder / File

**Where**: Show what gets created on disk.

```mdx
<Files>
  <Folder name=".ody" defaultOpen>
    <Folder name="tasks" defaultOpen>
      <File name="add-email-validation.code-task.md" />
    </Folder>
  </Folder>
</Files>
```

### 6. Code Blocks (built-in)

**Where**: Throughout the page.

- Titled code block showing the generated file format (with `title=".ody/tasks/example.code-task.md"`)
- Example dry-run output showing the full plan prompt
- Code tab group for usage examples

### 7. Accordions / Accordion

**Where**: FAQ section.

- "Can I create task files manually?" -- Yes, as long as they follow the format with YAML frontmatter and all required sections. The agent won't validate manual files differently.
- "What makes a good task description?" -- Be specific. Include what, where, and how. Mention relevant files, libraries, or patterns.
- "Where are task files stored?" -- `.ody/tasks/` by default, configurable via `tasksDir` in config.
- "What if the agent generates a bad plan?" -- Use `ody plan edit` to refine it, or delete the file and try again with a more detailed description.

### 8. Cards / Card

**Where**: Related pages.

```mdx
<Cards>
  <Card title="ody plan" href="/docs/commands/plan">
    Overview of all plan subcommands and the task file format
  </Card>
  <Card title="ody plan edit" href="/docs/commands/plan/edit">
    Refine an existing task plan
  </Card>
  <Card title="ody run" href="/docs/commands/run">
    Execute task plans with the agent
  </Card>
</Cards>
```

---

## Page Structure (Section Outline)

```
---
title: ody plan new
description: Create a new task plan with the agent
---

## Overview
  Brief description of the command.
  <Callout type="info"> about agent-generated files.

## Usage
  Code block tab group with examples.

## Flags
  <TypeTable> with --dry-run and --verbose.

## Interactive Flow
  <Steps> walking through the prompt loop.
  <Callout type="idea"> about writing good task descriptions.

## Generated Output
  <Files> showing the created file.
  Code block with the full generated file template.

## Related
  <Cards> linking to plan overview, plan edit, and run.

## FAQ
  <Accordions> with common questions.
```

---

## Notes

- Source: `packages/cli/src/cmd/plan/new.ts` and `packages/cli/src/builders/planPrompt.ts`.
- The plan prompt template (from `planPrompt.ts`) is adapted from Anthropic's `code-task-generator` skill -- worth mentioning as a brief attribution.
- The loop behavior (create another plan?) is a distinctive feature of this command that should be documented clearly.
- The generated file format is defined in the plan prompt template, not hard-coded in the command itself. The agent interprets the template, so output may vary slightly.
