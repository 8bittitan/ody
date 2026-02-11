# Plan: `ody config` Documentation Page

## Overview

Write the documentation page for `ody config` as an MDX file at `packages/docs/content/docs/commands/config.mdx`. This is a simple read-only command that displays the current Ody configuration. The page is short but should use Fumadocs components to stay consistent with the rest of the docs and link to related pages.

---

## Command Breakdown

### What `ody config` Does

1. Calls `Config.all()` to retrieve the loaded configuration.
2. Prints the full configuration as formatted JSON to stdout.
3. If no configuration is found (i.e., `Config.all()` throws because no `.ody/ody.json` exists), warns the user to run `ody init`.

This command takes no arguments or flags.

### Flags

None. This command has no flags or positional arguments.

### Behavior Details

- The configuration is loaded during the CLI's `setup` phase (before any subcommand runs), so `Config.load()` has already been called.
- `Config.load()` merges global config (`~/.ody/ody.json` or `~/.config/ody/ody.json`) with local config (`.ody/ody.json`). Local values take precedence.
- The output is the merged, validated config object serialized with `JSON.stringify(config, null, 2)`.
- If neither global nor local config exists, the command prints a warning: `No configuration found. Run 'ody init' to set up your project.`

### Example Output

```json
{
  "backend": "claude",
  "maxIterations": 0,
  "shouldCommit": false,
  "validatorCommands": [
    "bun run lint",
    "bun run typecheck"
  ],
  "model": "claude-sonnet-4-20250514",
  "skipPermissions": true,
  "notify": "all"
}
```

---

## Fumadocs Components to Use

### 1. Callout

**Where**: Multiple locations.

- **`type="info"`**: Explain that the output is the merged result of global + local config. Users may see values they didn't set locally if they have a global config.
- **`type="warn"`**: Note that if no config exists, the command prints a warning rather than failing. Direct the user to `ody init`.

### 2. Tabs / Tab

**Where**: Show example output for different configurations.

Use `<Tabs items={['Minimal', 'Full']}>` to show:
- A minimal config (just backend, maxIterations, shouldCommit)
- A full config with all optional fields populated

### 3. Accordions / Accordion

**Where**: FAQ section.

- "Where does the config come from?" -- explain the global + local merge, resolution order.
- "Can I edit the config file directly?" -- yes, it's plain JSON validated by Zod. Running `ody config` afterward will show the validated result.
- "Why does config show fields I didn't set?" -- Zod applies defaults (e.g., `shouldCommit: false`, `validatorCommands: []`).

### 4. Cards / Card

**Where**: Related pages at the bottom.

```mdx
<Cards>
  <Card title="ody init" href="/docs/commands/init">
    Create or update your Ody configuration
  </Card>
  <Card title="Configuration Reference" href="/docs/configuration">
    Full reference for all configuration fields
  </Card>
</Cards>
```

### 5. Code Blocks (built-in)

**Where**: Usage examples and example output.

````mdx
```bash title="Terminal"
ody config
```
````

Titled JSON blocks for example outputs.

### 6. Files / Folder / File

**Where**: Show where config files can live.

```mdx
<Files>
  <Folder name="~" defaultOpen>
    <Folder name=".ody">
      <File name="ody.json" />
    </Folder>
    <Folder name=".config">
      <Folder name="ody">
        <File name="ody.json" />
      </Folder>
    </Folder>
  </Folder>
  <Folder name="project" defaultOpen>
    <Folder name=".ody" defaultOpen>
      <File name="ody.json" />
    </Folder>
  </Folder>
</Files>
```

This shows the global (home directory) and local (project) config locations.

---

## Page Structure (Section Outline)

```
---
title: ody config
description: Display the current Ody configuration
---

## Overview
  Brief description: read-only command that prints the current config.

## Usage
  Code block with invocation.

## Output
  <Tabs> showing minimal vs full example outputs.
  <Callout type="info"> about merged global + local config.

## Config Locations
  <Files> showing global and local config paths.
  Explanation of resolution order.

## Related
  <Cards> linking to ody init and configuration reference.

## FAQ
  <Accordions> with common questions.
```

---

## Notes

- Source: `packages/cli/src/cmd/config.ts` (25 lines -- very simple command).
- This page should be concise. The command does one thing. The bulk of config documentation belongs on the separate Configuration Reference page (`/docs/configuration`), not here.
- Cross-reference the config resolution logic documented in the init page to avoid duplication.
