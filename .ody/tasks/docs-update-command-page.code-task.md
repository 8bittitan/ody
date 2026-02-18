---
status: completed
created: 2026-02-17
started: 2026-02-17
completed: 2026-02-17
---
# Task: Add Documentation Page for the `ody update` Command

## Description
Create a new MDX documentation page for the `ody update` CLI command and register it in the commands sidebar. The update command allows users to check for and install CLI updates from GitHub Releases, but it currently has no corresponding documentation page.

## Background
The `ody update` command exists in `packages/cli/src/cmd/update.ts` and provides self-update functionality for the CLI binary. It checks the GitHub Releases API for a newer version and optionally downloads and installs it via the project's install script. All other commands (`init`, `run`, `config`, `compact`, `plan`, `task`) already have doc pages under `packages/docs/content/docs/commands/`, but `update` is missing. The commands index page (`commands/index.mdx`) also does not list `update` in its reference table.

## Technical Requirements
1. Create a new file `packages/docs/content/docs/commands/update.mdx` following the existing command doc page convention (frontmatter with `title` and `description`, then sections for Synopsis, Flags, Behavior, Examples, and Related).
2. Document the `--check` / `-c` flag (boolean, default `false`) that restricts the command to only checking for updates without downloading.
3. Document the full behavior flow: version check against GitHub Releases, up-to-date path, check-only path, and full update path (downloads and runs the install script).
4. Add `"update"` to the `pages` array in `packages/docs/content/docs/commands/meta.json` so it appears in the sidebar navigation.
5. Add an `update` row to the command reference table in `packages/docs/content/docs/commands/index.mdx`.

## Dependencies
- Existing command doc convention established by other pages (e.g., `run.mdx`, `config.mdx`).
- The `update` command source in `packages/cli/src/cmd/update.ts` and `Installation` namespace in `packages/cli/src/lib/installation.ts` for accurate behavioral documentation.
- Fumadocs MDX content pipeline configured in the docs workspace.

## Implementation Approach
1. **Create `update.mdx`** at `packages/docs/content/docs/commands/update.mdx` with:
   - Frontmatter: `title: ody update`, `description: Check for and install CLI updates`.
   - H1 heading and introductory paragraph describing the command purpose.
   - **Synopsis** section with the usage signature `ody update [--check]`.
   - **Flags** section with a markdown table documenting the `--check` / `-c` flag.
   - **Behavior** section with subsections covering: default update flow (check + install), check-only mode (`--check`), already-up-to-date case, and error handling.
   - **Examples** section with code blocks showing: basic update, check-only invocation, and sample outputs for each scenario.
   - **Related** section linking to the installation page and `ody init`.
2. **Update `meta.json`** at `packages/docs/content/docs/commands/meta.json` to add `"update"` to the `pages` array (place it after `"task"` or at the end, as it's a utility command).
3. **Update `index.mdx`** at `packages/docs/content/docs/commands/index.mdx` to add a row for `update` in the command reference table.
4. Verify the page matches the conventions of existing command docs (same heading structure, table format, code block style).

## Acceptance Criteria

1. **Doc page exists and renders**
   - Given the docs workspace is built
   - When navigating to `/docs/commands/update`
   - Then the update command documentation page renders with all required sections

2. **Sidebar navigation includes update**
   - Given the docs sidebar is rendered
   - When viewing the Commands section
   - Then "update" appears as a navigation entry

3. **Command index lists update**
   - Given the commands index page at `/docs/commands`
   - When viewing the command reference table
   - Then an `update` row is present with its description

4. **Flag documentation is accurate**
   - Given the update doc page
   - When reading the Flags section
   - Then the `--check` / `-c` boolean flag is documented with its default and description

5. **Behavior documentation covers all paths**
   - Given the update doc page
   - When reading the Behavior section
   - Then the default update flow, check-only mode, already-up-to-date case, and error handling are all described

## Metadata
- **Complexity**: Low
- **Labels**: docs, commands
