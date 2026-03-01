# @ody/cli

## 0.6.0

### Minor Changes

- ### Features

  - improve planning workflow and rename autoCommit config (674a5f8)
  - Desktop app (#19) (576c3eb)

  ### Bug Fixes

  - remove desktop typecheck (3fca9ee)
  - remove typecheck script (c987fa7)
  - fix types on desktop app (64cd33a)
  - fix docs build (d45503e)

  ### Maintenance

  - add back typecheck (301b0bd)

## 0.5.0

### Minor Changes

- ### Features
  - add OpenCode model autocomplete with fallback (9f2f628)
  - make edit command use interactive PTY (05a1591)
  - update docs layout, add og image generation (cf9c391)

  ### Bug Fixes
  - fixes layout and incorrect text for auth commands (e9188a9)

  ### Maintenance
  - bump to use tsgo (a91a6aa)
  - package bumps (fa8817c)

## 0.4.0

### Minor Changes

- ### Features

  - document new cli commands (370291c)
  - set ody.json schema by default on ody init (c8a10fb)
  - allow per command (run/plan) model choice (96cb544)
  - add per-command model overrides for run and plan (c525b2d)

  ### Bug Fixes

  - Fix typecheck (5e34dbc)
  - restrict edit selection to pending tasks (d7b0591)

  ### Refactors

  - switch task discovery to async scans (b0760f6)
  - reuse shared setup-bun in release workflows (b0bb618)

  ### Performance

  - cache command-scope config and path derivations (5969e58)
  - parallelize task file loading in CLI paths (5cf8408)

  ### Documentation

  - add ody task import docs page (65a6af9)
  - add auth command documentation (057bad7)

  ### Maintenance

  - update readme (21796c3)
  - update CI workflows, various CLI improvements/reliability (553f0b0)

## 0.3.0

### Minor Changes

- ### Features

  - enable import task from GitHub issue (72a828c)
  - add auth list command (5091c5e)
  - add auth + import (jira) commands (cf2d643)

  ### Bug Fixes

  - Fix early exit during ody run (170c7d1)

  ### Documentation

  - add documentation page for ody update command (#7) (61f144b)

## 0.2.1

### Patch Changes

- ### Bug Fixes

  - breaking cmds that dont require config (94ea485)

  ### Maintenance

  - use generated changelog for release body (1730b6f)

## 0.2.0

### Minor Changes

- ### Features

  - add self-update command (6e998aa)
  - add file argument to plan command for batch task generation (24243f0)

  ### Bug Fixes

  - better error handling for Config (d42bbb3)

  ### Maintenance

  - cleanup installation command (4b59ac6)

## 0.1.2

### Patch Changes

- ### Features

  - integrate config schema generation into release pipeline (8e65b62)
  - add user-facing install script for platform binary downloads (2d3fe58)
  - add binaries GitHub Actions workflow for cross-platform builds (5989a0f)
  - add release tag GitHub Actions workflow (4e937de)
  - add prepare release GitHub Actions workflow (6f226ab)
  - initialize changesets for version management (d534e3c)
  - add package metadata to @ody/cli for release pipeline (a117177)
  - gen configuration schema (f3cec38)
  - extend compact command to archive progress and use date subdirectories (e82b9db)
  - update run command spinner messaging (370cd13)
  - collect all plan descriptions before prompting agent (2ab806f)
  - move plan commands to task namespace (92552eb)
  - add configurable agent field to ody config (aa16c6e)
  - add plan compact subcommand for archiving completed tasks (70c6f54)
  - add task file positional argument to run command (cf49ddd)
  - add plan edit subcommand for editing existing task plans (16c4338)
  - add global config file support with merge strategy (8580739)
  - add OS notifications on agent loop completion (9613c9d)
  - add plan list subcommand for viewing pending tasks (407b583)
  - add PTY-based completion detection to --once mode (91fa168)
  - add --iterations/-i flag to run command (989f130)
  - add config command to display current configuration (e7550c0)
  - remove confirmation prompt from plan command (1c1f7d2)
  - add unit tests for util modules, configurable tasks directory, and label filter for run command (1436249)
  - Convert to storing tasks as markdown files instead of JSON file (856081c)

  ### Bug Fixes

  - release pipeline (76483b2)
  - tests (f9e0ad5)
  - spacing on plan list cmd, skip notify tests (5d73ee8)

  ### Refactors

  - promote compact to root-level command (4fe56e7)
  - batch plan description collection before agent prompting (15075fd)
  - remove --once flag and buildOnceCommand from run command (67f42ac)

  ### Documentation

  - add installation section to README (c1aa758)

  ### Maintenance

  - generate changelog (417c174)
  - planning future features (5f6726b)
  - add unit tests for lib directory (config, logger, notify, sequencer) (b52843c)
  - update readme (4e6d413)
  - start planning docs website (d153068)
  - refactor using readdir to using Bun.Glob (38293a2)
  - refactor plan cmd definition, lazy load cmds, bump bun version and deps (70405b0)
  - minor plan command cleanup (df856fb)
  - create release plan (1fff60f)
  - Run tests in CI (aea1733)
  - convert to monorepo (062dfc2)
  - set up CI (4604a3b)
  - clean up prompt creation (8b1eca3)

## 0.1.1

### Patch Changes

- ### Features

  - integrate config schema generation into release pipeline (8e65b62)
  - add user-facing install script for platform binary downloads (2d3fe58)
  - add binaries GitHub Actions workflow for cross-platform builds (5989a0f)
  - add release tag GitHub Actions workflow (4e937de)
  - add prepare release GitHub Actions workflow (6f226ab)
  - initialize changesets for version management (d534e3c)
  - add package metadata to @ody/cli for release pipeline (a117177)
  - gen configuration schema (f3cec38)
  - extend compact command to archive progress and use date subdirectories (e82b9db)
  - update run command spinner messaging (370cd13)
  - collect all plan descriptions before prompting agent (2ab806f)
  - move plan commands to task namespace (92552eb)
  - add configurable agent field to ody config (aa16c6e)
  - add plan compact subcommand for archiving completed tasks (70c6f54)
  - add task file positional argument to run command (cf49ddd)
  - add plan edit subcommand for editing existing task plans (16c4338)
  - add global config file support with merge strategy (8580739)
  - add OS notifications on agent loop completion (9613c9d)
  - add plan list subcommand for viewing pending tasks (407b583)
  - add PTY-based completion detection to --once mode (91fa168)
  - add --iterations/-i flag to run command (989f130)
  - add config command to display current configuration (e7550c0)
  - remove confirmation prompt from plan command (1c1f7d2)
  - add unit tests for util modules, configurable tasks directory, and label filter for run command (1436249)
  - Convert to storing tasks as markdown files instead of JSON file (856081c)

  ### Bug Fixes

  - tests (f9e0ad5)
  - spacing on plan list cmd, skip notify tests (5d73ee8)

  ### Refactors

  - promote compact to root-level command (4fe56e7)
  - batch plan description collection before agent prompting (15075fd)
  - remove --once flag and buildOnceCommand from run command (67f42ac)

  ### Documentation

  - add installation section to README (c1aa758)

  ### Maintenance

  - generate changelog (417c174)
  - planning future features (5f6726b)
  - add unit tests for lib directory (config, logger, notify, sequencer) (b52843c)
  - update readme (4e6d413)
  - start planning docs website (d153068)
  - refactor using readdir to using Bun.Glob (38293a2)
  - refactor plan cmd definition, lazy load cmds, bump bun version and deps (70405b0)
  - minor plan command cleanup (df856fb)
  - create release plan (1fff60f)
  - Run tests in CI (aea1733)
  - convert to monorepo (062dfc2)
  - set up CI (4604a3b)
  - clean up prompt creation (8b1eca3)
