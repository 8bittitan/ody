# Electron Desktop App Plan

Plan for an Electron-based desktop application that replicates the full functionality of `@ody/cli` as a standalone GUI, sharing core logic via a `@ody/shared` workspace package.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Workspace Restructure](#workspace-restructure)
3. [Shared Package (`@ody/shared`)](#shared-package-odyshared)
4. [Electron App Package (`@ody/desktop`)](#electron-app-package-odydesktop)
5. [Feature Mapping: CLI to Desktop](#feature-mapping-cli-to-desktop)
6. [IPC Contract](#ipc-contract)
7. [UI Design](#ui-design)
8. [Process Spawning & Agent Streaming](#process-spawning--agent-streaming)
9. [Notification System](#notification-system)
10. [Build & Distribution](#build--distribution)
11. [Migration Steps](#migration-steps)
12. [Resolved Decisions](#resolved-decisions)

---

## Architecture Overview

```
+------------------------------------------------------+
|                  Electron App                         |
|                                                       |
|  +------------------+       +----------------------+  |
|  |  Renderer (React) | <--> |  Main Process (Node) |  |
|  |  - UI components  | IPC  |  - @ody/shared       |  |
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
|                  @ody/shared                           |
|  - Config (load, parse, merge, validate)              |
|  - Backends (Harness, command builders)               |
|  - Prompt builders (run, plan, edit)                  |
|  - Task utilities (frontmatter, labels, titles)       |
|  - Constants                                          |
|  - Types                                              |
+------------------------------------------------------+
```

The desktop app does NOT invoke or wrap the CLI binary. It imports `@ody/shared` directly for config, prompt building, backend command construction, and task parsing -- then spawns agent processes itself from the Electron main process.

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
  cli/              # @ody/cli (refactored to import from @ody/shared)
  shared/           # @ody/shared (extracted core logic)
  desktop/          # @ody/desktop (Electron app)
```

Root `package.json` stays the same (`"workspaces": ["packages/*"]`).

---

## Shared Package (`@ody/shared`)

### What Gets Extracted

The following modules move out of `packages/cli/src/` and into `packages/shared/src/`:

| Current Location             | Shared Module                  | Changes Needed                                                                                                                                                                         |
| ---------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/config.ts`              | `config.ts`                    | Remove `@clack/prompts` log calls. Return errors instead of logging + exiting. Replace `log.warn` with thrown/returned errors. Remove `process.exit`.                                  |
| `backends/harness.ts`        | `backends/harness.ts`          | None -- already pure types.                                                                                                                                                            |
| `backends/claude.ts`         | `backends/claude.ts`           | None -- pure data transformation.                                                                                                                                                      |
| `backends/opencode.ts`       | `backends/opencode.ts`         | None -- pure data transformation.                                                                                                                                                      |
| `backends/codex.ts`          | `backends/codex.ts`            | None -- pure data transformation.                                                                                                                                                      |
| `backends/backend.ts`        | `backends/backend.ts`          | None -- pure factory.                                                                                                                                                                  |
| `backends/util.ts`           | `backends/util.ts`             | Replace `Bun.which()` with a runtime-agnostic helper (fallback to Node's `child_process.execSync('which ...')` or `where` on Windows).                                                 |
| `builders/runPrompt.ts`      | `builders/runPrompt.ts`        | None -- pure string templates.                                                                                                                                                         |
| `builders/planPrompt.ts`     | `builders/planPrompt.ts`       | None -- pure string templates.                                                                                                                                                         |
| `builders/editPlanPrompt.ts` | `builders/editPlanPrompt.ts`   | None -- pure string templates.                                                                                                                                                         |
| _(new)_                      | `builders/inlineEditPrompt.ts` | New builder for the desktop editor's Cmd+K AI edit flow. Takes file content, optional selection range, and user instruction. Instructs the agent to output the complete modified file. |
| `util/constants.ts`          | `constants.ts`                 | None -- pure values.                                                                                                                                                                   |
| `util/task.ts`               | `task.ts`                      | Replace `Bun.Glob` with a Node-compatible glob (e.g., `fast-glob` or `node:fs` + manual filtering). Replace `Bun.file().text()` with `fs/promises.readFile()`.                         |
| `lib/sequencer.ts`           | `sequencer.ts`                 | None -- pure function.                                                                                                                                                                 |
| `types/task.ts`              | `types.ts`                     | None -- pure types.                                                                                                                                                                    |

### Shared Package API Surface

```typescript
// @ody/shared

// Config
export { Config, configSchema } from './config';
export type { OdyConfig } from './config';

// Backends
export { Backend } from './backends/backend';
export { Harness } from './backends/harness';
export type { CommandOptions } from './backends/harness';
export { getAvailableBackends } from './backends/util';

// Prompt builders
export { buildRunPrompt, LOOP_PROMPT, SINGLE_TASK_PROMPT } from './builders/runPrompt';
export { buildPlanPrompt } from './builders/planPrompt';
export { buildEditPlanPrompt } from './builders/editPlanPrompt';
export { buildInlineEditPrompt } from './builders/inlineEditPrompt';

// Task utilities
export {
  resolveTasksDir,
  parseFrontmatter,
  parseTitle,
  parseDescription,
  getTaskFilesByLabel,
} from './task';

// Constants
export { BASE_DIR, ODY_FILE, TASKS_DIR, ALLOWED_BACKENDS } from './constants';

// Types
export type { CompletedTask } from './types';
```

### Runtime Compatibility

`@ody/shared` must run in both Bun (for CLI) and Node.js (for Electron main process). This means:

- No `Bun.*` APIs in shared code.
- Use `node:fs/promises` for file I/O.
- Use `node:path` for path operations.
- Use `node:child_process` for process detection (replacing `Bun.which`).
- Use a portable glob library or `node:fs` recursive readdir.
- `zod` works in both runtimes (no changes needed).

Alternatively, if Electron is built using Electron Forge with a custom Bun-based build pipeline, Bun APIs could work -- but this is fragile and not recommended. Node compatibility is the safer path.

### Package Configuration

```jsonc
// packages/shared/package.json
{
  "name": "@ody/shared",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zod": "^4.3.6",
  },
}
```

No build step needed for the shared package when consumed within the monorepo (both Bun and Electron's bundler can consume TypeScript source directly).

---

## Electron App Package (`@ody/desktop`)

### Technology Choices

| Concern            | Choice                                                 | Rationale                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Electron                                               | Per the plan's scope; team is JS/TS.                                                                                                                                       |
| Build tooling      | Electron Forge + Vite                                  | Modern, fast bundling. Forge handles packaging/signing.                                                                                                                    |
| Frontend framework | React                                                  | Component model maps well to the multi-panel UI. Wide ecosystem.                                                                                                           |
| State management   | Zustand                                                | Lightweight, works well with React. No boilerplate.                                                                                                                        |
| Terminal emulation | xterm.js                                               | Standard for embedded terminals. Needed for `--once` equivalent (PTY mode).                                                                                                |
| Code editor        | CodeMirror 6                                           | Lightweight (~130KB), excellent markdown support, extensible. Used by Obsidian, Replit. `@codemirror/merge` provides built-in diff view.                                   |
| Styling            | Tailwind CSS                                           | Utility-first, fast iteration, good for data-dense UIs.                                                                                                                    |
| Theming            | Light + Dark, OS default                               | Follow OS preference via `nativeTheme.shouldUseDarkColors`. User can override in settings. Tailwind's `dark:` variant + CSS custom properties for CodeMirror/xterm themes. |
| IPC layer          | Electron `ipcMain` / `ipcRenderer` via `contextBridge` | Standard secure pattern. Preload script exposes typed API.                                                                                                                 |

### Directory Structure

```
packages/desktop/
  package.json
  forge.config.ts            # Electron Forge configuration
  vite.main.config.ts        # Vite config for main process
  vite.preload.config.ts     # Vite config for preload script
  vite.renderer.config.ts    # Vite config for renderer
  tsconfig.json
  src/
    main/
      index.ts               # Electron main process entry
      ipc.ts                 # IPC handler registration
      agent.ts               # Agent process spawning & streaming
      windows.ts             # Window management
    preload/
      index.ts               # contextBridge API exposure
    renderer/
      index.html
      main.tsx               # React entry
      App.tsx
      components/
        Layout.tsx
        Sidebar.tsx
        TaskBoard.tsx
        TaskCard.tsx
        TaskEditor.tsx        # Full editor view (hosts CodeMirror + AI prompt)
        ConfigPanel.tsx
        InitWizard.tsx
        AgentRunner.tsx
        AgentOutput.tsx       # Streaming output display
        TerminalView.tsx      # xterm.js wrapper for PTY mode
        PlanCreator.tsx
        PlanList.tsx
        ArchiveViewer.tsx
        ProjectList.tsx       # Sidebar project list with add/remove/switch
        NotificationBanner.tsx
        editor/
          MarkdownEditor.tsx  # CodeMirror 6 wrapper with markdown extensions
          InlinePrompt.tsx    # Cmd+K floating prompt input
          DiffView.tsx        # Side-by-side diff using @codemirror/merge
          EditorToolbar.tsx   # Save, undo/redo, AI Edit button, status
      hooks/
        useProjects.ts        # Project list, active project, switching
        useConfig.ts
        useTasks.ts
        useAgent.ts
        useEditor.ts          # Editor state, AI edit lifecycle, diff management
        useTheme.ts           # Theme state, OS sync, class toggling on <html>
        useNotifications.ts
      store/
        index.ts              # Zustand store
        slices/
          projectSlice.ts     # Project list, active project
          configSlice.ts
          taskSlice.ts
          agentSlice.ts
      lib/
        api.ts                # Typed wrapper around window.ody IPC
      types/
        ipc.ts                # Shared IPC channel + payload types
```

---

## Feature Mapping: CLI to Desktop

### `ody init` -> Init Wizard Panel

| CLI Behavior                              | Desktop Equivalent                        |
| ----------------------------------------- | ----------------------------------------- |
| `@clack/prompts` autocomplete for backend | Dropdown/combobox with detected backends  |
| Text input for model                      | Text input field                          |
| Confirm + loop for validator commands     | Dynamic list builder (add/remove/reorder) |
| `skipPermissions` toggle for Claude       | Checkbox                                  |
| Notification preference select            | Radio group                               |
| `--dry-run` prints config                 | "Preview" button shows JSON before saving |
| Writes `.ody/ody.json`                    | Same -- writes via main process IPC       |

**UI:** A stepped wizard dialog (or a single form panel) within the main window. Accessed from sidebar or on first launch if no config exists.

### `ody run` -> Agent Runner Panel

| CLI Behavior                      | Desktop Equivalent                                             |
| --------------------------------- | -------------------------------------------------------------- |
| Spinner with iteration count      | Progress bar + iteration counter in UI                         |
| `--verbose` streams output        | Always-visible output panel (collapsible). Scrolling log view. |
| `--once` PTY mode                 | Embedded terminal (xterm.js + node-pty) in a tab/panel         |
| `<woof>COMPLETE</woof>` detection | Same logic in main process; sends `agent:complete` IPC event   |
| `--label` filter                  | Label chips/filter bar above task list                         |
| `--iterations` override           | Number input in run configuration                              |
| `--no-notify`                     | Toggle in settings or run config                               |
| Task file positional arg          | Click-to-run on a specific task card                           |
| `--dry-run`                       | "Show Command" button that displays the command array          |
| Notification on completion        | Electron `Notification` API (native OS notification)           |

**UI:** The primary view. Split layout:

- Left: Primary sidebar with projects list
- Center: streaming agent output (auto-scrolling log or embedded terminal)
- Top bar: run controls (start, stop, iteration count, verbose toggle)
- Right: task list (filterable by label/status)

### `ody config` -> Config Panel

| CLI Behavior          | Desktop Equivalent                                        |
| --------------------- | --------------------------------------------------------- |
| Prints JSON to stdout | Settings panel showing current config as an editable form |
| Warning if no config  | Empty state with "Run Setup" CTA                          |

**UI:** Accessible from sidebar. Shows all config values with inline editing. Save button validates via `Config.parse()` from `@ody/shared` and writes.

### `ody plan new` -> Plan Creator

| CLI Behavior                               | Desktop Equivalent                                         |
| ------------------------------------------ | ---------------------------------------------------------- |
| Text prompt for description                | Multi-line text area                                       |
| Spawns backend to generate `.code-task.md` | Same spawn + stream, but output renders in a preview panel |
| Loop: "Add another plan?"                  | "Create Another" button after completion                   |
| `--dry-run`                                | "Preview Prompt" button                                    |

**UI:** A panel or modal with a text area for the task description and a "Generate" button. Shows a live-updating preview of the generated task file as the agent streams output.

### `ody plan list` -> Task Board

| CLI Behavior                  | Desktop Equivalent                                                   |
| ----------------------------- | -------------------------------------------------------------------- |
| Scans and lists pending tasks | Card-based board grouped by status (pending, in_progress, completed) |
| Shows title only              | Cards show title, labels, complexity, created date                   |

**UI:** Kanban-style board or a filterable/sortable table view. Cards are clickable to view/edit the full task file.

### `ody plan edit` -> Task Editor (CodeMirror 6 + AI Inline Editing)

| CLI Behavior                 | Desktop Equivalent                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| Select prompt to pick task   | Click a task card from the Task Board                                                             |
| Spawns backend to edit       | Inline prompt (Cmd+K) spawns backend directly; result shown as diff                               |
| Agent modifies file in place | Agent output captured; proposed changes shown in side-by-side diff view. User accepts or rejects. |

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
5. Main process snapshots the file on disk, builds an edit prompt using `buildInlineEditPrompt()` from `@ody/shared`, spawns the configured backend.
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

  // Tasks
  'tasks:list': () => TaskSummary[];
  'tasks:read': (filename: string) => string;
  'tasks:delete': (filenames: string[]) => void;
  'tasks:byLabel': (label: string) => string[];

  // Agent operations
  'agent:run': (opts: RunOptions) => void; // Starts agent loop
  'agent:runOnce': (opts: RunOnceOptions) => void; // Starts PTY session
  'agent:stop': () => void; // Kills agent process
  'agent:planNew': (description: string) => void; // Generate new plan
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
  },
  tasks: {
    list: () => ipcRenderer.invoke('tasks:list'),
    read: (filename) => ipcRenderer.invoke('tasks:read', filename),
    delete: (filenames) => ipcRenderer.invoke('tasks:delete', filenames),
    byLabel: (label) => ipcRenderer.invoke('tasks:byLabel', label),
  },
  agent: {
    run: (opts) => ipcRenderer.invoke('agent:run', opts),
    runOnce: (opts) => ipcRenderer.invoke('agent:runOnce', opts),
    stop: () => ipcRenderer.invoke('agent:stop'),
    planNew: (desc) => ipcRenderer.invoke('agent:planNew', desc),
    planEdit: (filename) => ipcRenderer.invoke('agent:planEdit', filename),
    editInline: (opts) => ipcRenderer.invoke('agent:editInline', opts),
    dryRun: (opts) => ipcRenderer.invoke('agent:dryRun', opts),
    onOutput: (cb) => ipcRenderer.on('agent:output', (_, chunk) => cb(chunk)),
    onComplete: (cb) => ipcRenderer.on('agent:complete', () => cb()),
    onError: (cb) => ipcRenderer.on('agent:error', (_, err) => cb(err)),
    onIteration: (cb) => ipcRenderer.on('agent:iteration', (_, cur, max) => cb(cur, max)),
    onStarted: (cb) => ipcRenderer.on('agent:started', () => cb()),
    onStopped: (cb) => ipcRenderer.on('agent:stopped', () => cb()),
    onEditResult: (cb) => ipcRenderer.on('agent:editResult', (_, content) => cb(content)),
    removeAllListeners: () => {
      [
        'agent:output',
        'agent:complete',
        'agent:error',
        'agent:iteration',
        'agent:started',
        'agent:stopped',
        'agent:editResult',
      ].forEach((ch) => ipcRenderer.removeAllListeners(ch));
    },
  },
  editor: {
    save: (filePath, content) => ipcRenderer.invoke('editor:save', filePath, content),
    snapshot: (filePath) => ipcRenderer.invoke('editor:snapshot', filePath),
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
import { Backend, buildRunPrompt, Config } from '@ody/shared';

class AgentRunner {
  private proc: ChildProcess | null = null;
  private aborted = false;

  async runLoop(win: BrowserWindow, opts: RunOptions) {
    const config = Config.all();
    const backend = new Backend(config.backend);
    const maxIterations = opts.iterations ?? config.maxIterations;
    const prompt = buildRunPrompt({
      /* template vars */
    });

    for (let i = 1; !this.aborted && (maxIterations === 0 || i <= maxIterations); i++) {
      win.webContents.send('agent:iteration', i, maxIterations);
      const cmd = backend.buildCommand(prompt);
      const completed = await this.spawnAndStream(win, cmd);
      if (completed) break; // <woof>COMPLETE</woof> detected
    }

    win.webContents.send('agent:complete');
  }

  private spawnAndStream(win: BrowserWindow, cmd: string[]): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const [bin, ...args] = cmd;
      this.proc = spawn(bin, args, { cwd: opts.projectDir });
      let accumulated = '';

      this.proc.stdout?.on('data', (chunk) => {
        const text = chunk.toString();
        accumulated += text;
        win.webContents.send('agent:output', text);
        if (accumulated.includes('<woof>COMPLETE</woof>')) {
          this.proc?.kill();
          resolve(true);
        }
      });

      this.proc.stderr?.on('data', (chunk) => {
        win.webContents.send('agent:output', chunk.toString());
      });

      this.proc.on('close', () => resolve(false));
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

For the `--once` equivalent, use `node-pty` to spawn a real PTY and pipe it to `xterm.js` in the renderer:

```typescript
import * as pty from 'node-pty';

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
```

The renderer uses `xterm.js` to display the PTY output and sends keystrokes back through IPC.

---

## UI Design

### Main Layout

```
+----------------------------------------------------------+
| [Ody]                                    [Settings] [?]  |
+----------+-----------------------------------------------+
| PROJECTS |                                                |
| ----------                                                |
| * my-app |  MAIN CONTENT AREA                            |
|   api    |                                                |
|   web    |  (varies by active view)                      |
| [+ Add]  |                                                |
|----------|                                                |
| VIEWS    |                                                |
| ----------                                                |
| > Tasks  |                                                |
|   Run    |                                                |
|   Plan   |                                                |
|   Config |                                                |
|   Archive|                                                |
|----------|                                                |
| STATUS   |                                                |
| Backend: |                                                |
| opencode |                                                |
| Idle     |                                                |
+----------+-----------------------------------------------+
```

The sidebar is split into two sections: **Projects** (top) and **Views** (bottom). The active project is highlighted; clicking another project switches the entire app context (config, tasks, agent cwd) to that folder.

### View Details

#### Tasks View (Default)

Kanban board with three columns: **Pending**, **In Progress**, **Completed**.

Each task card shows:

- Title (from `# Task:` heading)
- Labels (as colored chips)
- Complexity badge
- Created date
- Actions: Run, Edit, AI Edit, Delete

Toolbar: `[+ New Plan]  [Archive Completed]  [Filter by label: ___]`

#### Run View

Split pane:

- **Top:** Run controls
  - Project directory selector
  - Backend display (from config)
  - Iteration limit input
  - Task filter (label or specific file)
  - `[Start]` `[Stop]` buttons
  - Progress: "Iteration 2 of 5 -- Running..."
- **Bottom:** Agent output
  - Scrollable log view with ANSI color support (via `ansi-to-html` or similar)
  - Toggle: Log View / Terminal View (xterm.js)
  - `[Clear]` button

#### Plan View

Sub-tabs: **New** | **List**

- **New:** Text area for description + "Generate" button. Live preview of generated file below.
- **List:** Same as Tasks View but filtered to pending only. Simpler list format.

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

The editor is powered by CodeMirror 6. The diff view uses `@codemirror/merge`. The user can manually edit the proposed side before accepting. See the [Feature Mapping > Task Editor](#ody-plan-edit---task-editor-codemirror-6--ai-inline-editing) section for the full AI edit flow and edge case handling.

#### Config View

Three-layer config with precedence: **GUI (per-project)** > **local** `.ody/ody.json` > **global** `~/.ody/ody.json`. All layers are merged and shown as a single form. Each field displays a subtle source indicator showing where its current value comes from.

```
Config                                    [Reset GUI Overrides]
--------------------------------------------------------------

Backend:              [opencode v]                      (local)
Model:                [anthropic/claude-opus-4-6    ]     (gui)
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

                      [Save to Project]  [Save to Global]
```

**Source indicators:** Each field shows a small label -- `(global)`, `(local)`, `(gui)`, or `(default)` -- indicating which layer the current effective value comes from. This helps users understand why a value is set and where to change it.

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

- Right-click a project in the sidebar > "Remove from list." This only removes it from the app's project list -- it does not delete any files on disk.

**Persistence:**

- The project list (array of absolute paths) and the last-active project are persisted via `electron-store` (app-level, not project-level).
- On launch, the app opens the last-active project. If that path no longer exists, it falls back to the project list or the welcome screen.

**How it maps to the CLI:**

- The CLI uses `process.cwd()` implicitly. In the desktop app, the active project's path becomes the `cwd` for all agent spawns and the root for `.ody/` config loading. All IPC handlers that touch the filesystem use this as their base path.

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

### Package Dependencies

```jsonc
// packages/desktop/package.json
{
  "name": "@ody/desktop",
  "version": "0.0.1",
  "main": ".vite/build/main.js",
  "dependencies": {
    "@ody/shared": "workspace:*",
    "node-pty": "^1.0.0", // PTY for terminal mode
    "zod": "^4.3.6", // Shared dep (also in @ody/shared)
  },
  "devDependencies": {
    "@electron-forge/cli": "^7.0.0",
    "@electron-forge/maker-dmg": "^7.0.0",
    "@electron-forge/maker-squirrel": "^7.0.0",
    "@electron-forge/maker-deb": "^7.0.0",
    "@electron-forge/plugin-vite": "^7.0.0",
    "electron": "^33.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "codemirror": "^6.0.0",
    "@codemirror/lang-markdown": "^6.0.0",
    "@codemirror/merge": "^6.0.0",
    "@codemirror/theme-one-dark": "^6.0.0",
    "@codemirror/state": "^6.0.0",
    "@codemirror/view": "^6.0.0",
    "xterm": "^5.5.0",
    "xterm-addon-fit": "^0.10.0",
    "xterm-addon-web-links": "^0.11.0",
    "zustand": "^5.0.0",
    "tailwindcss": "^4.0.0",
    "vite": "^6.0.0",
    "typescript": "^5.9.3",
  },
}
```

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

### Phase 1: Extract Shared Package

1. Create `packages/shared/` with `package.json` and `tsconfig.json`.
2. Move the following from `packages/cli/src/` to `packages/shared/src/`:
   - `util/constants.ts`
   - `types/task.ts`
   - `lib/sequencer.ts`
   - `lib/config.ts` (refactor: remove `@clack/prompts`, return errors)
   - `backends/harness.ts`
   - `backends/claude.ts`
   - `backends/opencode.ts`
   - `backends/codex.ts`
   - `backends/backend.ts`
   - `backends/util.ts` (refactor: replace `Bun.which` with Node-compatible check)
   - `builders/runPrompt.ts`
   - `builders/planPrompt.ts`
   - `builders/editPlanPrompt.ts`
   - `util/task.ts` (refactor: replace `Bun.Glob` and `Bun.file` with Node APIs)
3. Create `builders/inlineEditPrompt.ts` -- new prompt builder for the desktop editor's Cmd+K AI edit flow.
4. Create `packages/shared/src/index.ts` barrel export.
5. Update `packages/cli` to import from `@ody/shared` instead of local paths.
6. Run existing tests to verify nothing is broken.
7. Run `bun run build` to verify CLI still compiles.

**Estimated effort:** 2-3 days.

### Phase 2: Scaffold Electron App

1. Create `packages/desktop/` with Electron Forge + Vite + React template.
2. Configure Forge, Vite configs, and `tsconfig.json`.
3. Set up the main process entry, preload script, and renderer entry.
4. Verify `bun run start` launches a blank Electron window.
5. Add `@ody/shared` as a workspace dependency and verify imports work in main process.

**Estimated effort:** 1-2 days.

### Phase 3: Implement Core UI Shell

1. Build the layout: sidebar, main content area, status bar.
2. Implement theming: `theme:get`/`theme:set` IPC handlers using `nativeTheme`, `useTheme` hook, Tailwind `dark:` class toggling, CSS custom property layer. Add System/Light/Dark toggle to Config View.
3. Implement project directory selection (native dialog).
4. Implement config loading and display (Config View).
5. Implement the Init Wizard as a form.
6. Set up Zustand store with config, task, theme, and agent slices.

**Estimated effort:** 3-4 days.

### Phase 4: Task Management

1. Implement task list IPC (scan `.code-task.md` files via `@ody/shared`).
2. Build the Task Board (kanban view).
3. Implement task detail view (read and display markdown).
4. Implement task deletion.
5. Implement label filtering.

**Estimated effort:** 2-3 days.

### Phase 5: Task Editor (CodeMirror 6)

1. Add CodeMirror 6 dependencies (`codemirror`, `@codemirror/lang-markdown`, `@codemirror/merge`, `@codemirror/theme-one-dark`).
2. Build the `MarkdownEditor` component wrapping CodeMirror 6 with markdown syntax highlighting.
3. Build the `EditorToolbar` component (save, undo/redo, AI Edit button).
4. Wire up `editor:save` and `editor:snapshot` IPC for file persistence.
5. Implement the `TaskEditor` view (opened from Task Board card click, hosts editor + toolbar).
6. Test manual editing flow: open task -> edit -> save -> verify file on disk.

**Estimated effort:** 3-4 days.

### Phase 6: Editor AI Integration (Cmd+K + Diff)

1. Implement `buildInlineEditPrompt()` in `@ody/shared` -- new prompt builder that takes file content, optional selection range, and user instruction; instructs the agent to output the complete modified file.
2. Build the `InlinePrompt` component (floating input bar, anchored to cursor/selection, Cmd+K trigger).
3. Implement custom CodeMirror keybinding extension for Cmd+K / Ctrl+K.
4. Implement custom CodeMirror decoration extension to highlight selected region during prompt mode.
5. Wire up `agent:editInline` IPC handler in main process: snapshot file, build prompt, spawn backend, stream output, detect completion, read modified file, send `agent:editResult`.
6. Build the `DiffView` component using `@codemirror/merge` (side-by-side, original left, proposed right, proposed side editable).
7. Implement Accept/Reject flow: Accept overwrites file with proposed content, Reject restores from snapshot.
8. Handle edge cases: agent failure (error state + retry), user cancellation (kill process + restore snapshot), editor read-only lock during agent execution.

**Estimated effort:** 4-5 days.

### Phase 7: Agent Execution (Run Mode)

1. Implement `AgentRunner` in main process (spawn, stream, detect completion).
2. Wire up `agent:run` IPC with output streaming to renderer.
3. Build the Run View with output display (scrollable log with ANSI support).
4. Implement start/stop controls.
5. Implement iteration tracking and progress display.
6. Add Electron `Notification` for completion.

**Estimated effort:** 3-4 days.

### Phase 8: PTY / Terminal Mode

1. Add `node-pty` dependency.
2. Implement `PtySession` in main process.
3. Add xterm.js component in renderer.
4. Wire up bidirectional IPC (output from pty -> xterm, input from xterm -> pty).
5. Handle resize events.

**Estimated effort:** 2-3 days.

### Phase 9: Plan Operations

1. Implement "Plan New" (description input, agent spawn, streaming preview).
2. Implement "Plan Compact" (archive generation, confirmation dialog, deletion).
3. Implement Archive View (list and display past archives).

**Estimated effort:** 2-3 days.

### Phase 10: Polish & Distribution

1. Add app icon and branding.
2. Implement native menu bar (File, Edit, View, Help).
3. Add keyboard shortcuts (Cmd/Ctrl+N for new plan, Cmd/Ctrl+K in editor, etc.).
4. Implement "Recent Projects" persistence (electron-store or similar).
5. Add loading states, error boundaries, and empty states.
6. Set up Electron Forge makers for macOS, Windows, Linux.
7. Test on all target platforms.
8. Set up auto-updater with GitHub Releases.

**Estimated effort:** 3-5 days.

### Total Estimated Effort: 23-34 days

---

## Resolved Decisions

1. **Runtime for shared package:** `@ody/shared` will be strictly Node-compatible. Bun cannot replace Electron's Node.js runtime due to the fundamental engine mismatch (JSC vs V8). Bun is used for dev tooling only (install, build scripts). See the Bun + Electron analysis for details.

2. **Manual task editing:** Yes. The desktop app includes a full CodeMirror 6 markdown editor with manual editing support and an integrated AI edit flow (Cmd+K inline prompt + side-by-side diff review). See the [Task Editor](#ody-plan-edit---task-editor-codemirror-6--ai-inline-editing) section for the complete design.

3. **AI interaction model:** The AI edit flow uses the same subprocess-based backend spawning pattern as the CLI (via `@ody/shared`'s `Backend.buildCommand()`), not a direct LLM API call. This keeps the architecture consistent and avoids a separate API key management system. A new `buildInlineEditPrompt()` builder in `@ody/shared` constructs the prompt for editor-level edits.

4. **Theming:** The app supports light and dark themes, defaulting to the OS setting. Implementation approach:
   - **Main process:** Use Electron's `nativeTheme.shouldUseDarkColors` to detect OS preference at launch. Listen to `nativeTheme.on('updated', ...)` for live OS theme changes. Expose the current theme and a user override via IPC (`theme:get`, `theme:set`).
   - **Renderer (Tailwind):** Use Tailwind's `dark:` variant with class-based toggling (add/remove `dark` class on `<html>`). Define a CSS custom property layer (`--ody-bg`, `--ody-text`, `--ody-border`, etc.) for components that need fine-grained control.
   - **CodeMirror:** Switch between `@codemirror/theme-one-dark` (dark) and the default light theme. Wrap in a reactive extension compartment so the theme can be swapped without recreating the editor.
   - **xterm.js:** Apply a matching terminal theme object (`ITheme`) with appropriate foreground/background/ANSI colors for each mode.
   - **User override:** The Config View includes a "Theme" setting with three options: System (default), Light, Dark. The preference is persisted via `electron-store` (not in `.ody/ody.json`, since this is a desktop-app-level preference, not a project-level config).

5. **Backend installation:** Detect and report only. The app does not install backends for the user. On launch (and in the Init Wizard), `@ody/shared`'s `getAvailableBackends()` checks which backends are on `$PATH`. If none are found, the app shows a setup prompt with:
   - A clear message: "No supported backends found on your system."
   - A status list showing each backend with a checkmark or "not found" indicator.
   - Links to the installation docs for each backend:
     - **Claude Code:** https://docs.anthropic.com/en/docs/claude-code
     - **OpenCode:** https://opencode.ai/docs
     - **Codex:** https://github.com/openai/codex
   - Links open in the system browser via `shell.openExternal()`.
   - The Init Wizard's backend selector only shows detected backends. If none are detected, the wizard cannot proceed (the "Next" button is disabled with a tooltip explaining why).
   - The Config View's status bar shows the active backend and a warning icon if it becomes unavailable (e.g., uninstalled after initial setup).

6. **Testing strategy:** Vitest only for now. Unit tests for React components, hooks, and Zustand store slices. Integration tests for IPC handler logic (mocking Electron APIs). No E2E framework initially -- can be revisited later if needed.

7. **Project multi-tenancy:** Multiple projects supported as switchable folders in the sidebar. One project is active at a time (no simultaneous multi-project state). Projects are added via folder picker, listed in the sidebar, and switched by clicking. The project list and last-active project are persisted in `electron-store`. Switching projects reloads config, rescans tasks, and resets agent state. See the [Project Management](#project-management) section for full details.

8. **Global vs local config in GUI:** The GUI introduces a third config layer on top of the CLI's existing two. Precedence (highest to lowest):
   1. **GUI per-project overrides** -- stored in `electron-store` keyed by project path. Desktop-app-only; not written to `.ody/ody.json`. Takes highest priority so the GUI can override any value without modifying files on disk that the CLI also reads.
   2. **Local** `.ody/ody.json` -- per-project config file, shared with the CLI.
   3. **Global** `~/.ody/ody.json` -- user-wide defaults, shared with the CLI.

   All three layers are merged and displayed as a single form in the Config View. Each field shows a source indicator (`(gui)`, `(local)`, `(global)`, or `(default)`) so the user understands where each value originates. The user can save changes to either the GUI layer (project-specific, desktop-only) or the global layer (affects CLI too). A "Reset GUI Overrides" button clears all GUI-layer values for the active project. See the [Config View](#config-view) section for the full wireframe.

   **Implementation in `@ody/shared`:** The existing `Config.load()` returns the two-layer merge (global + local). The GUI layer is handled entirely in the Electron main process -- it loads the merged config from `@ody/shared`, then applies GUI overrides on top from `electron-store`. This means `@ody/shared` does not need to know about the GUI layer.
