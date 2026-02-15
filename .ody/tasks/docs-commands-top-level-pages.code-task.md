---
status: pending
created: 2026-02-15
started: null
completed: null
---
# Task: Write Commands Documentation (Overview, init, run, config)

## Description
Create the MDX documentation pages for the top-level CLI commands: a commands overview page, and individual pages for `ody init`, `ody run`, and `ody config`. Each page should document the command's purpose, synopsis, flags/options, behavior, and usage examples.

## Background
The ody CLI uses `citty` for command definitions. Each command is defined in `packages/cli/src/cmd/` and uses `defineCommand` with `meta`, `args`, and `run` properties. The documentation should accurately reflect the actual command implementations. Key commands: `init` sets up project configuration interactively, `run` executes the agent loop with a backend, and `config` displays the current configuration.

## Technical Requirements
1. `packages/docs/content/docs/commands/meta.json` -- Sidebar ordering for the commands section.
2. `packages/docs/content/docs/commands/index.mdx` -- Commands overview listing all available commands.
3. `packages/docs/content/docs/commands/init.mdx` -- Documentation for `ody init` including interactive prompts, flags, and what it generates.
4. `packages/docs/content/docs/commands/run.mdx` -- Documentation for `ody run` including the `--once` flag, `--iterations` override, loop behavior, backend selection, and completion marker detection.
5. `packages/docs/content/docs/commands/config.mdx` -- Documentation for `ody config` showing current config display behavior.

## Dependencies
- Task `docs-core-content-pages` should be completed first (or at minimum the `meta.json` referencing the commands section must exist).
- Refer to `packages/cli/src/cmd/init.ts` for the init command implementation.
- Refer to `packages/cli/src/cmd/run.ts` for the run command implementation.
- Refer to `packages/cli/src/cmd/config.ts` for the config command implementation.

## Implementation Approach
1. Read the source files for each command (`init.ts`, `run.ts`, `config.ts`) to extract accurate flag definitions, defaults, and behavior.
2. Create `packages/docs/content/docs/commands/meta.json`:
   ```json
   {
     "title": "Commands",
     "pages": [
       "index",
       "init",
       "run",
       "config",
       "plan"
     ]
   }
   ```
3. Create `packages/docs/content/docs/commands/index.mdx`:
   - Frontmatter: `title: Commands`, `description: Available ody CLI commands`.
   - Content: A brief overview and table listing all commands with one-line descriptions.
4. Create `packages/docs/content/docs/commands/init.mdx`:
   - Frontmatter: `title: ody init`, `description: Initialize ody in a project`.
   - Synopsis: `ody init`
   - Describe interactive prompts (backend selection, max iterations, etc.), generated files (`.ody/ody.json`, `.ody/prompt.md`), and behavior.
5. Create `packages/docs/content/docs/commands/run.mdx`:
   - Frontmatter: `title: ody run`, `description: Run the agent loop`.
   - Synopsis: `ody run [--once] [--iterations <n>]`
   - Document flags in a table, explain loop vs. single-shot mode, backend selection, prompt building, and completion marker behavior.
6. Create `packages/docs/content/docs/commands/config.mdx`:
   - Frontmatter: `title: ody config`, `description: Display current configuration`.
   - Synopsis: `ody config`
   - Describe what it outputs and when it's useful.

## Acceptance Criteria

1. **Commands overview page renders**
   - Given the docs site is running
   - When navigating to `/docs/commands`
   - Then a page listing all available commands is displayed

2. **Init page documents all prompts and outputs**
   - Given the init MDX file exists
   - When navigating to `/docs/commands/init`
   - Then the interactive setup process is documented including backend selection and file generation

3. **Run page documents all flags accurately**
   - Given the run MDX file exists
   - When navigating to `/docs/commands/run`
   - Then all flags (`--once`, `--iterations`) are documented with types, defaults, and descriptions matching the source code

4. **Config page describes output**
   - Given the config MDX file exists
   - When navigating to `/docs/commands/config`
   - Then the command's behavior (displaying current config) is clearly explained

5. **Sidebar shows correct ordering**
   - Given `commands/meta.json` exists
   - When the sidebar renders within the commands section
   - Then pages appear in order: Overview, init, run, config, plan

## Metadata
- **Complexity**: Medium
- **Labels**: docs, content, mdx, commands, cli
