# Plan: `ody plan compact` Documentation Page

## Overview

Write the documentation page for `ody plan compact` as an MDX file at `packages/docs/content/docs/commands/plan/compact.mdx`. This command archives completed tasks into a historical Markdown record and deletes the original task files. The page should document the archival process, filtering criteria, output format, and directory structure.

---

## Command Breakdown

### What `ody plan compact` Does

1. Resolves the tasks directory (`.ody/tasks/` by default).
2. Scans for all `*.code-task.md` files using `Bun.Glob`.
3. If no task files exist, prints "No task files found." and exits.
4. For each file, parses the YAML frontmatter and filters for tasks that meet both criteria:
   - `status` is `completed`
   - `completed` field has a value (not `null` or empty)
5. For each qualifying task, extracts:
   - **Title** from the `# Task: ...` or `# ...` heading
   - **Description** from the `## Description` section (condensed to 2-3 sentences)
   - **Completion date** from the `completed` frontmatter field
6. Sorts tasks by completion date (ascending).
7. Generates a Markdown archive file with a header and one section per archived task.
8. Creates the `.ody/history/` directory if it doesn't exist.
9. Writes the archive to `.ody/history/archive-YYYY-MM-DD.md` (using today's date).
10. Deletes the original completed task files from the tasks directory.
11. Prints the count and archive path.

### Flags

None. This command takes no flags or positional arguments.

### Filtering Criteria

A task is eligible for archival only if:

- Its frontmatter `status` is exactly `"completed"`.
- Its frontmatter `completed` field is present, non-null, and not the string `"null"`.

Tasks with `status: pending` or `status: in_progress` are never archived. Tasks with `status: completed` but a missing or null completion date are also skipped.

### Archive Output Format

The generated archive file follows this structure:

```markdown
# Task Archive

Generated: 2025-02-11T14:30:00.000Z

Total tasks archived: 3

---

## Add Email Validation

**Completed:** 2025-02-09

A clear description of what was implemented, condensed to 2-3 sentences from the Description section.

---

## Fix Test Suite

**Completed:** 2025-02-10

Description of the test suite fixes.

---

## Refactor Auth Module

**Completed:** 2025-02-11

Description of the auth module refactoring.

---
```

### Description Condensation

Descriptions are extracted from the `## Description` section of each task file. The extraction:

- Matches content between `## Description` and the next `## ` heading, `---`, or end of file.
- Condenses to the first 2-3 sentences (split on `.`, `!`, `?`).
- Falls back to the first 200 characters if no sentence boundaries are found.

### Destructive Operation

This command **deletes the original task files** after archiving. The archive in `.ody/history/` is the only remaining record. This is intentional -- it keeps the tasks directory clean for the agent, which only needs to see pending and in-progress tasks.

---

## Fumadocs Components to Use

### 1. Steps / Step

**Where**: Walk through the archival process.

1. Scan for completed task files
2. Extract titles, descriptions, and completion dates
3. Sort by completion date
4. Generate the archive Markdown file
5. Write to `.ody/history/archive-YYYY-MM-DD.md`
6. Delete original task files

### 2. Callout

**Where**: Multiple locations.

- **`type="warn"`**: This command **deletes** the original completed task files. Make sure the archive is written successfully before deletion. If you need the full task details (Technical Requirements, Acceptance Criteria, etc.), save them separately before compacting.
- **`type="info"`**: Only tasks with both `status: completed` and a valid `completed` date are archived. Tasks missing a completion date are skipped even if their status is `completed`.
- **`type="info"`**: The archive filename uses today's date (`archive-YYYY-MM-DD.md`). Running compact multiple times on the same day will overwrite the previous archive for that day.

### 3. Files / Folder / File

**Where**: Show the before and after directory state.

**Before compaction:**

```mdx
<Files>
  <Folder name=".ody" defaultOpen>
    <Folder name="tasks" defaultOpen>
      <File name="add-auth.code-task.md" />
      <File name="fix-tests.code-task.md" />
      <File name="new-feature.code-task.md" />
    </Folder>
  </Folder>
</Files>
```

**After compaction** (assuming `add-auth` and `fix-tests` were completed):

```mdx
<Files>
  <Folder name=".ody" defaultOpen>
    <Folder name="tasks" defaultOpen>
      <File name="new-feature.code-task.md" />
    </Folder>
    <Folder name="history" defaultOpen>
      <File name="archive-2025-02-11.md" />
    </Folder>
  </Folder>
</Files>
```

### 4. Tabs / Tab

**Where**: Show the before/after directory state side by side.

Use `<Tabs items={['Before', 'After']}>` with the `<Files>` trees from above in each tab.

### 5. Code Blocks (built-in)

**Where**: Throughout the page.

- Usage command:
  ````mdx
  ```bash title="Terminal"
  ody plan compact
  ```
  ````
- Example archive output with `title=".ody/history/archive-2025-02-11.md"`
- Example terminal output showing the success message

### 6. Accordions / Accordion

**Where**: FAQ section.

- "Can I undo a compaction?" -- Not directly. The original files are deleted. Use git to recover them if the files were tracked.
- "What if I run compact twice on the same day?" -- The archive file for that day is overwritten. Only the latest compaction's results are preserved.
- "Are pending or in-progress tasks affected?" -- No, only `completed` tasks with a valid completion date are archived and deleted.
- "Where is the archive stored?" -- `.ody/history/archive-YYYY-MM-DD.md`. The `history` directory is created automatically.
- "Does the archive include the full task details?" -- No, only the title, completion date, and a condensed description (2-3 sentences). Technical Requirements, Acceptance Criteria, etc. are lost.

### 7. Cards / Card

**Where**: Related pages.

```mdx
<Cards>
  <Card title="ody plan list" href="/docs/commands/plan/list">
    Check which tasks are still pending
  </Card>
  <Card title="ody run" href="/docs/commands/run">
    Execute tasks to completion before archiving
  </Card>
  <Card title="ody plan" href="/docs/commands/plan">
    Overview of all plan subcommands
  </Card>
</Cards>
```

---

## Page Structure (Section Outline)

```
---
title: ody plan compact
description: Archive completed tasks into a historical record
---

## Overview
  Brief description of the command.
  <Callout type="warn"> that this deletes original task files.

## Usage
  Code block with invocation.

## How It Works
  <Steps> walking through the archival process.
  <Callout type="info"> about the filtering criteria (status + completion date).

## Directory Changes
  <Tabs items={['Before', 'After']}> with <Files> trees showing the state change.

## Archive Format
  Code block with example archive output.
  <Callout type="info"> about description condensation (2-3 sentences).
  <Callout type="info"> about same-day overwrites.

## Related
  <Cards> linking to plan list, run, and plan overview.

## FAQ
  <Accordions> with common questions.
```

---

## Notes

- Source: `packages/cli/src/cmd/plan/compact.ts`, `packages/cli/src/util/task.ts` (for `parseFrontmatter`, `parseTitle`, `parseDescription`), and `packages/cli/src/types/task.ts` (for `CompletedTask` type).
- The destructive nature of this command (deleting files) is the most important thing to highlight. Use a prominent warning callout.
- The description condensation logic is worth documenting because users may wonder why the archive doesn't include their full descriptions.
- The same-day overwrite behavior is a subtle edge case that should be called out clearly.
