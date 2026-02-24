# Electron Desktop App Plan

Plan for an Electron-based desktop application that replicates the full functionality of `@ody/cli` as a standalone GUI, sharing core logic via focused internal workspace packages (`@internal/*`).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Workspace Restructure](#workspace-restructure)
3. [Internal Packages](#internal-packages)
4. [Electron App Package (`@ody/desktop`)](#electron-app-package-odydesktop)
5. [Feature Mapping: CLI to Desktop](#feature-mapping-cli-to-desktop)
6. [IPC Contract](#ipc-contract)
7. [UI Design](#ui-design)
8. [Design System](#design-system)
9. [Process Spawning & Agent Streaming](#process-spawning--agent-streaming)
10. [Notification System](#notification-system)
11. [Build & Distribution](#build--distribution)
12. [Migration Steps](#migration-steps)
13. [Resolved Decisions](#resolved-decisions)

---

## Architecture Overview

```
+------------------------------------------------------+
|                  Electron App                         |
|                                                       |
|  +------------------+       +----------------------+  |
|  |  Renderer (React) | <--> |  Main Process (Node) |  |
|  |  - UI components  | IPC  |  - @internal/*       |  |
|  |  - State mgmt     |      |  - child_process     |  |
|  |  - xterm.js       |      |  - fs/path           |  |
|  +------------------+       +----------------------+  |
|                                      |                |
|                                      | spawn          |
|                                      v                |
|                              +---------------+        |
|                              | claude/opencode|       |
|                              | /codex binary  |       |
|                              +---------------+        |
+------------------------------------------------------+

+------------------------------------------------------+
|              Internal Packages                        |
|                                                       |
|  @internal/config       Config, constants, schema     |
|  @internal/backends     Harness, command builders     |
|  @internal/builders     Prompt templates              |
|  @internal/tasks        Task file utilities, types    |
|  @internal/auth         Credential store              |
|  @internal/integrations Jira, GitHub, HTTP clients    |
+------------------------------------------------------+
```

The desktop app does NOT invoke or wrap the CLI binary. It imports `@internal/*` packages directly for config, prompt building, backend command construction, task parsing, authentication, and external integrations -- then spawns agent processes itself from the Electron main process.

---

## Workspace Restructure

Current structure:

```
packages/
  cli/              # @ody/cli
```

Proposed structure:

```
packages/
  cli/              # @ody/cli (refactored to import from @internal/*)
  desktop/          # @ody/desktop (Electron app)
internal/
  config/           # @internal/config
  backends/         # @internal/backends
  builders/         # @internal/builders
  tasks/            # @internal/tasks
  auth/             # @internal/auth
  integrations/     # @internal/integrations
```

Root `package.json` workspaces becomes `["packages/*", "internal/*"]`.

---

## Internal Packages

### Package Dependency Graph

```
@internal/auth  (leaf -- no internal deps)
    ^
    |
@internal/integrations

@internal/config  (base -- constants, config schema)
    ^       ^       ^
    |       |       |
@internal/  @internal/  @internal/
backends    builders    tasks
```

### Runtime Compatibility

All `@internal/*` packages must run in both Bun (for CLI) and Node.js (for Electron main process). This means:

- No `Bun.*` APIs in internal packages.
- Use `node:fs/promises` for file I/O.
- Use `node:path` for path operations.
- Use `node:child_process` for process detection (replacing `Bun.which`).
- Use a portable glob library or `node:fs` recursive readdir.
- `zod` works in both runtimes (no changes needed).

Alternatively, if Electron is built using Electron Forge with a custom Bun-based build pipeline, Bun APIs could work -- but this is fragile and not recommended. Node compatibility is the safer path.

No build step is needed for internal packages when consumed within the monorepo (both Bun and Electron's bundler can consume TypeScript source directly).

---

### `@internal/config`

Config loading, parsing, merging, validation, constants, and sequencer.

#### What Gets Extracted

| Current Location    | Internal Module | Changes Needed                                                                                        |
| ------------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| `lib/config.ts`     | `config.ts`     | Remove `@clack/prompts` log calls. Return errors instead of logging + exiting. Remove `process.exit`. |
| `lib/sequencer.ts`  | `sequencer.ts`  | None -- pure function.                                                                                |
| `util/constants.ts` | `constants.ts`  | None -- pure values.                                                                                  |

#### API Surface

```typescript
// @internal/config

// Config
export { Config, configSchema } from './config';
export type { OdyConfig } from './config';
// Config namespace members: Config.Schema, Config.load(), Config.parse(),
// Config.all(), Config.get(), Config.resolveModel(), Config.shouldSkipConfig()

// Constants
export {
  BASE_DIR,
  ODY_FILE,
  TASKS_DIR,
  ALLOWED_BACKENDS,
  DOCS_WEBSITE_URL,
  GITHUB_REPO,
} from './constants';

// Sequencer
export { createSequencer } from './sequencer';
```

#### Config Schema (Complete)

| Field               | Type                                                   | Default   | Required | Description                                          |
| ------------------- | ------------------------------------------------------ | --------- | -------- | ---------------------------------------------------- |
| `backend`           | `'opencode' \| 'claude' \| 'codex'`                    | --        | yes      | Backend harness                                      |
| `maxIterations`     | `number` (int, >= 0)                                   | --        | yes      | Max loop iterations (0 = infinite)                   |
| `shouldCommit`      | `boolean`                                              | `false`   | no       | Generate commit after each iteration                 |
| `validatorCommands` | `string[]`                                             | `[]`      | no       | Shell commands for validation                        |
| `model`             | `string \| { run: string; plan: string; edit: string}` | --        | no       | Model for the backend (string or per-command object) |
| `skipPermissions`   | `boolean`                                              | `true`    | no       | Skip Claude Code permission checks                   |
| `agent`             | `string` (nonempty)                                    | `'build'` | no       | Harness agent profile/persona                        |
| `tasksDir`          | `string` (nonempty)                                    | `'tasks'` | no       | Custom path for tasks directory                      |
| `notify`            | `boolean \| 'all' \| 'individual'`                     | `false`   | no       | OS notification preference                           |
| `jira`              | `{ baseUrl: url; profile?: string }`                   | --        | no       | Jira integration settings                            |
| `github`            | `{ profile?: string }`                                 | --        | no       | GitHub integration settings                          |

`Config.Schema` is a strict variant of the schema with `.describe()` annotations and `.strict()` mode, plus an optional `$schema` field. It is used for JSON schema generation (exported to docs).

`Config.resolveModel(command: 'run' | 'plan' | 'edit')` resolves the model for a specific command. If `model` is a string, it returns it for all commands. If `model` is an object `{ run, plan, edit }`, it returns the command-specific value.

`Config.shouldSkipConfig(cmd)` returns `true` for commands that don't need config loaded (`auth`, `init`, `update`).

#### Package Configuration

```jsonc
// internal/config/package.json
{
  "name": "@internal/config",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zod": "^4.3.6",
  },
}
```

---

### `@internal/backends`

Backend harness abstraction, concrete implementations, and backend detection.

#### What Gets Extracted

| Current Location       | Internal Module | Changes Needed                                                                                                                         |
| ---------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `backends/harness.ts`  | `harness.ts`    | None -- already pure types.                                                                                                            |
| `backends/backend.ts`  | `backend.ts`    | None -- pure factory.                                                                                                                  |
| `backends/claude.ts`   | `claude.ts`     | None -- pure data transformation.                                                                                                      |
| `backends/opencode.ts` | `opencode.ts`   | None -- pure data transformation.                                                                                                      |
| `backends/codex.ts`    | `codex.ts`      | None -- pure data transformation.                                                                                                      |
| `backends/util.ts`     | `util.ts`       | Replace `Bun.which()` with a runtime-agnostic helper (fallback to Node's `child_process.execSync('which ...')` or `where` on Windows). |

#### API Surface

```typescript
// @internal/backends

export { Backend } from './backend';
export { Harness } from './harness';
export type { CommandOptions } from './harness';
export { getAvailableBackends } from './util';
```

#### Backend Command Modes

Each backend has two command-building methods:

- **`buildCommand(prompt, opts?)`** -- Non-interactive mode. Used for loop-based agent runs. Produces a command that reads a prompt, executes, and exits.
- **`buildInteractiveCommand(prompt, opts?)`** -- Interactive mode. Used for PTY/terminal sessions (e.g., `ody task edit`). Produces a command suitable for direct user interaction.

Backend-specific details:

| Backend      | Non-Interactive (`buildCommand`)                                                                                             | Interactive (`buildInteractiveCommand`)                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Claude**   | `claude --dangerously-skip-permissions --disallowedTools=TodoWrite,... --model M --verbose --output-format stream-json -p P` | `claude --dangerously-skip-permissions --disallowedTools=... --model M P` (no `-p`, no `--verbose`, no `--output-format`) |
| **Opencode** | `opencode --agent A -m M run P`                                                                                              | `opencode --agent A -m M --prompt P` (uses `--prompt` instead of `run`)                                                   |
| **Codex**    | `codex exec --yolo -m M P`                                                                                                   | `codex -m M P` (no `exec`, no `--yolo`)                                                                                   |

---

### `@internal/builders`

All prompt template builders for run, plan, edit, import, and inline edit operations.

#### What Gets Extracted

| Current Location             | Internal Module       | Changes Needed                                                                                                                                                                         |
| ---------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `builders/shared.ts`         | `shared.ts`           | None -- pure constant (`TASK_FILE_FORMAT`).                                                                                                                                            |
| `builders/runPrompt.ts`      | `runPrompt.ts`        | None -- pure string templates.                                                                                                                                                         |
| `builders/planPrompt.ts`     | `planPrompt.ts`       | None -- pure string templates. Includes both `buildPlanPrompt` and `buildBatchPlanPrompt`.                                                                                             |
| `builders/editPlanPrompt.ts` | `editPlanPrompt.ts`   | None -- pure string templates.                                                                                                                                                         |
| `builders/importPrompt.ts`   | `importPrompt.ts`     | None -- pure string templates. Builds prompts from Jira ticket or GitHub issue data.                                                                                                   |
| _(new)_                      | `inlineEditPrompt.ts` | New builder for the desktop editor's Cmd+K AI edit flow. Takes file content, optional selection range, and user instruction. Instructs the agent to output the complete modified file. |

#### API Surface

```typescript
// @internal/builders

// Run
export { buildRunPrompt, LOOP_PROMPT, SINGLE_TASK_PROMPT } from './runPrompt';

// Plan
export { buildPlanPrompt, buildBatchPlanPrompt } from './planPrompt';

// Edit
export { buildEditPlanPrompt } from './editPlanPrompt';

// Import
export { buildImportPrompt } from './importPrompt';
export type { ImportSource } from './importPrompt'; // 'github' | 'jira'

// Inline edit (desktop)
export { buildInlineEditPrompt } from './inlineEditPrompt';

// Shared
export { TASK_FILE_FORMAT } from './shared';
```

#### Prompt Builder Details

**`buildRunPrompt(options?)`** -- Two internal templates:

- `LOOP_PROMPT` (multi-task, default): Finds highest-priority pending task, sets status to `in_progress`, implements it, runs validation commands, sets status to `completed`, appends progress to `.ody/progress.txt`, optionally commits. Outputs `<woof>COMPLETE</woof>` when all tasks done.
- `SINGLE_TASK_PROMPT` (when `taskFile` is provided): Same flow but for a specific task file.
- Template variables: `{TASKS_DIR}`, `{VALIDATION_COMMANDS}`, `{PROGRESS_FILE}`, `{SHOULD_COMMIT}`, `{TASK_FILE}`.
- Label filter: If `taskFiles` array is provided, appends a `LABEL FILTER` section restricting the agent to those files.

**`buildPlanPrompt({ description })`** -- Creates exactly one `.code-task.md` file from a natural language description. Uses `TASK_FILE_FORMAT`.

**`buildBatchPlanPrompt({ filePath })`** -- Reads a planning document file and creates as many `.code-task.md` files as needed. Each follows the task file format.

**`buildEditPlanPrompt({ filePath })`** -- Interactive session for editing an existing task plan in place. Preserves YAML frontmatter and all required sections.

**`buildImportPrompt({ data, source })`** -- Two variants based on `source`:

- `'jira'`: Maps Jira ticket summary to task name, description/comments to sections, ticket key to labels, priority to complexity.
- `'github'`: Maps GitHub issue title to task name, body/comments to sections, issue reference to labels, issue labels to complexity.

**`buildInlineEditPrompt()`** -- _(New)_ Takes file content, optional selection range, and user instruction. Instructs the agent to output the complete modified file.

---

### `@internal/tasks`

Task file utilities for parsing, listing, filtering, and status management.

#### What Gets Extracted

| Current Location | Internal Module | Changes Needed                                                                                                                                                 |
| ---------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `util/task.ts`   | `task.ts`       | Replace `Bun.Glob` with a Node-compatible glob (e.g., `fast-glob` or `node:fs` + manual filtering). Replace `Bun.file().text()` with `fs/promises.readFile()`. |
| `types/task.ts`  | `types.ts`      | None -- pure types.                                                                                                                                            |

#### API Surface

```typescript
// @internal/tasks

// Task file utilities
export {
  resolveTasksDir,
  parseFrontmatter,
  parseTitle,
  parseDescription,
  getTaskFilesByLabel,
  getTaskFilesInDir,
  getTaskFilesInTasksDir,
  getTaskStatus,
  getTaskStates,
  mapWithConcurrency,
} from './task';

export type { TaskState } from './task';

// Types
export type { CompletedTask } from './types';
```

#### Function Details

| Function                                         | Purpose                                                                       |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `resolveTasksDir(tasksDir?)`                     | Resolves full tasks directory path (`BASE_DIR/tasksDir` or from config)       |
| `parseFrontmatter(content)`                      | Parses YAML-like frontmatter between `---` delimiters into key-value pairs    |
| `parseTitle(content)`                            | Extracts `# Task: ...` heading, returns `'Untitled'` if not found             |
| `parseDescription(content)`                      | Extracts `## Description` section, condenses to 2-3 sentences (max 200 chars) |
| `getTaskFilesByLabel(label, tasksDir?)`          | Reads all task files, filters by `**Labels**: ...` pattern (case-insensitive) |
| `getTaskFilesInDir(tasksDir)`                    | Scans directory for `*.code-task.md` files, returns sorted filenames          |
| `getTaskFilesInTasksDir(tasksDir?)`              | Delegates to `getTaskFilesInDir` with resolved path                           |
| `getTaskStatus(taskFilePath)`                    | Reads file, parses frontmatter, returns status field                          |
| `getTaskStates(taskFiles?, tasksDir?)`           | Gets status for each task file with bounded concurrency                       |
| `mapWithConcurrency(items, concurrency, mapper)` | Runs async mapper over items with bounded concurrency, preserves order        |

---

### `@internal/auth`

Credential store for Jira and GitHub authentication, managed by named profiles.

#### What Gets Extracted

| Current Location | Internal Module | Changes Needed                                                                                          |
| ---------------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| `lib/auth.ts`    | `auth.ts`       | Replace `Bun.write`/`Bun.file` with `node:fs/promises`. Replace `Bun.spawn` chmod with `node:fs.chmod`. |

#### API Surface

```typescript
// @internal/auth

export { Auth } from './auth';
export type { JiraCredentials, GitHubCredentials, AuthStore } from './auth';
```

#### Auth Namespace Members

| Member                                 | Purpose                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `Auth.resolveAuthPath()`               | Returns `$XDG_DATA_HOME/ody/auth.json` or `~/.local/share/ody/auth.json` |
| `Auth.load()`                          | Reads and parses `auth.json`, returns empty object if not found          |
| `Auth.save(store)`                     | Creates dir, writes JSON, sets chmod `0o600` for security                |
| `Auth.getJira(profile?)`               | Returns Jira credentials for a profile (default: `'default'`)            |
| `Auth.setJira(profile, credentials)`   | Saves Jira email + API token under a named profile                       |
| `Auth.getGitHub(profile?)`             | Returns GitHub credentials for a profile (default: `'default'`)          |
| `Auth.setGitHub(profile, credentials)` | Saves GitHub personal access token under a named profile                 |

Credential types:

```typescript
type JiraCredentials = { email: string; apiToken: string };
type GitHubCredentials = { token: string };
type AuthStore = {
  jira?: Record<string, JiraCredentials>;
  github?: Record<string, GitHubCredentials>;
};
```

#### Package Configuration

```jsonc
// internal/auth/package.json
{
  "name": "@internal/auth",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {},
}
```

---

### `@internal/integrations`

Jira and GitHub API clients, plus shared HTTP retry utilities.

#### What Gets Extracted

| Current Location | Internal Module | Changes Needed                                                                                     |
| ---------------- | --------------- | -------------------------------------------------------------------------------------------------- |
| `lib/jira.ts`    | `jira.ts`       | None -- uses standard `fetch` and string parsing. Compatible with both Bun and Node.               |
| `lib/github.ts`  | `github.ts`     | None -- uses standard `fetch` and string parsing. Compatible with both Bun and Node.               |
| `lib/http.ts`    | `http.ts`       | None -- uses standard `fetch`, `AbortController`, and `setTimeout`. Compatible with both runtimes. |

#### API Surface

```typescript
// @internal/integrations

// Jira
export { Jira } from './jira';
export type { JiraTicket, ParsedInput as JiraParsedInput } from './jira';

// GitHub
export { GitHub } from './github';
export type { GitHubIssue, ParsedIssueInput } from './github';

// HTTP
export { Http } from './http';
```

#### Jira Namespace Members

| Member                                   | Purpose                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `Jira.parseInput(input, configBaseUrl?)` | Parses URL (`/browse/PROJ-123`) or bare ticket key (`PROJ-123`). Requires `configBaseUrl` for bare keys. |
| `Jira.fetchTicket(baseUrl, key, auth?)`  | Calls Jira REST API v3. Uses Basic auth (email + API token). Retries with 6s timeout, 2 retries.         |
| `Jira.formatAsDescription(ticket)`       | Formats ticket data as a multiline text block for prompt consumption.                                    |

#### GitHub Namespace Members

| Member                                           | Purpose                                                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `GitHub.parseInput(input)`                       | Parses full URL (`https://github.com/owner/repo/issues/N`) or shorthand (`owner/repo#N`).                  |
| `GitHub.fetchIssue(owner, repo, number, token?)` | Calls GitHub API v3. Fetches issue + comments. Uses Bearer token auth. Retries with 6s timeout, 2 retries. |
| `GitHub.formatAsDescription(issue, owner, repo)` | Formats issue data as a multiline text block for prompt consumption.                                       |

#### HTTP Retry Utilities

`Http.fetchWithRetry(input, init?, options?)` wraps `fetch` with:

- Configurable timeout via `AbortController` (default 5s)
- Retry on 408, 429, 5xx status codes
- Retry on `TypeError`, `AbortError`, and timeout errors
- Exponential backoff with jitter (default: 250ms base, 2s max, 0.2 jitter ratio)
- Up to 2 retries by default

#### Package Configuration

```jsonc
// internal/integrations/package.json
{
  "name": "@internal/integrations",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@internal/auth": "workspace:*",
  },
}
```

---

## Electron App Package (`@ody/desktop`)

### Technology Choices

| Concern            | Choice                                                 | Rationale                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Electron                                               | Per the plan's scope; team is JS/TS.                                                                                                                                                                                                                                                                                                               |
| Build tooling      | Electron Forge + Vite                                  | Modern, fast bundling. Forge handles packaging/signing.                                                                                                                                                                                                                                                                                            |
| Frontend framework | React                                                  | Component model maps well to the multi-panel UI. Wide ecosystem.                                                                                                                                                                                                                                                                                   |
| Component library  | shadcn/ui                                              | Accessible, composable React components built on Radix UI primitives. Installed on-demand via CLI (`npx shadcn add`). Styled via CSS variables, fully compatible with Tailwind v4 and the Art Deco design system. Not a dependency -- components are copied into the project and owned by the team.                                                |
| State management   | Zustand                                                | Lightweight, works well with React. No boilerplate.                                                                                                                                                                                                                                                                                                |
| Terminal emulation | xterm.js                                               | Standard for embedded terminals. Needed for `--once` equivalent (PTY mode).                                                                                                                                                                                                                                                                        |
| Code editor        | CodeMirror 6                                           | Lightweight (~130KB), excellent markdown support, extensible. Used by Obsidian, Replit. `@codemirror/merge` provides built-in diff view.                                                                                                                                                                                                           |
| Styling            | Tailwind CSS v4                                        | Utility-first, fast iteration, good for data-dense UIs. v4 uses CSS-first configuration via `@theme` directive -- no `tailwind.config.js`. Integrated via `@tailwindcss/vite` plugin instead of PostCSS.                                                                                                                                           |
| Animation          | tw-animate-css                                         | shadcn's recommended CSS animation utility for Tailwind v4. Provides ready-made animation classes for entrances, exits, and transitions used by shadcn components.                                                                                                                                                                                 |
| Theming            | Light + Dark, OS default                               | Follow OS preference via `nativeTheme.shouldUseDarkColors`. User can override in settings. Dark mode via `@custom-variant dark (&:is(.dark *))` (Tailwind v4 class-based pattern). shadcn CSS variable convention (`:root` / `.dark` blocks) with `@theme inline` bridge to Tailwind utilities. CSS custom properties for CodeMirror/xterm themes. |
| IPC layer          | Electron `ipcMain` / `ipcRenderer` via `contextBridge` | Standard secure pattern. Preload script exposes typed API.                                                                                                                                                                                                                                                                                         |

### Directory Structure

```
packages/desktop/
  package.json
  components.json              # shadcn/ui CLI configuration (style, aliases, base color)
  forge.config.ts              # Electron Forge configuration
  vite.main.config.ts          # Vite config for main process
  vite.preload.config.ts       # Vite config for preload script
  vite.renderer.config.ts      # Vite config for renderer (includes @tailwindcss/vite plugin)
  tsconfig.json
  src/
    main/
      index.ts                 # Electron main process entry
      ipc.ts                   # IPC handler registration
      agent.ts                 # Agent process spawning & streaming
      windows.ts               # Window management
    preload/
      index.ts                 # contextBridge API exposure
    renderer/
      index.html
      main.tsx                 # React entry
      globals.css              # Tailwind v4 entry: @import "tailwindcss", @import "tw-animate-css",
                               #   @custom-variant dark, :root/:dark CSS vars, @theme inline, @theme tokens
      App.tsx
      components/
        ui/                    # shadcn/ui components (installed via `npx shadcn add <component>`)
          button.tsx
          card.tsx
          badge.tsx
          dialog.tsx
          dropdown-menu.tsx
          input.tsx
          select.tsx
          switch.tsx
          tabs.tsx
          radio-group.tsx
          sonner.tsx           # Toast notification wrapper (uses sonner library)
          # Additional components added on-demand via `npx shadcn add`
        Layout.tsx
        Sidebar.tsx
        TaskBoard.tsx
        TaskCard.tsx
        TaskEditor.tsx          # Full editor view (hosts CodeMirror + AI prompt)
        ConfigPanel.tsx
        InitWizard.tsx
        AgentRunner.tsx
        AgentOutput.tsx         # Streaming output display
        TerminalView.tsx        # xterm.js wrapper for PTY mode
        PlanCreator.tsx
        PlanList.tsx
        ArchiveViewer.tsx
        ProjectList.tsx         # Sidebar project list with add/remove/switch
        NotificationBanner.tsx
        AuthPanel.tsx           # Jira/GitHub credential management
        TaskImport.tsx          # Import tasks from Jira/GitHub issues
        ProgressViewer.tsx      # View .ody/progress.txt contents
        editor/
          MarkdownEditor.tsx    # CodeMirror 6 wrapper with markdown extensions
          InlinePrompt.tsx      # Cmd+K floating prompt input
          DiffView.tsx          # Side-by-side diff using @codemirror/merge
          EditorToolbar.tsx     # Save, undo/redo, AI Edit button, status
      hooks/
        useProjects.ts          # Project list, active project, switching
        useConfig.ts
        useTasks.ts
        useAgent.ts
        useEditor.ts            # Editor state, AI edit lifecycle, diff management
        useTheme.ts             # Theme state, OS sync, class toggling on <html>
        useNotifications.ts
        useAuth.ts              # Auth profile management, credential CRUD
        useImport.ts            # Task import state, source selection, fetch lifecycle
      store/
        index.ts                # Zustand store
        slices/
          projectSlice.ts       # Project list, active project
          configSlice.ts
          taskSlice.ts
          agentSlice.ts
          authSlice.ts          # Auth credentials state
      lib/
        utils.ts                # cn() utility (clsx + tailwind-merge) for className composition
        api.ts                  # Typed wrapper around window.ody IPC
      types/
        ipc.ts                  # Shared IPC channel + payload types
```

---

## Feature Mapping: CLI to Desktop

### `ody init` -> Init Wizard Panel

| CLI Behavior                                   | Desktop Equivalent                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `@clack/prompts` autocomplete for backend      | Dropdown/combobox with detected backends                                                           |
| Text input for model                           | Text input field (with auto-detect button for opencode -- fetches available models via subprocess) |
| Per-command model object `{ run, plan, edit }` | Toggle between "Single model" and "Per-command" mode; per-command shows three text inputs          |
| Text input for agent profile (default "build") | Text input with default value                                                                      |
| Confirm + loop for validator commands          | Dynamic list builder (add/remove/reorder)                                                          |
| `skipPermissions` toggle for Claude            | Checkbox (shown only when Claude is the selected backend)                                          |
| `tasksDir` (default "tasks")                   | Text input with default value                                                                      |
| Notification preference select                 | Radio group (Disabled / On completion / Per iteration)                                             |
| Jira config (`baseUrl`, `profile`)             | Jira section: URL input for base URL, dropdown for auth profile                                    |
| GitHub config (`profile`)                      | GitHub section: dropdown for auth profile                                                          |
| `--dry-run` prints config                      | "Preview" button shows JSON before saving                                                          |
| Writes `.ody/ody.json`                         | Same -- writes via main process IPC                                                                |

**UI:** A stepped wizard dialog (or a single form panel) within the main window. Accessed from sidebar or on first launch if no config exists. The wizard's backend selector only shows detected backends (from `getAvailableBackends()`). Integration sections (Jira/GitHub) are collapsible and optional.

### `ody run` -> Agent Runner Panel

| CLI Behavior                      | Desktop Equivalent                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spinner with iteration count      | Progress bar + iteration counter in UI                                                                                                                          |
| `--verbose` streams output        | Always-visible output panel (collapsible). Scrolling log view.                                                                                                  |
| `--once` PTY mode                 | Embedded terminal (xterm.js + node-pty) in a tab/panel                                                                                                          |
| `<woof>COMPLETE</woof>` detection | Same logic in main process; sends `agent:complete` IPC event                                                                                                    |
| Ambiguous marker detection        | Warning banner in output panel if partial `<woof>` tags found without exact match                                                                               |
| Post-run task verification        | After each iteration: single-task mode checks status is `completed`; multi-task mode scans all task states for unresolved tasks. Failures shown as error in UI. |
| `--label` filter                  | Label chips/filter bar above task list                                                                                                                          |
| `--iterations` override           | Number input in run configuration                                                                                                                               |
| `--no-notify`                     | Toggle in settings or run config                                                                                                                                |
| Task file positional arg          | Click-to-run on a specific task card                                                                                                                            |
| `--dry-run`                       | "Show Command" button that displays the command array                                                                                                           |
| Notification on completion        | Electron `Notification` API (native OS notification)                                                                                                            |
| Progress file `.ody/progress.txt` | Collapsible "Progress" section in Run View showing file contents                                                                                                |

**Run Confirmation Modal:** Clicking "Run" on a task card opens a confirmation modal before starting the agent:

```
Run Task
+----------------------------------------------------------+
|  [>]  Run Task                                           |
|       Start the agent on this task? It will run in the   |
|       background.                                        |
|                                                          |
|  +----------------------------------------------------+  |
|  | Implement Rate Limiting for API Endpoints           |  |
|  +----------------------------------------------------+  |
|                                                          |
|  +----------------------------------------------------+  |
|  | Backend: opencode          Iterations: 5            |  |
|  +----------------------------------------------------+  |
|                                                          |
|  +----------------------------------------------------+  |
|  | Auto-commit                               [toggle]  |  |
|  | Commit changes after each iteration                 |  |
|  +----------------------------------------------------+  |
|                                                          |
|                           [Cancel]  [> Start Agent]      |
+----------------------------------------------------------+
```

The modal displays the active backend and iteration count from config. The auto-commit toggle maps to the `shouldCommit` config value and can be overridden per-run.

**Stop Agent Modal:** Clicking "Stop" on an in-progress task opens a confirmation modal with two stop modes:

```
Stop Agent
+----------------------------------------------------------+
|  [!]  Stop Agent                                         |
|       The agent is currently running. Stopping it may    |
|       leave changes in an incomplete state.              |
|                                                          |
|  +----------------------------------------------------+  |
|  | Refactor Authentication Middleware                  |  |
|  | (*) Running  Iteration 2 of 5                      |  |
|  +----------------------------------------------------+  |
|                                                          |
|  (*) Graceful stop                                       |
|      Finish current iteration, then stop                 |
|                                                          |
|  ( ) Force stop                                          |
|      Terminate immediately (may leave partial changes)   |
|                                                          |
|                      [Keep Running]  [Stop Agent]        |
+----------------------------------------------------------+
```

- **Graceful stop**: Sets the `aborted` flag so the loop exits after the current iteration completes naturally.
- **Force stop**: Sends `SIGKILL` to terminate the agent process immediately. A warning notes this may leave partial file changes.
- "Keep Running" dismisses the modal without action.
- "Stop Agent" is styled with amber (warning) color.

**UI:** The primary view. Split layout:

- Left: Primary sidebar with projects list
- Center: streaming agent output (auto-scrolling log or embedded terminal)
- Top bar: run controls (start, stop, iteration count, verbose toggle)
- Right: task list (filterable by label/status)
- Bottom (collapsible): progress notes from `.ody/progress.txt`

### `ody config` -> Config Panel

| CLI Behavior          | Desktop Equivalent                                        |
| --------------------- | --------------------------------------------------------- |
| Prints JSON to stdout | Settings panel showing current config as an editable form |
| Warning if no config  | Empty state with "Run Setup" CTA                          |

**UI:** Accessible from sidebar. Shows all config values with inline editing. Save button validates via `Config.parse()` from `@internal/config` and writes. See the [Config View](#config-view) section under UI Design for the full wireframe.

### `ody auth` -> Auth Management Panel

| CLI Behavior                                        | Desktop Equivalent                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `ody auth jira` prompts for email + API token       | Form with email text input + API token password input                                                   |
| `ody auth github` prompts for personal access token | Form with PAT password input                                                                            |
| `ody auth list` shows configured credentials        | Table listing all profiles with masked tokens (last 6 chars visible)                                    |
| `--profile` named profiles                          | Profile selector dropdown + "Add Profile" button                                                        |
| Active profile indicator (from config)              | "(active)" badge next to profile in table, derived from `config.jira.profile` / `config.github.profile` |
| Stored in `$XDG_DATA_HOME/ody/auth.json`            | Same path -- read/write via main process IPC                                                            |
| `chmod 0o600` on auth file                          | Same -- handled by `@internal/auth` in main process                                                     |

**UI:** A panel accessible from the sidebar (under a "Settings" or "Integrations" group). Two tabs: **Jira** and **GitHub**.

```
Auth Management
+---------+---------+
| Jira    | GitHub  |
+---------+---------+

Profiles:
+----------------------------------------------------------+
| Profile    | Email              | Token     | Status      |
|------------|--------------------|-----------| ------------|
| default    | user@company.com   | ******abc | (active)    |
| staging    | user@company.com   | ******xyz |             |
+----------------------------------------------------------+
                         [Edit]  [Delete]  [+ Add Profile]

Add / Edit Profile:
+----------------------------------------------------------+
| Profile name: [default          ]                        |
| Email:        [user@company.com ]                        |
| API Token:    [*****************]                        |
|                                                          |
|                              [Cancel]  [Save Credentials]|
+----------------------------------------------------------+
```

Tokens are always masked in the UI. The full token value is only sent from main process to renderer for the edit form's initial state (via IPC), never stored in renderer state after the form closes.

### `ody task import` -> Task Import Panel

| CLI Behavior                             | Desktop Equivalent                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `--jira PROJ-123` or Jira URL            | Source selector (Jira / GitHub) + text input for ticket key or URL                               |
| `--github owner/repo#123` or GitHub URL  | Same input -- auto-detects format via `Jira.parseInput()` / `GitHub.parseInput()`                |
| Fetches ticket/issue data via REST API   | Loading state with fetched data preview before agent spawn                                       |
| Formats data via `formatAsDescription()` | Preview pane shows the formatted data that will be sent to the agent                             |
| Spawns agent to generate `.code-task.md` | Same spawn + stream; output renders in a live preview panel                                      |
| `--dry-run` shows prompt                 | "Preview Prompt" button shows the full prompt without executing                                  |
| `--verbose` streams agent output         | Always-visible streaming output (same as Run View pattern)                                       |
| Requires auth credentials                | Checks for credentials before fetch; shows "Configure credentials" link to Auth Panel if missing |

**UI:** A panel accessible from the Task Board toolbar ("Import" button) or sidebar. Stepped flow:

```
Import Task
+----------------------------------------------------------+
| Source:  (*) Jira  ( ) GitHub                            |
|                                                          |
| Ticket:  [PROJ-123                              ] [Fetch]|
|                                                          |
| --- Fetched Preview ------------------------------------ |
| Title: Implement rate limiting for API                   |
| Status: In Progress  |  Priority: High                  |
| Labels: backend, api                                     |
| Description:                                             |
|   Add rate limiting to prevent abuse of the public API...|
|                                                          |
| Comments (3):                                            |
|   > @alice: Should we use token bucket or sliding window?|
|   > @bob: Token bucket, see RFC 6585...                  |
|   > @alice: Agreed, added to requirements.               |
| -------------------------------------------------------- |
|                                                          |
|                  [Preview Prompt]  [Generate Task]        |
+----------------------------------------------------------+
```

After clicking "Generate Task", the agent spawns and the panel shows streaming output with completion detection. On success, the Task Board refreshes to show the new task card.

### `ody plan new` -> Plan Creator

| CLI Behavior                               | Desktop Equivalent                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Text prompt for description                | Multi-line text area                                                                          |
| Spawns backend to generate `.code-task.md` | Same spawn + stream, but output renders in a preview panel                                    |
| Loop: "Add another plan?"                  | "Create Another" button after completion                                                      |
| `--dry-run`                                | "Preview Prompt" button                                                                       |
| `ody plan <planFile>` batch mode           | "Batch" sub-tab with file picker / drag-and-drop zone for planning documents                  |
| Batch mode generates multiple tasks        | Same spawn + stream; progress shown with task count. Reads file via `buildBatchPlanPrompt()`. |

**UI:** A panel or modal with sub-tabs: **Single** | **Batch**.

- **Single:** Text area for the task description and a "Generate" button. Shows a live-updating preview of the generated task file as the agent streams output.
- **Batch:** File picker or drag-and-drop zone for a planning document (e.g., a roadmap markdown file). "Generate Tasks" button spawns the agent with `buildBatchPlanPrompt({ filePath })`. Shows streaming output with completion detection. On success, the Task Board refreshes with all new task cards.

### `ody plan list` -> Task Board

| CLI Behavior                  | Desktop Equivalent                                                   |
| ----------------------------- | -------------------------------------------------------------------- |
| Scans and lists pending tasks | Card-based board grouped by status (pending, in_progress, completed) |
| Shows title only              | Cards show title, labels, complexity, created date                   |

**UI:** Kanban-style board or a filterable/sortable table view. Cards are clickable to view/edit the full task file.

### `ody plan edit` / `ody task edit` -> Task Editor (CodeMirror 6 + AI Inline Editing)

| CLI Behavior                     | Desktop Equivalent                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| Select prompt to pick task       | Click a task card from the Task Board                                                             |
| Spawns backend to edit           | Inline prompt (Cmd+K) spawns backend directly; result shown as diff                               |
| Agent modifies file in place     | Agent output captured; proposed changes shown in side-by-side diff view. User accepts or rejects. |
| `ody task edit` interactive mode | Available via "Open in Terminal" action -- spawns PTY session using `buildInteractiveCommand()`   |

**Editor component:** CodeMirror 6 with `@codemirror/lang-markdown` for syntax highlighting, `@codemirror/merge` for the diff review view, and custom extensions for the inline prompt keybinding and selection highlighting.

**Three editor states:**

1. **Edit mode (default):** Full CodeMirror 6 editor with the `.code-task.md` content. Toolbar shows save, undo/redo, and an "AI Edit" button. User can manually edit the markdown freely.

2. **Prompt mode:** User presses Cmd+K (or clicks "AI Edit" in the toolbar). A floating input bar appears anchored to the cursor position (or the top of the editor if no selection). If text is selected, the selection is highlighted with a decoration to indicate scope. User types a natural-language instruction (e.g., "Add acceptance criteria for rate limiting") and presses Enter. The editor becomes read-only while the agent runs; a spinner appears in the prompt bar.

3. **Review mode:** After the agent completes, the editor splits into a side-by-side diff view via `@codemirror/merge`. Left pane shows the original content (read-only), right pane shows the agent's proposed content (editable -- user can tweak before accepting). Two buttons: "Accept" (overwrites file with proposed content) and "Reject" (discards proposed content, returns to edit mode with original).

**AI edit flow (Cmd+K):**

1. User optionally selects a region of text in the editor.
2. User presses Cmd+K. A floating input appears near the cursor/selection.
3. User types an instruction and presses Enter.
4. Renderer sends IPC: `agent:editInline({ filePath, fileContent, selection, instruction })`.
5. Main process snapshots the file on disk, builds an edit prompt using `buildInlineEditPrompt()` from `@internal/builders`, spawns the configured backend.
6. Agent output streams back to the renderer via `agent:output` events. The prompt bar shows a spinner with "AI is editing...".
7. When the agent completes (detected via process exit or `<woof>COMPLETE</woof>` marker), the main process reads the modified file from disk and sends the new content back via `agent:editResult`.
8. Renderer enters review mode: side-by-side diff of original (snapshot) vs proposed (agent's output).
9. User clicks "Accept" (file saved with proposed content) or "Reject" (file restored from snapshot).

**CodeMirror 6 extensions used:**

| Extension                                | Purpose                                                  |
| ---------------------------------------- | -------------------------------------------------------- |
| `@codemirror/lang-markdown`              | Markdown syntax highlighting, folding, list continuation |
| `@codemirror/merge`                      | Side-by-side diff view for AI review mode                |
| `@codemirror/theme-one-dark` (or custom) | Theme matching the app's look                            |
| Custom keybinding extension              | Cmd+K / Ctrl+K to trigger inline prompt                  |
| Custom decoration extension              | Highlight the selected region during prompt mode         |
| Custom readonly extension                | Toggle editor to read-only during agent execution        |

**Edge cases:**

- **Agent writes directly to disk:** Some backends modify the file in-place. The main process snapshots the file before spawning, then diffs against the post-agent state on disk.
- **Agent failure / garbled output:** Show an error state in the prompt bar with "Retry" and "Cancel" buttons. Restore the file from the snapshot.
- **User cancels mid-edit:** The "Stop" action kills the agent process and restores the snapshot.
- **Large files:** CodeMirror 6 handles large documents well, but the diff view should cap at a reasonable size (show a warning if the file exceeds ~500KB).

### `ody plan compact` -> Archive Action

| CLI Behavior                 | Desktop Equivalent                                  |
| ---------------------------- | --------------------------------------------------- |
| Scans completed tasks        | "Archive Completed" button in task board toolbar    |
| Generates archive markdown   | Same logic; shows archive preview before confirming |
| Deletes completed task files | Confirm dialog, then executes                       |
| Archives progress.txt        | Includes progress file in the archive               |
| Clears progress.txt          | Clears after archiving                              |

**UI:** Button in the task board toolbar or a menu action. Shows a confirmation dialog with the list of tasks to archive before proceeding.

---

## IPC Contract

All communication between renderer and main process goes through typed IPC channels. The preload script exposes a `window.ody` API object.

### Channel Definitions

```typescript
// Renderer -> Main (invoke/handle pattern)
type IpcChannels = {
  // Config (three-layer merge: GUI per-project > local .ody/ody.json > global ~/.ody/ody.json)
  'config:load': () => {
    merged: OdyConfig; // Final merged config (what the app uses)
    layers: {
      global: Partial<OdyConfig> | null; // ~/.ody/ody.json (lowest priority)
      local: Partial<OdyConfig> | null; // .ody/ody.json (middle priority)
      gui: Partial<OdyConfig> | null; // GUI overrides (highest priority)
    };
  } | null;
  'config:save': (layer: 'local' | 'gui', config: Partial<OdyConfig>) => void; // Save to specific layer
  'config:saveGlobal': (config: Partial<OdyConfig>) => void; // Save to global config
  'config:validate': (raw: unknown) => { success: boolean; error?: string };
  'config:resetGuiOverrides': () => void; // Clear all GUI overrides for active project

  // Backends
  'backends:available': () => { label: string; value: string }[];
  'backends:models': (backend: string) => string[]; // Auto-detect available models (e.g., opencode models subprocess)

  // Tasks
  'tasks:list': () => TaskSummary[];
  'tasks:read': (filename: string) => string;
  'tasks:delete': (filenames: string[]) => void;
  'tasks:byLabel': (label: string) => string[];
  'tasks:states': () => TaskState[]; // Get status of all task files

  // Agent operations
  'agent:run': (opts: RunOptions) => void; // Starts agent loop
  'agent:runOnce': (opts: RunOnceOptions) => void; // Starts PTY session
  'agent:stop': () => void; // Kills agent process
  'agent:planNew': (description: string) => void; // Generate new plan
  'agent:planBatch': (filePath: string) => void; // Generate tasks from planning document
  'agent:planEdit': (filename: string) => void; // Edit existing plan
  'agent:dryRun': (opts: RunOptions) => string[]; // Returns command array

  // Editor AI operations
  'agent:editInline': (opts: {
    filePath: string; // Absolute path to .code-task.md
    fileContent: string; // Current editor buffer content
    selection?: { from: number; to: number }; // Selected character range (optional)
    instruction: string; // User's natural language instruction
  }) => void; // Starts inline AI edit
  'editor:save': (filePath: string, content: string) => void; // Save editor buffer to disk
  'editor:snapshot': (filePath: string) => string; // Read + snapshot file for rollback

  // Import operations
  'import:fetchJira': (opts: { input: string }) => {
    ticket: JiraTicket;
    formatted: string;
  }; // Fetch and format Jira ticket data
  'import:fetchGitHub': (opts: { input: string }) => {
    issue: GitHubIssue;
    formatted: string;
  }; // Fetch and format GitHub issue data
  'agent:importFromJira': (opts: { input: string; verbose?: boolean }) => void; // Spawn agent to generate task from Jira ticket
  'agent:importFromGitHub': (opts: { input: string; verbose?: boolean }) => void; // Spawn agent to generate task from GitHub issue
  'agent:importDryRun': (opts: { source: 'jira' | 'github'; input: string }) => string; // Returns the prompt that would be sent

  // Auth
  'auth:list': () => AuthStore; // List all configured credentials
  'auth:setJira': (profile: string, credentials: JiraCredentials) => void;
  'auth:setGitHub': (profile: string, credentials: GitHubCredentials) => void;
  'auth:removeJira': (profile: string) => void;
  'auth:removeGitHub': (profile: string) => void;

  // Progress
  'progress:read': () => string | null; // Read .ody/progress.txt
  'progress:clear': () => void; // Clear progress file

  // Archive
  'archive:compact': () => { archived: string[]; archiveFile: string };
  'archive:list': () => ArchiveEntry[];

  // Projects
  'projects:list': () => { path: string; name: string }[]; // All registered projects
  'projects:add': () => { path: string; name: string } | null; // Opens folder picker, adds project
  'projects:remove': (path: string) => void; // Remove from list (not disk)
  'projects:switch': (path: string) => void; // Set active project, reload config/tasks
  'projects:active': () => string | null; // Current active project path

  // Theme
  'theme:get': () => { source: 'system' | 'light' | 'dark'; resolved: 'light' | 'dark' };
  'theme:set': (pref: 'system' | 'light' | 'dark') => void;

  // System
  'system:openExternal': (url: string) => void;
};

// Main -> Renderer (event pattern, via webContents.send)
type IpcEvents = {
  'agent:output': (chunk: string) => void; // Streaming output
  'agent:complete': () => void; // Task/iteration complete
  'agent:error': (error: string) => void; // Agent process error
  'agent:iteration': (current: number, max: number) => void; // Loop progress
  'agent:started': () => void; // Process spawned
  'agent:stopped': () => void; // Process killed/exited
  'agent:ambiguousMarker': () => void; // Partial <woof> tag detected without exact match

  // Verification events
  'agent:verifyFailed': (details: {
    type: 'single_task_incomplete' | 'unresolved_tasks';
    taskStates: TaskState[];
  }) => void; // Post-run task state verification failed

  // Editor AI events
  'agent:editResult': (proposedContent: string) => void; // Agent finished; proposed file content

  // Theme events
  'theme:changed': (resolved: 'light' | 'dark') => void; // OS or user theme changed

  // Project events
  'projects:switched': (project: { path: string; name: string }) => void; // Active project changed
};
```

### Preload Script

```typescript
// packages/desktop/src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ody', {
  config: {
    load: () => ipcRenderer.invoke('config:load'),
    save: (layer, config) => ipcRenderer.invoke('config:save', layer, config),
    saveGlobal: (config) => ipcRenderer.invoke('config:saveGlobal', config),
    validate: (raw) => ipcRenderer.invoke('config:validate', raw),
    resetGuiOverrides: () => ipcRenderer.invoke('config:resetGuiOverrides'),
  },
  backends: {
    available: () => ipcRenderer.invoke('backends:available'),
    models: (backend) => ipcRenderer.invoke('backends:models', backend),
  },
  tasks: {
    list: () => ipcRenderer.invoke('tasks:list'),
    read: (filename) => ipcRenderer.invoke('tasks:read', filename),
    delete: (filenames) => ipcRenderer.invoke('tasks:delete', filenames),
    byLabel: (label) => ipcRenderer.invoke('tasks:byLabel', label),
    states: () => ipcRenderer.invoke('tasks:states'),
  },
  agent: {
    run: (opts) => ipcRenderer.invoke('agent:run', opts),
    runOnce: (opts) => ipcRenderer.invoke('agent:runOnce', opts),
    stop: () => ipcRenderer.invoke('agent:stop'),
    planNew: (desc) => ipcRenderer.invoke('agent:planNew', desc),
    planBatch: (filePath) => ipcRenderer.invoke('agent:planBatch', filePath),
    planEdit: (filename) => ipcRenderer.invoke('agent:planEdit', filename),
    editInline: (opts) => ipcRenderer.invoke('agent:editInline', opts),
    dryRun: (opts) => ipcRenderer.invoke('agent:dryRun', opts),
    importFromJira: (opts) => ipcRenderer.invoke('agent:importFromJira', opts),
    importFromGitHub: (opts) => ipcRenderer.invoke('agent:importFromGitHub', opts),
    importDryRun: (opts) => ipcRenderer.invoke('agent:importDryRun', opts),
    onOutput: (cb) => ipcRenderer.on('agent:output', (_, chunk) => cb(chunk)),
    onComplete: (cb) => ipcRenderer.on('agent:complete', () => cb()),
    onError: (cb) => ipcRenderer.on('agent:error', (_, err) => cb(err)),
    onIteration: (cb) => ipcRenderer.on('agent:iteration', (_, cur, max) => cb(cur, max)),
    onStarted: (cb) => ipcRenderer.on('agent:started', () => cb()),
    onStopped: (cb) => ipcRenderer.on('agent:stopped', () => cb()),
    onEditResult: (cb) => ipcRenderer.on('agent:editResult', (_, content) => cb(content)),
    onAmbiguousMarker: (cb) => ipcRenderer.on('agent:ambiguousMarker', () => cb()),
    onVerifyFailed: (cb) => ipcRenderer.on('agent:verifyFailed', (_, details) => cb(details)),
    removeAllListeners: () => {
      [
        'agent:output',
        'agent:complete',
        'agent:error',
        'agent:iteration',
        'agent:started',
        'agent:stopped',
        'agent:editResult',
        'agent:ambiguousMarker',
        'agent:verifyFailed',
      ].forEach((ch) => ipcRenderer.removeAllListeners(ch));
    },
  },
  editor: {
    save: (filePath, content) => ipcRenderer.invoke('editor:save', filePath, content),
    snapshot: (filePath) => ipcRenderer.invoke('editor:snapshot', filePath),
  },
  import: {
    fetchJira: (opts) => ipcRenderer.invoke('import:fetchJira', opts),
    fetchGitHub: (opts) => ipcRenderer.invoke('import:fetchGitHub', opts),
  },
  auth: {
    list: () => ipcRenderer.invoke('auth:list'),
    setJira: (profile, creds) => ipcRenderer.invoke('auth:setJira', profile, creds),
    setGitHub: (profile, creds) => ipcRenderer.invoke('auth:setGitHub', profile, creds),
    removeJira: (profile) => ipcRenderer.invoke('auth:removeJira', profile),
    removeGitHub: (profile) => ipcRenderer.invoke('auth:removeGitHub', profile),
  },
  progress: {
    read: () => ipcRenderer.invoke('progress:read'),
    clear: () => ipcRenderer.invoke('progress:clear'),
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    add: () => ipcRenderer.invoke('projects:add'),
    remove: (path) => ipcRenderer.invoke('projects:remove', path),
    switch: (path) => ipcRenderer.invoke('projects:switch', path),
    active: () => ipcRenderer.invoke('projects:active'),
    onSwitched: (cb) => ipcRenderer.on('projects:switched', (_, project) => cb(project)),
  },
  theme: {
    get: () => ipcRenderer.invoke('theme:get'),
    set: (pref) => ipcRenderer.invoke('theme:set', pref),
    onChange: (cb) => ipcRenderer.on('theme:changed', (_, resolved) => cb(resolved)),
  },
  archive: {
    compact: () => ipcRenderer.invoke('archive:compact'),
    list: () => ipcRenderer.invoke('archive:list'),
  },
  system: {
    openExternal: (url) => ipcRenderer.invoke('system:openExternal', url),
  },
});
```

---

## Process Spawning & Agent Streaming

The main process handles all agent spawning. This is the most critical piece.

### Standard Run Mode (Loop)

```typescript
// packages/desktop/src/main/agent.ts (conceptual)
import { spawn } from 'node:child_process';
import { Backend } from '@internal/backends';
import { buildRunPrompt } from '@internal/builders';
import { Config } from '@internal/config';
import { getTaskStatus, getTaskStates } from '@internal/tasks';

const COMPLETE_MARKER = '<woof>COMPLETE</woof>';

type MarkerDetectionResult = {
  hasStrictMatch: boolean;
  hasAmbiguousMention: boolean;
};

class AgentRunner {
  private proc: ChildProcess | null = null;
  private aborted = false;

  async runLoop(win: BrowserWindow, opts: RunOptions) {
    const config = Config.all();
    const backend = new Backend(config.backend);
    const model = Config.resolveModel('run', config);
    const maxIterations = opts.iterations ?? config.maxIterations;
    const prompt = buildRunPrompt({
      /* template vars */
    });

    for (let i = 1; !this.aborted && (maxIterations === 0 || i <= maxIterations); i++) {
      win.webContents.send('agent:iteration', i, maxIterations);
      const cmd = backend.buildCommand(prompt, model);
      const result = await this.spawnAndStream(win, cmd);

      // Post-run verification
      if (result.markerResult.hasAmbiguousMention && !result.markerResult.hasStrictMatch) {
        win.webContents.send('agent:ambiguousMarker');
      }

      if (opts.taskFile) {
        // Single task mode: verify task was completed
        const status = await getTaskStatus(opts.taskFile);
        if (status !== 'completed') {
          win.webContents.send('agent:verifyFailed', {
            type: 'single_task_incomplete',
            taskStates: [{ taskFile: opts.taskFile, status: status ?? 'unknown' }],
          });
        }
      } else if (result.markerResult.hasStrictMatch) {
        // Multi-task mode: verify no unresolved tasks remain
        const taskStates = await getTaskStates();
        const unresolved = taskStates.filter((t) => t.status !== 'completed');
        if (unresolved.length > 0) {
          win.webContents.send('agent:verifyFailed', {
            type: 'unresolved_tasks',
            taskStates: unresolved,
          });
        }
      }

      if (result.markerResult.hasStrictMatch) break;
    }

    win.webContents.send('agent:complete');
  }

  private spawnAndStream(
    win: BrowserWindow,
    cmd: string[],
  ): Promise<{ markerResult: MarkerDetectionResult }> {
    return new Promise((resolve, reject) => {
      const [bin, ...args] = cmd;
      this.proc = spawn(bin, args, { cwd: opts.projectDir });
      let accumulated = '';

      this.proc.stdout?.on('data', (chunk) => {
        const text = chunk.toString();
        accumulated += text;
        win.webContents.send('agent:output', text);
        if (accumulated.includes(COMPLETE_MARKER)) {
          this.proc?.kill();
          resolve({
            markerResult: { hasStrictMatch: true, hasAmbiguousMention: false },
          });
        }
      });

      this.proc.stderr?.on('data', (chunk) => {
        win.webContents.send('agent:output', chunk.toString());
      });

      this.proc.on('close', (code) => {
        // Check for ambiguous mentions (partial <woof> tags)
        const hasAmbiguous = accumulated.includes('woof') && !accumulated.includes(COMPLETE_MARKER);
        resolve({
          markerResult: { hasStrictMatch: false, hasAmbiguousMention: hasAmbiguous },
        });
      });

      this.proc.on('error', (err) => {
        win.webContents.send('agent:error', err.message);
        reject(err);
      });
    });
  }

  stop() {
    this.aborted = true;
    this.proc?.kill('SIGTERM');
  }
}
```

### PTY Mode (Interactive Terminal)

For the `--once` equivalent and interactive task editing (`ody task edit`), use `node-pty` to spawn a real PTY and pipe it to `xterm.js` in the renderer.

The PTY session uses `backend.buildInteractiveCommand()` (not `buildCommand()`) to produce a command suitable for interactive use. This is important because the interactive command differs per backend:

- **Claude:** Omits `-p`, `--verbose`, and `--output-format stream-json` flags
- **Opencode:** Uses `--prompt` instead of the `run` subcommand
- **Codex:** Omits `exec` and `--yolo`

```typescript
import * as pty from 'node-pty';
import { Backend } from '@internal/backends';
import { Config } from '@internal/config';

class PtySession {
  private term: pty.IPty;

  start(win: BrowserWindow, cmd: string[]) {
    const [bin, ...args] = cmd;
    this.term = pty.spawn(bin, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: projectDir,
    });

    this.term.onData((data) => {
      win.webContents.send('agent:output', data);
    });

    this.term.onExit(() => {
      win.webContents.send('agent:stopped');
    });
  }

  write(data: string) {
    this.term.write(data);
  }
  resize(cols: number, rows: number) {
    this.term.resize(cols, rows);
  }
  kill() {
    this.term.kill();
  }
}

// Usage for interactive task editing:
const backend = new Backend(config.backend);
const model = Config.resolveModel('edit', config);
const cmd = backend.buildInteractiveCommand(prompt, model);
ptySession.start(win, cmd);
```

The renderer uses `xterm.js` to display the PTY output and sends keystrokes back through IPC.

---

## UI Design

> NOTE Design file found at `./designs.html`. See the [Design System](#design-system) section for color palette, typography, animations, and component patterns.

### Title Bar

A custom title bar (44px / `h-11`) spans the top of the window:

```
+----------------------------------------------------------+
| [R][A][G]  ODY://Desktop                [Settings] [Help]|
+~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~+
```

- **Left:** macOS traffic light buttons (red/amber/green, 10x10px circles). Each has a 40% opacity default and 70% opacity on hover.
- **Center-left:** App branding -- "ODY" in accent color (semibold) + "://Desktop" in dim color (light weight).
- **Right:** "Settings" and "Help" text buttons (xs font, dim, hover to accent).
- **Below:** A 1px accent gradient line (`transparent` -> `accent/25` -> `transparent`) visually separates the title bar from the main content.

### Main Layout

```
+----------------------------------------------------------+
| [R][A][G]  ODY://Desktop                [Settings] [Help]|
| ~~~~~~~~~~~~~~ accent gradient line ~~~~~~~~~~~~~~~~~~~~ |
+----------+-----------------------------------------------+
| PROJECTS |                                                |
| ----------                                                |
| * my-app |  PAGE HEADER                                  |
|   api    |  (project breadcrumb + page title + actions)  |
|   web    |                                                |
| [+ Add]  |  MAIN CONTENT AREA                            |
|----------|  (varies by active view)                      |
| VIEWS    |                                                |
| ----------                                                |
| > Tasks  |-----------------------------------------------+
|   Run    |  AGENT OUTPUT PANEL (collapsible, h-40)       |
|   Plan   |  Streaming log / terminal toggle              |
|   Import |                                                |
|   Config |                                                |
|   Auth   |                                                |
|   Archive|                                                |
|----------|                                                |
| STATUS   |                                                |
| Backend: |                                                |
| opencode |                                                |
| Idle     |                                                |
+----------+-----------------------------------------------+
| (*) Running iter 2/5 | my-app | 3p/1a/2c    opencode |M |
+----------------------------------------------------------+
```

The sidebar is split into two sections: **Projects** (top) and **Views** (bottom). The active project is highlighted; clicking another project switches the entire app context (config, tasks, agent cwd) to that folder.

### Page Header

Each view has a consistent page header area:

- **Breadcrumb:** A small accent line (6px wide) + project name in uppercase 10px tracking text.
- **Title:** Large heading (2xl, semibold, bright color) -- e.g., "Task Board", "Run Agent", "Configuration".
- **Actions:** Right-aligned buttons specific to the view (e.g., search bar + "New Plan" + "Archive" for the Task Board).

### Status Bar

A persistent footer bar (28px / `h-7`) at the bottom of the window:

- **Left side:** Agent state indicator (pulsing accent dot when running) + iteration counter ("iter 2/5") + active project name + task summary ("3 pending / 1 active / 2 completed").
- **Right side:** Active backend name (accent, medium weight) + model name (monospace, mid color).
- When idle, the state indicator is absent and the left side shows only the project name and task counts.

### View Details

#### Tasks View (Default)

Kanban board with three columns: **Pending** (amber indicator), **In Progress** (accent indicator), **Completed** (green indicator). Each column header shows a colored dot, the column name, a horizontal rule, and a task count badge.

**Pending task cards:**

- Title (13px, medium weight, bright color -- from `# Task:` heading)
- Description excerpt (xs, mid color)
- Label chips (colored per-category: blue for `api`, red for `security`, green for `feature`, amber for `database` -- each with matching `-bg` background and border)
- Complexity + created date footer (10px, dim color)
- Hover-revealed action row: `[Run]` `[Edit]` `[Del]` -- actions appear via opacity transition on card hover, separated by a top border

**In-progress task cards** have a distinct design:

- Card border uses `accent/20` instead of the standard `edge` color.
- Title is styled in accent color (semibold) instead of bright.
- An **embedded mini-terminal** is displayed within the card:

```
+----------------------------------------------------+
| (*) Agent Active                      iter 2 / 5   |
|----------------------------------------------------|
| 14:23:02  ody    Loading task file...              |
| 14:23:05  agent  Found 3 files: auth.ts, ...      |
| 14:23:08  agent  Refactoring auth.ts...            |
| 14:23:12  agent  Extracting token validation_      |
+----------------------------------------------------+
```

- Header bar: "Agent Active" with pulsing accent dot + iteration counter (e.g., "iter 2 / 5")
- Log area: mono font (9px), timestamped entries, 72px max height with scroll overflow
- Blinking cursor on the latest line indicates active streaming
- Color-coded sources: `ody` (accent), `agent` (light)
- Footer shows "Started 3m ago" + a `[Stop]` button (red background) replacing the normal Run/Edit/Del actions.

**Completed task cards:**

- Reduced opacity (0.8), full opacity on hover.
- Green checkmark icon badge next to the title.
- Title in mid color (muted compared to pending/active).
- Labels shown in subdued border-only style (no colored background).
- Completed timestamp footer.

**Agent Output Panel** (bottom of main content, h-40, collapsible):

- Header: "Agent Output" label + streaming indicator (green pulsing dot + "Streaming" text) on the left; "Clear" and "Terminal" toggle buttons on the right.
- Body: mono font log (10px) with timestamped, color-coded entries:
  - `ody` source in accent color
  - `agent` source in light color
  - `validator` source in amber color
  - Status results: `PASS` in green, `FAIL` in red

Toolbar: `[Search: ___]  [+ New Plan]  [Archive]`

#### Run View

Split pane:

- **Top:** Run controls
  - Project directory selector
  - Backend display (from config)
  - Iteration limit input
  - Task filter (label or specific file)
  - `[Start]` `[Stop]` buttons
  - Progress: "Iteration 2 of 5 -- Running..."
- **Middle:** Agent output
  - Scrollable log view with ANSI color support (via `ansi-to-html` or similar)
  - Toggle: Log View / Terminal View (xterm.js)
  - `[Clear]` button
  - Warning banner for ambiguous completion markers
  - Error display for post-run verification failures
- **Bottom (collapsible):** Progress notes
  - Shows contents of `.ody/progress.txt`
  - `[Clear Progress]` button
  - Auto-refreshes after each agent iteration

#### Plan View

Sub-tabs: **Single** | **Batch** | **List**

- **Single:** Text area for description + "Generate" button. Live preview of generated file below.
- **Batch:** File picker or drag-and-drop for planning documents. "Generate Tasks" button. Streaming progress display.
- **List:** Same as Tasks View but filtered to pending only. Simpler list format.

#### Import View

Source selector (Jira / GitHub), ticket/issue input, fetched data preview, and "Generate Task" action. See the [Task Import feature mapping](#ody-task-import---task-import-panel) for the full wireframe.

#### Task Editor View

Opened by clicking "Edit" on any task card in the Task Board or Plan List. Full-width view with three visual states:

```
EDIT MODE:
+----------------------------------------------------------+
| [< Back]  task-name.code-task.md   [Save] [AI Edit] [...]|
+----------------------------------------------------------+
|                                                           |
|  # Task: Implement rate limiting                         |
|                                                           |
|  ## Description                                          |
|  Add rate limiting to the API endpoints...               |
|  |  <-- cursor here                                      |
|                                                           |
|  ## Acceptance Criteria                                  |
|  ...                                                     |
+----------------------------------------------------------+

PROMPT MODE (Cmd+K triggered):
+----------------------------------------------------------+
| [< Back]  task-name.code-task.md   [Save] [AI Edit] [...]|
+----------------------------------------------------------+
|                                                           |
|  # Task: Implement rate limiting                         |
|                                                           |
|  ## Description                                          |
|  +-------------------------------------------------+     |
|  | Add acceptance criteria for error handling  [->] |     |
|  +-------------------------------------------------+     |
|  |highlighted selection of text|                         |
|                                                           |
+----------------------------------------------------------+

REVIEW MODE (diff after AI edit):
+----------------------------------------------------------+
| [< Back]  task-name.code-task.md       [Accept] [Reject] |
+----------------------------+-----------------------------+
|  ORIGINAL                  |  PROPOSED                    |
|                            |                              |
|  ## Acceptance Criteria    |  ## Acceptance Criteria      |
|  - Given a valid request   |  - Given a valid request     |
|                            | + - Given an invalid request |
|                            | +   When the rate limit is   |
|                            | +   exceeded                 |
|                            | +   Then return 429           |
+----------------------------+-----------------------------+
```

The editor is powered by CodeMirror 6. The diff view uses `@codemirror/merge`. The user can manually edit the proposed side before accepting. See the [Feature Mapping > Task Editor](#ody-plan-edit--ody-task-edit---task-editor-codemirror-6--ai-inline-editing) section for the full AI edit flow and edge case handling.

The toolbar also includes an "Open in Terminal" action that opens the task in an interactive PTY session (equivalent to `ody task edit`), using `buildInteractiveCommand()` from the active backend.

#### Auth View

Two tabs: **Jira** and **GitHub**. Each tab shows a table of configured profiles with add/edit/delete actions. See the [Auth Management feature mapping](#ody-auth---auth-management-panel) for the full wireframe.

#### Config View

Three-layer config with precedence: **GUI (per-project)** > **local** `.ody/ody.json` > **global** `~/.ody/ody.json`. All layers are merged and shown as a single form. Each field displays a subtle source indicator showing where its current value comes from.

```
Config                                    [Reset GUI Overrides]
--------------------------------------------------------------

Backend:              [opencode v]                      (local)
Model:                [single v]
                      [anthropic/claude-opus-4-6    ]     (gui)
                      -- or if "per-command" selected: --
                      Run:  [anthropic/claude-opus-4-6]
                      Plan: [anthropic/claude-sonnet  ]
                      Edit: [anthropic/claude-sonnet  ]
Agent Profile:        [build     ]                    (default)
Max Iterations:       [3        ]                      (global)
Should Commit:        [x]                               (local)
Skip Permissions:     [x]  (Claude only)              (default)
Tasks Directory:      [tasks    ]                     (default)
Notification:         ( ) Disabled  (*) On completion  ( ) Per iteration
                                                       (global)

Validator Commands:
  [bun lint                    ] [x]
  [bun fmt                     ] [x]
  [bun typecheck               ] [x]
  [+ Add command]
                                                        (local)

--- Integrations -------------------------------------------

Jira:
  Base URL:           [https://company.atlassian.net]   (local)
  Auth Profile:       [default v]                       (local)

GitHub:
  Auth Profile:       [default v]                     (default)

                      [Save to Project]  [Save to Global]
```

**Source indicators:** Each field shows a small label -- `(global)`, `(local)`, `(gui)`, or `(default)` -- indicating which layer the current effective value comes from. This helps users understand why a value is set and where to change it.

**Model field:** A toggle switches between "Single" mode (one text input for all commands) and "Per-command" mode (three inputs for `run`, `plan`, `edit`). When the config has a per-command model object, the toggle defaults to "Per-command".

**Save targets:** Two save buttons:

- **Save to Project** writes GUI-layer overrides (persisted in `electron-store` keyed by project path). These take highest priority and are specific to the desktop app.
- **Save to Global** writes to `~/.ody/ody.json`, affecting all projects that don't override the value locally.

**Reset GUI Overrides** clears all GUI-layer values for the active project, falling back to local > global > defaults.

**Editing behavior:** When a user changes a field, the change is staged as a GUI override (highest priority). The source indicator updates to `(gui)` for that field. The user can then choose which layer to persist to.

#### Archive View

List of past archives with date, task count, and a "View" button that expands the archive content inline.

### Project Management

Each project is a folder on disk that contains (or will contain) an `.ody/` directory. Projects are listed in the sidebar and can be switched at will.

**Adding projects:**

- `[+ Add]` button in the sidebar opens a native folder picker (`dialog.showOpenDialog`).
- Menu bar: File > Add Project (Cmd/Ctrl+O).
- On first launch with no projects, the app shows a welcome screen with an "Add Project" CTA.

**Switching projects:**

- Click a project name in the sidebar. The active project is highlighted with a visual indicator.
- Switching reloads the config (`Config.load()` with the new project's `.ody/ody.json`), rescans tasks, and resets agent state.
- If an agent is running when the user tries to switch, show a confirmation dialog: "An agent is running in [project]. Stop it and switch?"

**Removing projects:**

- Right-click a project in the sidebar > "Remove" from the context menu. This only removes it from the app's project list -- it does not delete any files on disk.

**Project context menu:**

Right-clicking an inactive project in the sidebar opens a dropdown context menu:

- **Open** -- switch to this project (same as clicking the project name)
- **Copy Path** -- copies the absolute project path to the system clipboard
- **Remove** (red text, separated by divider) -- removes from the project list (not disk)

The context menu is positioned at the cursor coordinates, closes on click outside or Escape, and uses the same fade + translateY entrance animation as other dropdown menus.

**Persistence:**

- The project list (array of absolute paths) and the last-active project are persisted via `electron-store` (app-level, not project-level).
- On launch, the app opens the last-active project. If that path no longer exists, it falls back to the project list or the welcome screen.

**How it maps to the CLI:**

- The CLI uses `process.cwd()` implicitly. In the desktop app, the active project's path becomes the `cwd` for all agent spawns and the root for `.ody/` config loading. All IPC handlers that touch the filesystem use this as their base path.

---

## Design System

The desktop app uses an "Art Deco v3 Teal" visual language. All values below are implemented in the reference design file (`./designs.html`) and should be faithfully reproduced in the Tailwind theme and component styles.

### Color Palette

Colors are defined using a three-layer CSS variable architecture that integrates the Art Deco palette with shadcn/ui's component convention and Tailwind v4's CSS-first configuration. All configuration lives in `globals.css` -- there is no `tailwind.config.js`.

#### CSS Variable Architecture (Tailwind v4 + shadcn/ui)

The styling system has three layers, all defined in `globals.css`:

**Layer 1: shadcn semantic variables** (`:root` / `.dark` blocks)

These map the Art Deco palette onto shadcn/ui's standard CSS variable convention. shadcn components reference these variables internally, so this mapping ensures all shadcn components render with the Art Deco look out of the box. Since the app is dark-first, `:root` contains the dark palette.

```css
@import 'tailwindcss';
@import 'tw-animate-css';

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.5rem;

  /* Surface colors (Art Deco backgrounds) */
  --background: #0d0e14; /* Art Deco: base */
  --foreground: #e8e9f0; /* Art Deco: bright */
  --card: #1a1b28; /* Art Deco: card */
  --card-foreground: #e8e9f0; /* Art Deco: bright */
  --popover: #141520; /* Art Deco: panel */
  --popover-foreground: #e8e9f0; /* Art Deco: bright */

  /* Primary (accent teal) */
  --primary: #00f5d4; /* Art Deco: accent */
  --primary-foreground: #0d0e14; /* Art Deco: base */

  /* Secondary (panel surface) */
  --secondary: #141520; /* Art Deco: panel */
  --secondary-foreground: #c4c6d6; /* Art Deco: light */

  /* Muted (card surface for subdued areas) */
  --muted: #1a1b28; /* Art Deco: card */
  --muted-foreground: #6b6d84; /* Art Deco: dim */

  /* Accent (subtle accent background) */
  --accent: rgba(0, 245, 212, 0.07); /* Art Deco: accent-bg */
  --accent-foreground: #00f5d4; /* Art Deco: accent */

  /* Destructive */
  --destructive: #f87171; /* Art Deco: red */
  --destructive-foreground: #e8e9f0; /* Art Deco: bright */

  /* Chrome */
  --border: #262838; /* Art Deco: edge */
  --input: #262838; /* Art Deco: edge */
  --ring: rgba(0, 245, 212, 0.4); /* Art Deco: accent @ 40% */

  /* Sidebar */
  --sidebar: #141520; /* Art Deco: panel */
  --sidebar-foreground: #c4c6d6; /* Art Deco: light */
  --sidebar-primary: #00f5d4; /* Art Deco: accent */
  --sidebar-primary-foreground: #0d0e14; /* Art Deco: base */
  --sidebar-accent: rgba(0, 245, 212, 0.07); /* Art Deco: accent-bg */
  --sidebar-accent-foreground: #00f5d4; /* Art Deco: accent */
  --sidebar-border: #262838; /* Art Deco: edge */
  --sidebar-ring: rgba(0, 245, 212, 0.4);
}
```

**Layer 2: `@theme inline` bridge** (standard shadcn/Tailwind v4 pattern)

Maps the `:root` CSS variables to Tailwind v4 color tokens, enabling utility classes like `bg-background`, `text-foreground`, `border-border`, `bg-primary`, etc.

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

**Layer 3: Art Deco extended tokens** via `@theme`

These are design tokens unique to the Art Deco visual language that go beyond shadcn's standard convention. They generate additional Tailwind utility classes (e.g., `bg-panel`, `text-dim`, `text-mid`, `border-edge`).

```css
@theme {
  /* Surfaces */
  --color-panel: #141520;
  --color-edge: #262838;

  /* Five-step text hierarchy */
  --color-ody-muted: #3d3f54; /* Timestamps, disabled -- renamed to avoid shadcn "muted" collision */
  --color-dim: #6b6d84;
  --color-mid: #9496ac;
  --color-light: #c4c6d6;
  --color-bright: #e8e9f0;

  /* Accent states */
  --color-accent-hover: #33f7de;
  --color-accent-bg: rgba(0, 245, 212, 0.07);

  /* Semantic colors */
  --color-green: #4ade80;
  --color-green-bg: rgba(74, 222, 128, 0.08);
  --color-red: #f87171;
  --color-red-bg: rgba(248, 113, 113, 0.08);
  --color-blue: #60a5fa;
  --color-blue-bg: rgba(96, 165, 250, 0.08);
  --color-amber: #f5a623;
  --color-amber-bg: rgba(245, 166, 35, 0.08);

  /* Fonts */
  --font-sans: 'Sora', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

**Naming collision note:** The Art Deco "muted" text token (`#3d3f54`) is renamed to `ody-muted` (generating utility `text-ody-muted`) to avoid conflicting with shadcn's `muted` surface token. In code, use `text-ody-muted` for the faintest text and `bg-muted` for the muted surface.

**Base layer styles:**

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

#### Token Reference Tables

The tables below provide a quick reference for the raw hex values. In implementation, always use the Tailwind utility classes (e.g., `bg-background`, `text-dim`, `border-edge`) rather than raw hex values.

#### Backgrounds

| Token   | Hex       | Usage                                              |
| ------- | --------- | -------------------------------------------------- |
| `base`  | `#0d0e14` | Deepest background (body, status bar)              |
| `panel` | `#141520` | Sidebar, panels, agent output area, modal surfaces |
| `card`  | `#1a1b28` | Card backgrounds, form inputs, nested containers   |

#### Borders & Separators

| Token  | Hex       | Usage                                            |
| ------ | --------- | ------------------------------------------------ |
| `edge` | `#262838` | Default border color for cards, inputs, dividers |

#### Text Scale

Five-step grayscale text hierarchy, from dimmest to brightest:

| Token    | Hex       | Usage                                           |
| -------- | --------- | ----------------------------------------------- |
| `muted`  | `#3d3f54` | Timestamps, disabled elements, scrollbar tracks |
| `dim`    | `#6b6d84` | Secondary labels, hints, inactive nav items     |
| `mid`    | `#9496ac` | Body text, descriptions, log output             |
| `light`  | `#c4c6d6` | Default readable text, input values             |
| `bright` | `#e8e9f0` | Headings, emphasized text, active labels        |

#### Accent (Teal)

| Token          | Value                     | Usage                                                                     |
| -------------- | ------------------------- | ------------------------------------------------------------------------- |
| `accent`       | `#00f5d4`                 | Primary interactive color: buttons, active states, links, status dots     |
| `accent-hover` | `#33f7de`                 | Hover state for accent-colored elements                                   |
| `accent-bg`    | `rgba(0, 245, 212, 0.07)` | Subtle background for active nav items, selected cards, accent containers |

#### Semantic Colors

Each semantic color has a solid variant and a `-bg` variant (low-opacity background):

| Token   | Hex       | `-bg` Value                 | Usage                                                    |
| ------- | --------- | --------------------------- | -------------------------------------------------------- |
| `green` | `#4ade80` | `rgba(74, 222, 128, 0.08)`  | Success states, completed tasks, checkmarks, PASS status |
| `red`   | `#f87171` | `rgba(248, 113, 113, 0.08)` | Errors, delete actions, security labels, FAIL status     |
| `blue`  | `#60a5fa` | `rgba(96, 165, 250, 0.08)`  | Informational labels (e.g., `api` tag)                   |
| `amber` | `#f5a623` | `rgba(245, 166, 35, 0.08)`  | Warnings, pending status, validator source, stop actions |

### Typography

| Role | Font Family        | Weights                                                              | Usage                                                                           |
| ---- | ------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Sans | **Sora**           | 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold) | Headings, labels, body text, buttons, navigation                                |
| Mono | **JetBrains Mono** | 400 (regular), 500 (medium)                                          | Agent output logs, code/model names, file paths, timestamps, validator commands |

Both fonts are loaded from Google Fonts. Tailwind aliases: `font-sans` -> Sora, `font-mono` -> JetBrains Mono.

### Background Pattern

The main content area uses a subtle grid background:

- Grid lines: `rgba(0, 245, 212, 0.025)` (barely visible teal)
- Grid size: 32x32px
- Applied via `background-image` with two perpendicular `linear-gradient` layers
- Only used on the main content area (not sidebar, panels, or modals)

### Animations

| Name     | Duration | Easing      | Behavior                                                     | Usage                                                                                                     |
| -------- | -------- | ----------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `fadeUp` | 0.4s     | ease-out    | `opacity: 0, translateY(8px)` -> `opacity: 1, translateY(0)` | Kanban columns, cards on initial load. Staggered with 60ms delays per element (classes `d1`, `d2`, `d3`). |
| `pulse`  | 2s       | ease-in-out | Infinite `opacity: 1` -> `0.5` -> `1`                        | Status indicator dots (running, streaming, agent active)                                                  |
| `blink`  | 1s       | step        | `opacity: 1` (0-50%) -> `opacity: 0` (51-100%)               | Blinking cursor in agent output terminal                                                                  |

### Scrollbar

Custom slim scrollbar (WebKit):

- Width: 4px
- Track: `panel` color (`#141520`)
- Thumb: `muted` color (`#3d3f54`), 2px border-radius
- Thumb hover: `accent` color (`#00f5d4`)

### Form Component Patterns

All form components are built on **shadcn/ui primitives** (which use Radix UI under the hood), styled with Art Deco tokens via CSS variable overrides and `className` props. The `cn()` utility from `lib/utils.ts` (`clsx` + `tailwind-merge`) is used for composing conditional class names.

**Toggle switches** -- Built on shadcn `<Switch>` (`@radix-ui/react-switch`):

- Track: 36x20px, `muted/40` background, rounded-full
- Knob: 16x16px circle, `dim` color, positioned with 2px inset
- Active state: track becomes `accent/30`, knob translates 16px right and changes to `accent` color
- All transitions: 0.2s ease

**Text inputs** -- Built on shadcn `<Input>`:

- Card bg (`bg-card`), edge border (`border-edge`), rounded-lg
- Art Deco focus ring applied globally (see below)

**Tag inputs** -- Custom component (no shadcn primitive; built on `<Input>` for the text entry):

- Container: card background with edge border, flex-wrap layout, min-height 38px
- Tags: pill-shaped (10px text, accent-bg background, accent/15 border, accent text)
- Click a tag to remove it (with fadeUp entrance animation)
- Inline text input at the end; press Enter to add a tag
- Focus ring on the container when the input is focused

**Selects** -- Built on shadcn `<Select>` (`@radix-ui/react-select`):

- Trigger styled with card bg, edge border, rounded-lg (matching text inputs)
- Dropdown content uses `popover` bg with `edge` border
- Chevron icon via Lucide (`ChevronDown`)
- Items highlight with `accent-bg` on hover

**Radio card selects** -- Built on shadcn `<RadioGroup>` (`@radix-ui/react-radio-group`) with custom card-style items:

- Full-card clickable labels with radio input
- Standard: card bg, edge border
- Selected: accent/20 border with accent-colored "Active" badge
- Used for backend selection and stop-mode options

**Tabs** -- Built on shadcn `<Tabs>` (`@radix-ui/react-tabs`):

- Used in Auth view (Jira/GitHub), Plan view (Single/Batch/List), and Settings modal (General/Backend/Validators)
- Tab triggers styled with dim text, accent underline on active

**Dropdown menus** -- Built on shadcn `<DropdownMenu>` (`@radix-ui/react-dropdown-menu`):

- Used for project context menu (right-click sidebar item)
- Panel bg, edge border, items highlight with accent-bg on hover
- Destructive items (e.g., "Remove") use `text-red`

**Cards** -- Built on shadcn `<Card>`:

- Task cards, validator command cards, profile cards
- Card bg (`bg-card`), edge border, rounded-lg
- Art Deco hover and status styling applied via `className`

**Badges** -- Built on shadcn `<Badge>`:

- Label chips on task cards (colored per-category: blue, red, green, amber with matching `-bg` backgrounds)
- Status badges ("Active", completion markers)

**Focus ring (all inputs):**

- Border color: `rgba(0, 245, 212, 0.4)`
- Box shadow: `0 0 0 2px rgba(0, 245, 212, 0.08)`
- No outline (`outline: none`)
- Applied globally via the base layer `outline-ring/50` rule

### Modal System

All modals are built on shadcn `<Dialog>` (`@radix-ui/react-dialog`), which provides accessible modal behavior out of the box (focus trapping, Escape to close, aria attributes, portal rendering). The Art Deco visual design is layered on top via `className` props on `DialogOverlay`, `DialogContent`, `DialogHeader`, and `DialogFooter`.

**Backdrop (`DialogOverlay`):** `bg-base/70` (semi-transparent base) + `backdrop-blur-sm`. Click outside to close (Radix default behavior).

**Entrance animation:** Content starts at `scale(0.96) translateY(6px)` with `opacity: 0`, transitions to `scale(1) translateY(0)` with `opacity: 1` over 0.2s ease. Applied via `tw-animate-css` classes on `DialogContent`.

**Close behavior:** Click backdrop to close; press Escape to close all active modals (Radix handles both). Close button in header (7x7 rounded-lg, edge border, dim icon) uses `DialogClose`.

**Auto-focus:** Radix Dialog auto-focuses the first focusable element. For forms, set `autoFocus` on the primary text input to override the default.

**Structure:**

```
+----------------------------------------------------------+
| [icon]  Title                                     [X]    |
|         Subtitle                                         |
|----------------------------------------------------------|
|                                                          |
|  Form fields / content                                   |
|                                                          |
|----------------------------------------------------------|
| [Cancel]                       [Secondary]  [Primary]    |
+----------------------------------------------------------+
```

- **Header:** Icon badge (7x7 rounded-lg, colored bg + border) + title (sm, semibold, bright) + subtitle (10px, dim). Close button on right.
- **Body:** Padded content area with 16px vertical spacing between fields.
- **Footer:** `card/30` background, rounded-b-xl. Cancel as text button (dim), primary action as accent button (semibold).

**Modal inventory (from design):**

| Modal       | Width | Icon Color      | Primary Action  | Action Color |
| ----------- | ----- | --------------- | --------------- | ------------ |
| New Plan    | 520px | accent (plus)   | "Create Plan"   | accent       |
| Edit Task   | 520px | blue (pencil)   | "Save Changes"  | accent       |
| Delete Task | 400px | red (trash)     | "Delete Task"   | red          |
| Stop Agent  | 420px | amber (warning) | "Stop Agent"    | amber        |
| Run Task    | 420px | accent (play)   | "Start Agent"   | accent       |
| Settings    | 500px | accent (gear)   | "Save Settings" | accent       |
| Add Project | 420px | accent (folder) | "Add Project"   | accent       |

### Toast Notification System

In-app feedback toasts for immediate user actions (distinct from the OS-level `Notification` API used for agent completion). Built on **sonner** (shadcn's recommended toast library), wrapped via the shadcn `<Sonner>` component. The `<Sonner>` provider is mounted once in `App.tsx`; toasts are triggered anywhere via `toast()` / `toast.success()` / `toast.error()` / `toast.warning()`.

**Position:** Fixed, top-right (`top: 56px`, `right: 20px`), stacked vertically with 8px gap.

**Entrance/exit:** Sonner's built-in slide animations (slide in from right, auto-dismiss after 2.5s). Custom timing can be set via `duration` prop.

**Color variants** (applied via `className` on the `<Sonner>` provider or per-toast `className`):

| Variant  | Border Color | Dot + Text Color | Use Case                                                             |
| -------- | ------------ | ---------------- | -------------------------------------------------------------------- |
| `accent` | `accent/20`  | `accent`         | General feedback (output cleared, settings opened, draft saved)      |
| `green`  | `green/20`   | `green`          | Success (plan created, task updated, project added, validator added) |
| `red`    | `red/20`     | `red`            | Destructive (task deleted, force stopped)                            |
| `amber`  | `amber/20`   | `amber`          | Warning (agent stopping gracefully)                                  |

**Structure:** Panel bg, colored border, rounded-lg. Contains a small colored dot (1.5x1.5) + message text (xs, medium weight). Sonner's default toast layout is overridden via the `toastOptions.className` and `toastOptions.style` props on `<Sonner>` to match the Art Deco design.

### Settings Modal

The Settings modal is a tabbed interface (accessible from the title bar "Settings" button):

**Tabs:** General | Backend | Validators

- **General tab:**
  - Project directory (read-only text input + "Browse" button)
  - Max iterations (number input with helper text)
  - Auto-commit toggle (maps to `shouldCommit`)
  - Sound notifications toggle (desktop-only preference, stored in `electron-store`)

- **Backend tab:**
  - Radio card list of detected backend providers
  - Each option shows the backend name + its associated model
  - Active backend has an accent "Active" badge

- **Validators tab:**
  - List of current validation commands, each in a mono-font card with a hover-revealed remove button
  - "Add" input at the bottom with Enter key support
  - Commands displayed in `bun lint`, `bun fmt`, `bun run build` format

This is separate from the sidebar "Configuration" view (which shows the full three-layer config form). The Settings modal provides quick access to the most common configuration fields.

---

## Notification System

Replace the CLI's `osascript`/`notify-send` approach with Electron's native `Notification` API:

```typescript
import { Notification } from 'electron';

function sendNotification(title: string, body: string) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}
```

This is cross-platform (macOS, Windows, Linux) with no shell commands needed.

The notification behavior follows the same config semantics as the CLI:

- `notify: false` -- No notifications
- `notify: 'individual'` -- Notification after each loop iteration
- `notify: 'all'` -- Notification after the entire run loop completes

Additionally, the Settings modal includes a **sound notifications** toggle (see [Settings Modal](#settings-modal) in the Design System section). This is a desktop-only preference stored in `electron-store` (not in `.ody/ody.json`) that plays an audible alert when an agent run completes. It is independent of the OS notification config above -- users can enable both, either, or neither.

The desktop app also uses an in-app **toast notification system** for immediate UI feedback (e.g., "Plan created", "Task deleted"). See [Toast Notification System](#toast-notification-system) in the Design System section. Toasts are lightweight, auto-dismissing, and do not use the OS notification API.

---

## Build & Distribution

### Development

```bash
# From packages/desktop/
bun run start        # electron-forge start (dev mode with hot reload)
```

### Production Build

```bash
# From packages/desktop/
bun run package      # electron-forge package (unsigned)
bun run make         # electron-forge make (creates distributable installers)
```

### Forge Configuration

```typescript
// packages/desktop/forge.config.ts
import { MakerDMG } from '@electron-forge/maker-dmg'; // macOS
import { MakerSquirrel } from '@electron-forge/maker-squirrel'; // Windows
import { MakerDeb } from '@electron-forge/maker-deb'; // Linux .deb
import { VitePlugin } from '@electron-forge/plugin-vite';

export default {
  packagerConfig: {
    name: 'Ody',
    icon: './assets/icon',
    appBundleId: 'com.ody.desktop',
  },
  makers: [new MakerDMG({}), new MakerSquirrel({}), new MakerDeb({})],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/index.ts', config: 'vite.main.config.ts' },
        { entry: 'src/preload/index.ts', config: 'vite.preload.config.ts' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }],
    }),
  ],
};
```

### Renderer Vite Configuration

Tailwind CSS v4 integrates via a Vite plugin rather than PostCSS. There is **no `tailwind.config.js`** or `postcss.config.js` -- all Tailwind configuration is CSS-first via `@theme` directives in `globals.css`.

```typescript
// packages/desktop/vite.renderer.config.ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': './src/renderer',
    },
  },
});
```

### shadcn/ui CLI Configuration

The `components.json` file configures the `shadcn` CLI for component installation:

```jsonc
// packages/desktop/components.json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/renderer/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks",
    "utils": "@/lib/utils",
  },
  "iconLibrary": "lucide",
}
```

Components are installed on-demand: `npx shadcn add button dialog input select switch tabs dropdown-menu card badge radio-group sonner`. Each component is copied into `src/renderer/components/ui/` and owned by the project -- not an opaque dependency.

### Package Dependencies

```jsonc
// packages/desktop/package.json
{
  "name": "@ody/desktop",
  "version": "0.0.1",
  "main": ".vite/build/main.js",
  "dependencies": {
    "@internal/config": "workspace:*",
    "@internal/backends": "workspace:*",
    "@internal/builders": "workspace:*",
    "@internal/tasks": "workspace:*",
    "@internal/auth": "workspace:*",
    "@internal/integrations": "workspace:*",
    "node-pty": "^1.0.0", // PTY for terminal mode
    "zod": "^4.3.6", // Shared dep
  },
  "devDependencies": {
    // Electron & build tooling
    "@electron-forge/cli": "^7.0.0",
    "@electron-forge/maker-dmg": "^7.0.0",
    "@electron-forge/maker-squirrel": "^7.0.0",
    "@electron-forge/maker-deb": "^7.0.0",
    "@electron-forge/plugin-vite": "^7.0.0",
    "electron": "^33.0.0",
    "vite": "^6.0.0",
    "typescript": "^5.9.3",

    // React
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",

    // Tailwind CSS v4 (CSS-first, no tailwind.config.js)
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0", // Vite plugin (replaces PostCSS integration)

    // shadcn/ui dependencies
    "tw-animate-css": "^1.0.0", // Animation utility for shadcn/Tailwind v4
    "class-variance-authority": "^0.7.0", // Component variant API (used by shadcn components)
    "clsx": "^2.0.0", // Conditional className strings
    "tailwind-merge": "^3.0.0", // Intelligent Tailwind class deduplication
    "lucide-react": "^0.500.0", // Icon library (shadcn default)
    "sonner": "^2.0.0", // Toast notifications (shadcn recommended)
    // Note: Radix UI primitives (@radix-ui/react-dialog, @radix-ui/react-select, etc.)
    // are installed automatically when running `npx shadcn add <component>`.
    // They do not need to be listed here manually.

    // CodeMirror 6
    "codemirror": "^6.0.0",
    "@codemirror/lang-markdown": "^6.0.0",
    "@codemirror/merge": "^6.0.0",
    "@codemirror/theme-one-dark": "^6.0.0",
    "@codemirror/state": "^6.0.0",
    "@codemirror/view": "^6.0.0",

    // Terminal
    "xterm": "^5.5.0",
    "xterm-addon-fit": "^0.10.0",
    "xterm-addon-web-links": "^0.11.0",

    // State management
    "zustand": "^5.0.0",
  },
}
```

> **Note:** There is no `postcss.config.js` or `tailwind.config.js` in this project. Tailwind v4 uses the `@tailwindcss/vite` plugin for build integration and `@theme` directives in CSS for configuration. See the [Renderer Vite Configuration](#renderer-vite-configuration) and [CSS Variable Architecture](#css-variable-architecture-tailwind-v4--shadcnui) sections.

### Auto-Update

For distributing updates, use `electron-updater` with GitHub Releases:

```typescript
import { autoUpdater } from 'electron-updater';

autoUpdater.checkForUpdatesAndNotify();
```

This requires signing the app and publishing releases to GitHub. Can be deferred to a later phase.

---

## Migration Steps

Ordered by dependency and effort.

### Phase 1a: Extract `@internal/config`

1. Create `internal/config/` with `package.json` and `tsconfig.json`.
2. Move the following from `packages/cli/src/` to `internal/config/src/`:
   - `util/constants.ts` -> `constants.ts`
   - `lib/config.ts` -> `config.ts` (refactor: remove `@clack/prompts`, return errors instead of logging + exiting, remove `process.exit`)
   - `lib/sequencer.ts` -> `sequencer.ts`
3. Create `internal/config/src/index.ts` barrel export.
4. Update root `package.json` workspaces to `["packages/*", "internal/*"]`.
5. Verify: `bun install` resolves the new workspace.

**Estimated effort:** 1 day.

### Phase 1b: Extract `@internal/backends`

1. Create `internal/backends/` with `package.json` (depends on `@internal/config`).
2. Move the following from `packages/cli/src/` to `internal/backends/src/`:
   - `backends/harness.ts`
   - `backends/backend.ts`
   - `backends/claude.ts`
   - `backends/opencode.ts`
   - `backends/codex.ts`
   - `backends/util.ts` (refactor: replace `Bun.which` with Node-compatible check)
3. Create barrel export.

**Estimated effort:** 0.5 day.

### Phase 1c: Extract `@internal/builders`

1. Create `internal/builders/` with `package.json` (depends on `@internal/config`).
2. Move the following from `packages/cli/src/` to `internal/builders/src/`:
   - `builders/shared.ts`
   - `builders/runPrompt.ts`
   - `builders/planPrompt.ts` (includes `buildBatchPlanPrompt`)
   - `builders/editPlanPrompt.ts`
   - `builders/importPrompt.ts`
3. Create `builders/inlineEditPrompt.ts` -- new prompt builder for the desktop editor's Cmd+K AI edit flow.
4. Create barrel export.

**Estimated effort:** 0.5 day.

### Phase 1d: Extract `@internal/tasks`

1. Create `internal/tasks/` with `package.json` (depends on `@internal/config`).
2. Move the following from `packages/cli/src/` to `internal/tasks/src/`:
   - `util/task.ts` -> `task.ts` (refactor: replace `Bun.Glob` and `Bun.file` with Node APIs)
   - `types/task.ts` -> `types.ts`
3. Create barrel export.

**Estimated effort:** 0.5 day.

### Phase 1e: Extract `@internal/auth`

1. Create `internal/auth/` with `package.json` (no internal dependencies).
2. Move `packages/cli/src/lib/auth.ts` to `internal/auth/src/auth.ts`.
   - Refactor: replace `Bun.write`/`Bun.file` with `node:fs/promises`.
3. Create barrel export.

**Estimated effort:** 0.5 day.

### Phase 1f: Extract `@internal/integrations`

1. Create `internal/integrations/` with `package.json` (depends on `@internal/auth`).
2. Move the following from `packages/cli/src/` to `internal/integrations/src/`:
   - `lib/jira.ts` -> `jira.ts`
   - `lib/github.ts` -> `github.ts`
   - `lib/http.ts` -> `http.ts`
3. Create barrel export.

**Estimated effort:** 0.5 day.

### Phase 1g: Update `@ody/cli`

1. Update `packages/cli` to import from `@internal/*` instead of local paths.
2. Add all `@internal/*` packages as workspace dependencies in `packages/cli/package.json`.
3. Run existing tests to verify nothing is broken.
4. Run `bun run build` to verify CLI still compiles.

**Estimated effort:** 1 day.

### Phase 2: Scaffold Electron App

1. Create `packages/desktop/` with Electron Forge + Vite + React template.
2. Configure Forge, Vite configs, and `tsconfig.json`.
3. Set up the main process entry, preload script, and renderer entry.
4. Verify `bun run start` launches a blank Electron window.
5. Add `@internal/*` packages as workspace dependencies and verify imports work in main process.

**Estimated effort:** 1-2 days.

### Phase 3: Implement Core UI Shell

1. **Set up Tailwind v4 + shadcn/ui:**
   - Add `@tailwindcss/vite` to `vite.renderer.config.ts` plugins.
   - Create `globals.css` with `@import "tailwindcss"`, `@import "tw-animate-css"`, `@custom-variant dark (&:is(.dark *))` definition, Art Deco -> shadcn CSS variable mapping in `:root`, `@theme inline` bridge, and Art Deco `@theme` extended tokens. See the [CSS Variable Architecture](#css-variable-architecture-tailwind-v4--shadcnui) section for the full setup.
   - Run `npx shadcn init` to generate `components.json` with Vite/React config (set `rsc: false`, aliases matching the directory structure).
   - Create `lib/utils.ts` with the `cn()` helper (`clsx` + `tailwind-merge`).
   - Install foundational shadcn components: `npx shadcn add button dialog input select switch tabs dropdown-menu card badge radio-group sonner`.
   - Verify: base components render with Art Deco styling in dev mode.
2. Build the layout: sidebar, main content area, status bar.
3. Implement theming: `theme:get`/`theme:set` IPC handlers using `nativeTheme`, `useTheme` hook, `dark` class toggling on `<html>` (Tailwind v4 `@custom-variant dark`), shadcn CSS variable swap between `:root` and `.dark` blocks. Add System/Light/Dark toggle to Config View.
4. Implement project directory selection (native dialog).
5. Implement config loading and display (Config View with all fields including integrations section).
6. Implement the Init Wizard as a form (with all fields: backend, model, per-command model, agent profile, tasksDir, validators, skipPermissions, notify, jira, github). Use shadcn `<Select>`, `<Input>`, `<Switch>`, `<RadioGroup>`, and `<Dialog>` components.
7. Set up Zustand store with config, task, theme, agent, and auth slices.

**Estimated effort:** 4-5 days.

### Phase 4: Task Management

1. Implement task list IPC (scan `.code-task.md` files via `@internal/tasks`).
2. Build the Task Board (kanban view).
3. Implement task detail view (read and display markdown).
4. Implement task deletion.
5. Implement label filtering.

**Estimated effort:** 2-3 days.

### Phase 5: Task Editor (CodeMirror 6)

1. Add CodeMirror 6 dependencies (`codemirror`, `@codemirror/lang-markdown`, `@codemirror/merge`, `@codemirror/theme-one-dark`).
2. Build the `MarkdownEditor` component wrapping CodeMirror 6 with markdown syntax highlighting.
3. Build the `EditorToolbar` component (save, undo/redo, AI Edit button, Open in Terminal).
4. Wire up `editor:save` and `editor:snapshot` IPC for file persistence.
5. Implement the `TaskEditor` view (opened from Task Board card click, hosts editor + toolbar).
6. Test manual editing flow: open task -> edit -> save -> verify file on disk.

**Estimated effort:** 3-4 days.

### Phase 6: Editor AI Integration (Cmd+K + Diff)

1. Implement `buildInlineEditPrompt()` in `@internal/builders` -- new prompt builder that takes file content, optional selection range, and user instruction; instructs the agent to output the complete modified file.
2. Build the `InlinePrompt` component (floating input bar, anchored to cursor/selection, Cmd+K trigger).
3. Implement custom CodeMirror keybinding extension for Cmd+K / Ctrl+K.
4. Implement custom CodeMirror decoration extension to highlight selected region during prompt mode.
5. Wire up `agent:editInline` IPC handler in main process: snapshot file, build prompt, spawn backend, stream output, detect completion, read modified file, send `agent:editResult`.
6. Build the `DiffView` component using `@codemirror/merge` (side-by-side, original left, proposed right, proposed side editable).
7. Implement Accept/Reject flow: Accept overwrites file with proposed content, Reject restores from snapshot.
8. Handle edge cases: agent failure (error state + retry), user cancellation (kill process + restore snapshot), editor read-only lock during agent execution.

**Estimated effort:** 4-5 days.

### Phase 7: Agent Execution (Run Mode)

1. Implement `AgentRunner` in main process (spawn, stream, detect completion marker, ambiguous marker detection, post-run task verification).
2. Wire up `agent:run` IPC with output streaming to renderer.
3. Build the Run View with output display (scrollable log with ANSI support).
4. Implement start/stop controls.
5. Implement iteration tracking and progress display.
6. Add Electron `Notification` for completion (respecting `notify` config).
7. Implement `ProgressViewer` component (read/display/clear `.ody/progress.txt`).

**Estimated effort:** 3-4 days.

### Phase 8: PTY / Terminal Mode

1. Add `node-pty` dependency.
2. Implement `PtySession` in main process (using `buildInteractiveCommand()` for interactive sessions).
3. Add xterm.js component in renderer.
4. Wire up bidirectional IPC (output from pty -> xterm, input from xterm -> pty).
5. Handle resize events.
6. Wire "Open in Terminal" action in Task Editor to launch PTY session.

**Estimated effort:** 2-3 days.

### Phase 9: Plan Operations

1. Implement "Plan New -- Single" (description input, agent spawn, streaming preview).
2. Implement "Plan New -- Batch" (file picker, `buildBatchPlanPrompt`, agent spawn, streaming progress).
3. Implement "Plan Compact" (archive generation, confirmation dialog, deletion, progress.txt archival).
4. Implement Archive View (list and display past archives).

**Estimated effort:** 2-3 days.

### Phase 10: Auth & External Integrations

1. Implement Auth Management panel (Jira tab, GitHub tab, profile CRUD, masked token display).
2. Wire up `auth:*` IPC handlers in main process (delegates to `@internal/auth`).
3. Implement Task Import panel (source selector, input field, fetch preview, agent spawn).
4. Wire up `import:*` and `agent:import*` IPC handlers in main process (delegates to `@internal/integrations`).
5. Wire up `backends:models` IPC handler for opencode model auto-detection.

**Estimated effort:** 3-4 days.

### Phase 11: Polish & Distribution

1. Add app icon and branding.
2. Implement native menu bar (File, Edit, View, Help).
3. Add keyboard shortcuts (Cmd/Ctrl+N for new plan, Cmd/Ctrl+K in editor, etc.).
4. Implement "Recent Projects" persistence (electron-store or similar).
5. Add loading states, error boundaries, and empty states.
6. Set up Electron Forge makers for macOS, Windows, Linux.
7. Test on all target platforms.
8. Set up auto-updater with GitHub Releases.

**Estimated effort:** 3-5 days.

### Total Estimated Effort: 28-40 days

---

## Resolved Decisions

1. **Runtime for internal packages:** All `@internal/*` packages will be strictly Node-compatible. Bun cannot replace Electron's Node.js runtime due to the fundamental engine mismatch (JSC vs V8). Bun is used for dev tooling only (install, build scripts). See the Bun + Electron analysis for details.

2. **Package granularity:** Internal packages are split into focused, single-responsibility packages (`@internal/config`, `@internal/backends`, `@internal/builders`, `@internal/tasks`, `@internal/auth`, `@internal/integrations`) rather than a single monolithic shared package. This provides clearer dependency boundaries, enables consumers to import only what they need, and makes the extraction from CLI more reviewable. The `@internal/*` scope signals these are private workspace packages, not published to npm.

3. **Manual task editing:** Yes. The desktop app includes a full CodeMirror 6 markdown editor with manual editing support and an integrated AI edit flow (Cmd+K inline prompt + side-by-side diff review). See the [Task Editor](#ody-plan-edit--ody-task-edit---task-editor-codemirror-6--ai-inline-editing) section for the complete design.

4. **AI interaction model:** The AI edit flow uses the same subprocess-based backend spawning pattern as the CLI (via `@internal/backends`'s `Backend.buildCommand()`), not a direct LLM API call. This keeps the architecture consistent and avoids a separate API key management system. A new `buildInlineEditPrompt()` builder in `@internal/builders` constructs the prompt for editor-level edits.

5. **Theming:** The app supports light and dark themes, defaulting to the OS setting. Implementation approach:
   - **Main process:** Use Electron's `nativeTheme.shouldUseDarkColors` to detect OS preference at launch. Listen to `nativeTheme.on('updated', ...)` for live OS theme changes. Expose the current theme and a user override via IPC (`theme:get`, `theme:set`).
   - **Renderer (Tailwind v4 + shadcn/ui):** Tailwind v4 uses `@custom-variant dark (&:is(.dark *))` for class-based dark mode (replaces v3's `darkMode: 'class'` config option -- there is no `tailwind.config.js`). The color palette is defined via shadcn's CSS variable convention: `:root` and `.dark` blocks set `--background`, `--foreground`, `--primary`, `--border`, etc. mapped to the Art Deco hex values. The `@theme inline` directive bridges these CSS variables to Tailwind utility classes (`bg-background`, `text-foreground`, etc.). Additional Art Deco tokens beyond shadcn's convention (e.g., `--color-panel`, `--color-dim`, `--color-mid`) are defined via `@theme` and generate their own utilities. See the [CSS Variable Architecture](#css-variable-architecture-tailwind-v4--shadcnui) section for the full three-layer setup. shadcn/ui components inherit the theme automatically through CSS variables, requiring no per-component theme prop passing. Toggle the `dark` class on `<html>` to switch themes.
   - **CodeMirror:** Switch between `@codemirror/theme-one-dark` (dark) and the default light theme. Wrap in a reactive extension compartment so the theme can be swapped without recreating the editor.
   - **xterm.js:** Apply a matching terminal theme object (`ITheme`) with appropriate foreground/background/ANSI colors for each mode.
   - **User override:** The Config View includes a "Theme" setting with three options: System (default), Light, Dark. The preference is persisted via `electron-store` (not in `.ody/ody.json`, since this is a desktop-app-level preference, not a project-level config).

6. **Backend installation:** Detect and report only. The app does not install backends for the user. On launch (and in the Init Wizard), `@internal/backends`'s `getAvailableBackends()` checks which backends are on `$PATH`. If none are found, the app shows a setup prompt with:
   - A clear message: "No supported backends found on your system."
   - A status list showing each backend with a checkmark or "not found" indicator.
   - Links to the installation docs for each backend:
     - **Claude Code:** https://docs.anthropic.com/en/docs/claude-code
     - **OpenCode:** https://opencode.ai/docs
     - **Codex:** https://github.com/openai/codex
   - Links open in the system browser via `shell.openExternal()`.
   - The Init Wizard's backend selector only shows detected backends. If none are detected, the wizard cannot proceed (the "Next" button is disabled with a tooltip explaining why).
   - The Config View's status bar shows the active backend and a warning icon if it becomes unavailable (e.g., uninstalled after initial setup).

7. **Testing strategy:** Vitest only for now. Unit tests for React components, hooks, and Zustand store slices. Integration tests for IPC handler logic (mocking Electron APIs). No E2E framework initially -- can be revisited later if needed.

8. **Project multi-tenancy:** Multiple projects supported as switchable folders in the sidebar. One project is active at a time (no simultaneous multi-project state). Projects are added via folder picker, listed in the sidebar, and switched by clicking. The project list and last-active project are persisted in `electron-store`. Switching projects reloads config, rescans tasks, and resets agent state. See the [Project Management](#project-management) section for full details.

9. **Global vs local config in GUI:** The GUI introduces a third config layer on top of the CLI's existing two. Precedence (highest to lowest):
   1. **GUI per-project overrides** -- stored in `electron-store` keyed by project path. Desktop-app-only; not written to `.ody/ody.json`. Takes highest priority so the GUI can override any value without modifying files on disk that the CLI also reads.
   2. **Local** `.ody/ody.json` -- per-project config file, shared with the CLI.
   3. **Global** `~/.ody/ody.json` -- user-wide defaults, shared with the CLI.

   All three layers are merged and displayed as a single form in the Config View. Each field shows a source indicator (`(gui)`, `(local)`, `(global)`, or `(default)`) so the user understands where each value originates. The user can save changes to either the GUI layer (project-specific, desktop-only) or the global layer (affects CLI too). A "Reset GUI Overrides" button clears all GUI-layer values for the active project. See the [Config View](#config-view) section for the full wireframe.

   **Implementation in `@internal/config`:** The existing `Config.load()` returns the two-layer merge (global + local). The GUI layer is handled entirely in the Electron main process -- it loads the merged config from `@internal/config`, then applies GUI overrides on top from `electron-store`. This means `@internal/config` does not need to know about the GUI layer.
