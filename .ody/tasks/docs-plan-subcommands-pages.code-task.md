---
status: pending
created: 2026-02-15
started: null
completed: null
---
# Task: Write Plan Subcommands Documentation (overview, new, list, edit, compact)

## Description
Create the MDX documentation pages for the `ody plan` command and all its subcommands: `plan new`, `plan list`, `plan edit`, and `plan compact`. Each subcommand gets its own page with synopsis, flags, behavior description, and examples.

## Background
The `ody plan` command is a parent command with subcommands for managing planning documents. The plan system allows users to create, list, edit, and compact planning documents used by the agent. The `compact` command was recently moved to be a root-level command as well, but it originated as a plan subcommand. The implementation lives in `packages/cli/src/cmd/plan.ts` and related task files.

## Technical Requirements
1. `packages/docs/content/docs/commands/plan/meta.json` -- Sidebar ordering for plan subcommands.
2. `packages/docs/content/docs/commands/plan/index.mdx` -- Overview of the plan command and its subcommands.
3. `packages/docs/content/docs/commands/plan/new.mdx` -- Documentation for `ody plan new`.
4. `packages/docs/content/docs/commands/plan/list.mdx` -- Documentation for `ody plan list`.
5. `packages/docs/content/docs/commands/plan/edit.mdx` -- Documentation for `ody plan edit`.
6. `packages/docs/content/docs/commands/plan/compact.mdx` -- Documentation for `ody plan compact`.

## Dependencies
- Task `docs-commands-top-level-pages` should be completed first (the commands section and its `meta.json` must reference the plan subsection).
- Refer to `packages/cli/src/cmd/plan.ts` for the plan command and subcommand implementations.
- Refer to `packages/cli/src/cmd/compact.ts` for the compact command if it has been moved.
- Refer to `packages/cli/src/cmd/task/` directory for any task-related subcommands.

## Implementation Approach
1. Read `packages/cli/src/cmd/plan.ts` and any related files to extract accurate subcommand definitions, flags, and behavior.
2. Create `packages/docs/content/docs/commands/plan/meta.json`:
   ```json
   {
     "title": "plan",
     "pages": [
       "index",
       "new",
       "list",
       "edit",
       "compact"
     ]
   }
   ```
3. Create `packages/docs/content/docs/commands/plan/index.mdx`:
   - Frontmatter: `title: ody plan`, `description: Manage planning documents`.
   - Content: Overview of the plan system, list of subcommands with brief descriptions, and general usage patterns.
4. Create `packages/docs/content/docs/commands/plan/new.mdx`:
   - Frontmatter: `title: ody plan new`, `description: Create a new planning document`.
   - Document flags, interactive prompts, output file location, and behavior.
5. Create `packages/docs/content/docs/commands/plan/list.mdx`:
   - Frontmatter: `title: ody plan list`, `description: List existing planning documents`.
   - Document output format and any filtering options.
6. Create `packages/docs/content/docs/commands/plan/edit.mdx`:
   - Frontmatter: `title: ody plan edit`, `description: Edit an existing planning document`.
   - Document how plan selection works, editor behavior, and flags.
7. Create `packages/docs/content/docs/commands/plan/compact.mdx`:
   - Frontmatter: `title: ody plan compact`, `description: Compact a planning document`.
   - Document what compaction does (summarization/condensation), flags, and when to use it.

## Acceptance Criteria

1. **Plan overview page lists all subcommands**
   - Given the docs site is running
   - When navigating to `/docs/commands/plan`
   - Then an overview page is displayed listing all plan subcommands (new, list, edit, compact)

2. **Each subcommand page is accessible**
   - Given all plan subcommand MDX files exist
   - When navigating to `/docs/commands/plan/new`, `/docs/commands/plan/list`, `/docs/commands/plan/edit`, `/docs/commands/plan/compact`
   - Then each page renders with accurate command documentation

3. **Sidebar nests plan subcommands correctly**
   - Given `commands/plan/meta.json` exists
   - When the sidebar renders
   - Then plan subcommands appear nested under the "plan" section within Commands

4. **Flag documentation matches source code**
   - Given the MDX content references specific flags
   - When compared against the source implementation in `packages/cli/src/cmd/plan.ts`
   - Then all documented flags, types, and defaults are accurate

## Metadata
- **Complexity**: Medium
- **Labels**: docs, content, mdx, commands, plan, subcommands
