# Plan: `ody init` Documentation Page

## Overview

Write the documentation page for `ody init` as an MDX file at `packages/docs/content/docs/commands/init.mdx`. This page should fully document the command's purpose, every flag, the interactive prompts, the resulting configuration file, and backend-specific behavior. Use as many built-in Fumadocs components as possible to make the page rich and navigable.

---

## Command Breakdown

### What `ody init` Does

1. Creates the `.ody/` directory in the current project root if it doesn't exist.
2. Runs an interactive setup flow (via `@clack/prompts`) that asks the user to configure:
   - **Backend** -- which agent harness to use (`opencode`, `claude`, or `codex`). Only backends found on the system PATH are offered.
   - **Model** -- optional model override for the selected backend. Blank means use the backend's default.
   - **Validator commands** -- optional list of shell commands the agent runs after making changes (e.g. `bun run lint`, `npm run typecheck`). User is prompted in a loop until they leave blank.
   - **Skip permissions** (Claude only) -- whether to bypass Claude Code's built-in permission checks.
   - **Notifications** -- OS notification preference: disabled, on completion (`all`), or per iteration (`individual`).
3. Validates the resulting config object against a Zod schema.
4. Writes the config to `.ody/ody.json`.

All interactive prompts can be skipped by passing the equivalent CLI flag.

### Flags

| Flag              | Alias | Type                     | Default                               | Description                                                                  |
| ----------------- | ----- | ------------------------ | ------------------------------------- | ---------------------------------------------------------------------------- |
| `--backend`       | `-b`  | `string`                 | — (prompted)                          | Agent harness to use: `opencode`, `claude`, or `codex`                       |
| `--maxIterations` | `-i`  | `string` (parsed to int) | `0`                                   | Maximum number of loop iterations. `0` = unlimited                           |
| `--model`         | `-m`  | `string`                 | — (prompted, blank = backend default) | Model name override for the selected backend                                 |
| `--shouldCommit`  | `-c`  | `boolean`                | `false`                               | Whether the agent should create git commits after each task                  |
| `--notify`        | `-n`  | `string`                 | — (prompted)                          | Notification preference: `false`/`off`/`none`, `all`/`true`, or `individual` |
| `--dry-run`       | —     | `boolean`                | `false`                               | Print the config that would be saved without writing to disk                 |

### Config Schema (from Zod)

```ts
{
  backend: string;            // Required. One of "opencode", "claude", "codex"
  maxIterations: number;      // Required. Non-negative integer. 0 = unlimited
  shouldCommit: boolean;      // Default: false
  validatorCommands?: string[]; // Default: []
  model?: string;             // Optional
  skipPermissions?: boolean;  // Default: true. Only relevant for "claude" backend
  tasksDir?: string;          // Default: "tasks"
  notify?: false | "all" | "individual"; // Default: false
}
```

### Example Output File (`.ody/ody.json`)

```json
{
  "backend": "claude",
  "maxIterations": 0,
  "shouldCommit": false,
  "validatorCommands": ["bun run lint", "bun run typecheck"],
  "model": "claude-sonnet-4-20250514",
  "skipPermissions": true,
  "notify": "all"
}
```

A minimal config (OpenCode backend, all defaults):

```json
{
  "backend": "opencode",
  "maxIterations": 0,
  "shouldCommit": false,
  "validatorCommands": []
}
```

### Backend-Specific Behavior

- **`claude`**: An additional prompt asks whether to skip Claude Code's permission/safety checks (`skipPermissions`). Defaults to `true`.
- **`opencode`** and **`codex`**: No backend-specific prompts beyond the shared ones.
- Backend availability is determined at runtime by checking `PATH` (`Bun.which`). If the specified `--backend` binary is not found, the user is warned and prompted to pick from available options.

### Config Resolution Order

When `Config.load()` runs, it merges config from two locations:

1. **Global**: `~/.ody/ody.json` or `~/.config/ody/ody.json` (first found wins)
2. **Local**: `.ody/ody.json` in the current working directory

Local values override global values (shallow merge). `ody init` writes only to the local path.

---

## Fumadocs Components to Use

The page should register and use the following components. This section describes where each component fits on the page.

### 1. Steps / Step

**Where**: Walk the user through the interactive prompts in order.

Wrap the "What happens when you run `ody init`" section in a `<Steps>` component with a `<Step>` for each prompt stage:

1. Select backend
2. Choose model (optional)
3. Add validator commands (optional, loop)
4. Skip permissions (Claude only)
5. Set notification preference
6. Config saved

This gives the reader a clear sequential walkthrough of the interactive flow.

### 2. TypeTable

**Where**: Document each CLI flag.

Use `<TypeTable>` to render the flags table instead of a plain Markdown table. This gives each flag a structured entry with type, default, description, and required status. Example:

```mdx
<TypeTable
  type={{
    '--backend / -b': {
      type: 'string',
      description: 'Agent harness to use: opencode, claude, or codex',
    },
    '--maxIterations / -i': {
      type: 'string',
      default: '0',
      description: 'Maximum loop iterations. 0 = unlimited',
    },
    '--shouldCommit / -c': {
      type: 'boolean',
      default: 'false',
      description: 'Whether the agent creates git commits after each task',
    },
    '--model / -m': {
      type: 'string',
      description: 'Model name override for the selected backend',
    },
    '--notify / -n': {
      type: 'string',
      description: 'Notification preference: false/off/none, all/true, or individual',
    },
    '--dry-run': {
      type: 'boolean',
      default: 'false',
      description: 'Print the config without saving to disk',
    },
  }}
/>
```

### 3. Tabs / Tab

**Where**: Show example configurations per backend.

Use `<Tabs items={['OpenCode', 'Claude', 'Codex']}>` with a `<Tab>` for each backend, each containing an example `.ody/ody.json` with backend-specific fields. This clearly shows how the config differs per backend (e.g. Claude has `skipPermissions`).

### 4. Callout

**Where**: Multiple locations throughout the page.

- **`type="warn"`**: On the `skipPermissions` field -- warn that this bypasses Claude Code's safety system.
- **`type="info"`**: On the config resolution section -- explain the global vs. local merge behavior.
- **`type="info"`**: On backend availability -- note that only backends found on the system PATH are offered.
- **`type="idea"`**: On validator commands -- suggest common validators like `bun run lint`, `npm run typecheck`, `go test ./...`.

### 5. Files / Folder / File

**Where**: Show the `.ody/` directory structure that `ody init` creates.

```mdx
<Files>
  <Folder name=".ody" defaultOpen>
    <File name="ody.json" />
  </Folder>
</Files>
```

This visually represents what gets created on disk.

### 6. Accordions / Accordion

**Where**: FAQ section at the bottom of the page.

Use for common questions:

- "What if my backend isn't detected?" -- explain `Bun.which` PATH lookup and how to install backends.
- "Can I edit `ody.json` manually?" -- yes, it's plain JSON validated by Zod on load.
- "What's the difference between global and local config?" -- explain merge behavior.
- "What happens if I run `ody init` again?" -- it overwrites `.ody/ody.json` (the directory is preserved if it already exists).

### 7. Code Blocks (built-in)

**Where**: Throughout the page for:

- Command examples (with `title` annotations like `title="Terminal"`)
- JSON config examples (with `title=".ody/ody.json"`)
- The Zod schema reference

Use code tab groups for install commands:

````mdx
```bash tab="Usage"
ody init
```

```bash tab="With flags"
ody init --backend claude --model claude-sonnet-4-20250514 --shouldCommit
```

```bash tab="Dry run"
ody init --dry-run
```
````

### 8. Cards / Card

**Where**: At the top or bottom of the page, linking to related pages.

```mdx
<Cards>
  <Card title="Configuration Reference" href="/docs/configuration">
    Full reference for all .ody/ody.json fields
  </Card>
  <Card title="ody run" href="/docs/commands/run">
    Execute the agent loop using your configuration
  </Card>
</Cards>
```

---

## Page Structure (Section Outline)

The MDX file should follow this structure:

```
---
title: ody init
description: Initialize Ody configuration for your project
---

## Overview
  Brief description of what the command does.
  <Callout type="info"> about backend availability / PATH requirement.

## Usage
  Code block with basic invocation examples (tab group).

## Flags
  <TypeTable> with all flags documented.

## Interactive Setup
  <Steps> walking through each prompt stage.
    Step 1: Select backend
    Step 2: Choose model
    Step 3: Validator commands
      <Callout type="idea"> with example validators
    Step 4: Skip permissions (Claude only)
      <Callout type="warn"> about safety bypass
    Step 5: Notification preference
    Step 6: Config saved

## Output
  <Files> showing .ody/ directory structure.

## Configuration Examples
  <Tabs> with per-backend example JSON configs.

## Config Resolution
  <Callout type="info"> explaining global vs. local merge.
  Description of resolution order.

## Related
  <Cards> linking to configuration reference and ody run.

## FAQ
  <Accordions> with common questions.
```

---

## Component Registration Requirement

The following components need to be registered in `packages/docs/mdx-components.tsx` (or equivalent) for use in MDX files:

| Component                 | Import Path                         | Registration                 |
| ------------------------- | ----------------------------------- | ---------------------------- |
| `Tab`, `Tabs`             | `fumadocs-ui/components/tabs`       | Spread `* as TabsComponents` |
| `Step`, `Steps`           | `fumadocs-ui/components/steps`      | Spread or named              |
| `File`, `Folder`, `Files` | `fumadocs-ui/components/files`      | Spread or named              |
| `Accordion`, `Accordions` | `fumadocs-ui/components/accordion`  | Spread or named              |
| `TypeTable`               | `fumadocs-ui/components/type-table` | Named                        |
| `Callout`                 | `fumadocs-ui/components/callout`    | Included by default          |
| `Card`, `Cards`           | `fumadocs-ui/components/card`       | Included by default          |
| `CodeBlock`, `Pre`        | `fumadocs-ui/components/codeblock`  | Included by default          |

---

## Notes

- All content is derived from the actual source code in `packages/cli/src/cmd/init.ts`, `packages/cli/src/lib/config.ts`, and `packages/cli/src/util/constants.ts`.
- The config schema section should stay in sync with the Zod schema in `config.ts`. If the schema changes, the docs must be updated.
- The `tasksDir` field exists in the schema but is not exposed via `ody init` flags -- it uses a default of `"tasks"`. Mention it briefly but note it's not configurable via the init command.
