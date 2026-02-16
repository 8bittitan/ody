---
status: completed
created: 2026-02-15
started: 2026-02-15
completed: 2026-02-15
---
# Task: Write Core Documentation Content (Introduction, Installation, Configuration)

## Description
Create the foundational MDX documentation pages and their sidebar ordering metadata. These pages cover the project introduction/overview, installation instructions, and configuration guide -- the essential content a new user needs to get started with ody.

## Background
Fumadocs uses MDX files in the `content/docs/` directory. Each file has YAML frontmatter with `title` and `description` fields. Sidebar ordering is controlled by `meta.json` files that list page slugs in display order. The ody CLI is installed via a shell script or `bun install`, configured through `.ody/ody.json` and `.ody/prompt.md`, and initialized with `ody init`.

## Technical Requirements
1. `packages/docs/content/docs/meta.json` -- Top-level sidebar ordering file listing pages and sections in order.
2. `packages/docs/content/docs/index.mdx` -- Introduction/overview page explaining what ody is and what it does.
3. `packages/docs/content/docs/installation.mdx` -- Installation instructions covering available methods (shell script, bun global install, building from source).
4. `packages/docs/content/docs/configuration.mdx` -- Configuration guide covering `.ody/ody.json` keys (`backend`, `maxIterations`, `shouldCommit`, `validatorCommands`), `.ody/prompt.md` template, and the `Config` module behavior.

## Dependencies
- Task `docs-layout-and-catch-all-page` must be completed first (the routing layer needs to exist so pages can be rendered).
- Refer to `packages/cli/src/lib/config.ts` for the config schema and defaults.
- Refer to `AGENTS.md` for config key descriptions.

## Implementation Approach
1. Create `packages/docs/content/docs/meta.json`:
   ```json
   {
     "title": "Documentation",
     "pages": [
       "---Introduction---",
       "index",
       "installation",
       "configuration",
       "---Commands---",
       "commands"
     ]
   }
   ```
2. Create `packages/docs/content/docs/index.mdx`:
   - Frontmatter: `title: Introduction`, `description: Overview of the ody CLI`.
   - Content: Brief explanation of ody as an agentic orchestrator CLI, what it does (runs coding agents in a loop with backend providers), and the key concepts (backends, harness, prompt building, completion markers).
3. Create `packages/docs/content/docs/installation.mdx`:
   - Frontmatter: `title: Installation`, `description: How to install ody`.
   - Content: Installation methods -- shell install script, `bun install -g @ody/cli`, building from source with `bun run build`. Prerequisites (Bun runtime required).
4. Create `packages/docs/content/docs/configuration.mdx`:
   - Frontmatter: `title: Configuration`, `description: Configuring ody`.
   - Content: Explain `.ody/ody.json` with a table of all config keys, their types, defaults, and descriptions. Cover `.ody/prompt.md` as the agent prompt template. Mention `Config.load()` / `Config.get()` / `Config.all()` API for developers.

## Acceptance Criteria

1. **Index page renders**
   - Given the docs site is running
   - When navigating to `/docs`
   - Then the introduction page renders with title "Introduction" and overview content

2. **Installation page is accurate**
   - Given the installation MDX file exists
   - When navigating to `/docs/installation`
   - Then installation instructions are displayed covering at least two installation methods

3. **Configuration page documents all keys**
   - Given the configuration MDX file exists
   - When navigating to `/docs/configuration`
   - Then all config keys (`backend`, `maxIterations`, `shouldCommit`, `validatorCommands`) are documented with types and defaults

4. **Sidebar ordering is correct**
   - Given `meta.json` exists at the top level
   - When the docs sidebar renders
   - Then pages appear in order: Introduction, Installation, Configuration, followed by Commands section

## Metadata
- **Complexity**: Medium
- **Labels**: docs, content, mdx, getting-started
