---
status: completed
created: 2026-02-20
started: 2026-02-20
completed: 2026-02-20
---
# Task: Document the `ody task import` Command

## Description
Add a documentation page for the `ody task import` command to the docs website. This command imports tasks from external issue trackers (Jira and GitHub) and converts them into structured `.code-task.md` files. The page needs to cover all flags, input formats, authentication prerequisites, and behavior for both sources.

## Background
The `ody task import` command is fully implemented in `packages/cli/src/cmd/task/import.ts` but has no corresponding documentation page on the docs website. The existing `task` subcommand pages (`list` and `edit`) are documented at `packages/docs/content/docs/commands/task/` and follow a consistent format with frontmatter, synopsis, flags table, behavior section, examples, and related links. The sidebar navigation in `meta.json` also needs updating to include the new page.

## Technical Requirements
1. Create a new MDX file at `packages/docs/content/docs/commands/task/import.mdx` following the established documentation format used by sibling pages (`edit.mdx`, `list.mdx`).
2. Update `packages/docs/content/docs/commands/task/meta.json` to add `"import"` to the `pages` array so it appears in the sidebar navigation.
3. Document all four flags: `--jira`, `--github` (alias `--gh`), `--verbose`, and `--dry-run` (alias `-d`) with their types, defaults, and descriptions.
4. Document the mutual exclusivity constraint: exactly one of `--jira` or `--github` must be provided.
5. Cover both Jira and GitHub input formats (full URL and shorthand notation).
6. Mention that authentication credentials are required and must be configured beforehand via `ody auth`.
7. Include practical usage examples for both Jira and GitHub imports, dry-run mode, and verbose mode.

## Dependencies
- Existing doc pages for style reference: `packages/docs/content/docs/commands/task/edit.mdx` and `packages/docs/content/docs/commands/task/list.mdx`
- Command source: `packages/cli/src/cmd/task/import.ts`
- Sidebar config: `packages/docs/content/docs/commands/task/meta.json`

## Implementation Approach
1. Read the existing `edit.mdx` and `list.mdx` pages to confirm the documentation structure and tone.
2. Create `packages/docs/content/docs/commands/task/import.mdx` with the following sections in order:
   - YAML frontmatter with `title: ody task import` and a concise `description`.
   - `# ody task import` heading with a one-to-two sentence introduction.
   - `## Synopsis` with a fenced bash code block showing usage with all flags.
   - `## Flags` table listing all four flags with their alias, type, default, and description columns.
   - `## Input Formats` subsection explaining the accepted Jira formats (full URL like `https://company.atlassian.net/browse/PROJ-123` or bare key like `PROJ-123`) and GitHub formats (full URL like `https://github.com/owner/repo/issues/123` or shorthand like `owner/repo#123`).
   - `## Behavior` numbered list describing the command flow: input validation, issue fetching, prompt building, agent execution, and task file creation.
   - A `### Dry run` subsection explaining the `--dry-run` flag behavior.
   - `## Authentication` section noting that Jira and GitHub credentials must be configured via `ody auth` before using this command.
   - `## Example` section with code blocks covering: Jira import by key, Jira import by URL, GitHub import by shorthand, GitHub import by URL, dry-run mode, and verbose mode.
   - `## Related` section linking to `ody plan`, `ody task list`, `ody task edit`, and `ody run`.
3. Update `packages/docs/content/docs/commands/task/meta.json` to change `"pages": ["list", "edit"]` to `"pages": ["list", "edit", "import"]`.
4. Verify the docs site builds without errors by running the build or dev server from `packages/docs`.

## Acceptance Criteria

1. **Import page exists and renders**
   - Given the docs site is running
   - When navigating to `/docs/commands/task/import`
   - Then the `ody task import` documentation page renders with all required sections

2. **Sidebar navigation includes import**
   - Given the docs site is running
   - When viewing the sidebar under "task" commands
   - Then "import" appears as a navigation item alongside "list" and "edit"

3. **All flags documented**
   - Given a user reads the Flags section
   - When they review the table
   - Then all four flags (`--jira`, `--github`/`--gh`, `--verbose`, `--dry-run`/`-d`) are listed with correct types, defaults, and descriptions

4. **Both input sources covered**
   - Given a user reads the Input Formats section
   - When they review the accepted formats
   - Then both Jira (URL and bare key) and GitHub (URL and shorthand) formats are documented with examples

5. **Authentication prerequisites noted**
   - Given a user reads the page
   - When they look for setup requirements
   - Then they find clear mention that credentials must be configured via `ody auth` before using the command

6. **Style consistency**
   - Given the existing `edit.mdx` and `list.mdx` pages
   - When comparing the new `import.mdx` page
   - Then the formatting, tone, section ordering, and table structure are consistent

## Metadata
- **Complexity**: Low
- **Labels**: docs, task, import, documentation
