# Task Archive

Generated: 2026-02-24T06:48:45.252Z

Total tasks archived: 37

---

## Opencode Model Selection via `opencode models` During Init

**Completed:** 2026-02-21

When the user runs `ody init` and selects `opencode` as their backend, instead of presenting a free-form `text` prompt for the model, call the `opencode models` CLI command, parse its output into a list of available model IDs, and present an `autocomplete` prompt so the user can search and select one.  If the command fails or returns no models, fall back gracefully to the existing free-form `text` prompt.

---

## Extract @internal/auth Package

**Completed:** 2026-02-22

Extract the credential store logic for Jira and GitHub authentication from `@ody/cli` into a new `@internal/auth` workspace package.  This is a leaf package with no internal dependencies, managing named profiles stored in `$XDG_DATA_HOME/ody/auth. json`.

---

## Extract @internal/backends Package

**Completed:** 2026-02-22

Extract the backend harness abstraction, concrete backend implementations (Claude, OpenCode, Codex), and backend detection utilities from `@ody/cli` into a new `@internal/backends` workspace package.  The key refactor is replacing `Bun. which()` with a Node.

---

## Extract @internal/builders Package

**Completed:** 2026-02-22

Extract all prompt template builders from `@ody/cli` into a new `@internal/builders` workspace package.  This includes run, plan, batch plan, edit plan, and import prompt builders.  Additionally, create a new `buildInlineEditPrompt()` builder for the desktop editor's Cmd+K AI edit flow.

---

## Extract @internal/config Package

**Completed:** 2026-02-22

Extract the config loading, parsing, validation, constants, and sequencer logic from `@ody/cli` into a new `@internal/config` workspace package.  This package must be runtime-compatible with both Bun (for CLI) and Node. js (for Electron main process), so all Bun-specific APIs must be removed.

---

## Extract @internal/integrations Package

**Completed:** 2026-02-22

Extract Jira and GitHub API clients plus shared HTTP retry utilities from `@ody/cli` into a new `@internal/integrations` workspace package.  These modules already use standard `fetch` and are compatible with both Bun and Node. js runtimes, requiring no API changes.

---

## Extract @internal/tasks Package

**Completed:** 2026-02-22

Extract task file utilities (parsing, listing, filtering, status management) from `@ody/cli` into a new `@internal/tasks` workspace package.  This requires replacing Bun-specific APIs (`Bun. Glob`, `Bun.

---

## Implement Agent Run View UI

**Completed:** 2026-02-22

Build the Run View panel in the renderer that displays agent execution controls, streaming output, iteration progress, and the collapsible progress notes viewer.  This is the primary interface for monitoring and controlling agent runs.

---

## Implement Agent Runner (Process Spawning + Streaming)

**Completed:** 2026-02-22

Implement the `AgentRunner` class in the Electron main process that handles spawning agent processes, streaming output to the renderer, detecting completion markers, handling ambiguous markers, performing post-run task verification, and managing the agent lifecycle (start, stop, graceful/force termination).

---

## Implement App Layout Shell (Title Bar, Sidebar, Status Bar)

**Completed:** 2026-02-22

Build the main application layout shell including the custom title bar, sidebar with project list and navigation views, the main content area with page header pattern, and the persistent status bar.  This establishes the visual frame for all subsequent feature views.

---

## Implement Auth Management Panel

**Completed:** 2026-02-22

Build the Auth Management panel with tabs for Jira and GitHub credential management, including profile CRUD operations, masked token display, and active profile indicators.  Wire the auth IPC handlers to delegate to `@internal/auth`.

---

## Implement Build and Distribution Pipeline

**Completed:** 2026-02-22

Configure Electron Forge for production builds targeting macOS (DMG), Windows (Squirrel), and Linux (Deb).  Add app icon and branding, set up the auto-updater with GitHub Releases, and verify the app can be packaged and distributed on all target platforms.

---

## Implement Editor AI Integration (Cmd+K Inline Prompt + Diff Review)

**Completed:** 2026-02-22

Add the AI-powered inline editing flow to the Task Editor: Cmd+K triggers a floating prompt input, the agent edits the file, and the result is shown in a side-by-side diff view using `@codemirror/merge`.  Users can accept or reject the proposed changes.

---

## Implement IPC Layer and Preload Script

**Completed:** 2026-02-22

Implement the complete typed IPC contract between the Electron main process and renderer, including the preload script that exposes the `window. ody` API via `contextBridge`, IPC handler registration in the main process, and TypeScript type definitions shared between both sides.

---

## Implement Native Menu Bar and Keyboard Shortcuts

**Completed:** 2026-02-22

Add the native application menu bar (File, Edit, View, Help menus) and global keyboard shortcuts for common actions.  This includes platform-appropriate menu items, accelerators, and integration with existing features.

---

## Implement Notification System (OS + Toast)

**Completed:** 2026-02-22

Implement both the OS-level notification system using Electron's `Notification` API and the in-app toast notification system using `sonner` (via shadcn's `<Sonner>` component).  The OS notifications fire on agent completion based on config, while toasts provide immediate UI feedback for user actions.

---

## Implement Plan Operations (New, Batch, Compact, Archive)

**Completed:** 2026-02-22

Build the Plan view with sub-tabs for creating single plans, batch-generating tasks from planning documents, and the archive functionality for compacting completed tasks.  This includes the Plan Creator UI, file picker for batch mode, streaming preview, and the archive viewer.

---

## Implement Loading States, Error Boundaries, and Empty States

**Completed:** 2026-02-22

Add comprehensive loading states, React error boundaries, and empty state screens throughout the application.  This polishing pass ensures a professional user experience when data is loading, when errors occur, or when sections have no content.

---

## Implement Project Management (Add, Switch, Remove)

**Completed:** 2026-02-22

Implement the project management system allowing users to add project folders, switch between projects, and remove projects from the list.  This includes the sidebar project list, native folder picker dialog, project context menu, persistence via `electron-store`, and the welcome screen for first-launch.

---

## Implement PTY Terminal Mode (xterm.js + node-pty)

**Completed:** 2026-02-22

Implement the interactive terminal mode using `node-pty` in the main process and `xterm. js` in the renderer.  This provides the PTY-based terminal experience for `--once` equivalent runs and interactive task editing (`ody task edit`), with bidirectional I/O and resize support.

---

## Implement Settings Modal

**Completed:** 2026-02-22

Build the Settings modal accessible from the title bar, providing quick access to the most common configuration fields through a tabbed interface (General, Backend, Validators).  This is separate from the full Config View in the sidebar.

---

## Implement Task Board (Kanban View)

**Completed:** 2026-02-22

Build the Task Board view showing tasks in a kanban-style layout with three columns (Pending, In Progress, Completed).  Each task is displayed as a card with title, description excerpt, labels, complexity, and action buttons.  The board supports label filtering and includes toolbar actions.

---

## Implement Task Editor with CodeMirror 6

**Completed:** 2026-02-22

Build the Task Editor view powered by CodeMirror 6 with markdown syntax highlighting, manual editing support, save/undo/redo toolbar, and file persistence via IPC.  This is the base editing experience before AI integration is added.

---

## Implement Task Import from Jira/GitHub

**Completed:** 2026-02-22

Build the Task Import panel that fetches Jira tickets or GitHub issues, previews the formatted data, and spawns an agent to generate `. code-task. md` files from external sources.

---

## Implement Theme System (Light/Dark Mode + OS Sync)

**Completed:** 2026-02-22

Implement the complete theme system supporting light mode, dark mode, and automatic OS preference detection.  This includes main process theme detection via `nativeTheme`, IPC handlers for theme get/set, renderer-side class toggling, CSS variable switching for shadcn components, and persistence of user preference.

---

## Implement Zustand State Management Store

**Completed:** 2026-02-22

Set up the Zustand store with slices for project management, configuration, tasks, agent state, and authentication.  This provides the centralized state management layer that all React components and hooks will consume.

---

## Scaffold Electron Desktop App Package

**Completed:** 2026-02-22

Create the `@ody/desktop` package under `packages/desktop/` with Electron Forge + Vite + React.  Set up the main process entry, preload script, renderer entry, and Forge/Vite configuration files.  Verify the app launches a blank Electron window and that `@internal/*` packages can be imported in the main process.

---

## Set Up Tailwind v4 + shadcn/ui + Art Deco Design System

**Completed:** 2026-02-22

Configure Tailwind CSS v4 with the CSS-first approach, set up shadcn/ui with the Art Deco design system, and install foundational UI components.  This establishes the complete visual foundation for the desktop app including the three-layer CSS variable architecture, custom fonts, animations, and scrollbar styling.

---

## Update @ody/cli to Import from @internal/* Packages

**Completed:** 2026-02-22

Refactor `@ody/cli` to import shared logic from `@internal/*` workspace packages instead of local paths.  This completes the extraction phase by wiring the CLI to consume the newly created internal packages, ensuring nothing is broken and the CLI builds and runs correctly.

---

## Update Workspace Structure for Internal Packages

**Completed:** 2026-02-22

Restructure the Bun monorepo workspace configuration to support a new `internal/*` directory alongside the existing `packages/*`.  This is the foundational change that enables all subsequent `@internal/*` package extractions.

---

## Add Collapsible Label Filter Sections

**Completed:** 2026-02-23

The label filter pill bars in the desktop app (TaskBoard and AgentRunner) currently display every available label as a flat, always-visible horizontal row.  When a project accumulates many labels this becomes visually overwhelming.  Wrap each label list in a collapsible section that is collapsed by default, so users can expand it on demand to select a filter and the UI stays clean otherwise.

---

## Add Scroll Area to Task Board Columns

**Completed:** 2026-02-23

The task board columns (Pending, In Progress, Completed) do not scroll vertically when they contain more task cards than can fit in the visible area.  The card list container uses a plain `overflow-auto` div with no explicit height constraint or custom scrollbar styling, meaning content overflows without a usable scrolling experience.  This task replaces the plain overflow div with a Base UI Scroll Area component, providing consistent custom scrollbars and a polished scroll experience across all platforms.

---

## Fix Backend Detection Without Shell Commands

**Completed:** 2026-02-23

Replace shell-based backend binary detection in `@internal/backends` with an in-process PATH scan so backend availability does not depend on external `which`/`where` commands.  This prevents false negatives in constrained environments while preserving current behavior and public APIs.

---

## Improve Active Tab Indicator Visibility

**Completed:** 2026-02-23

The tabs component in the desktop app lacks a clear visual indicator for the currently active tab.  Users cannot easily distinguish which tab is selected at a glance.  The active state needs stronger visual differentiation through improved contrast, color, and/or structural cues so that the selected tab is immediately obvious.

---

## Migrate Desktop App from shadcn/ui to Base UI

**Completed:** 2026-02-23

Replace all shadcn/ui components in the `packages/desktop` Electron app with equivalent [Base UI](https://base-ui. com/) components.  shadcn/ui wraps Radix primitives with opinionated Tailwind styles and copy-paste source files, while Base UI provides unstyled, accessible React primitives (built by the teams behind Radix, Floating UI, and Material UI) that are styled directly via Tailwind utility classes without a code-generation CLI.

---

## Add "Edit as JSON" Button to Config Page

**Completed:** 2026-02-24

Add an "Edit as JSON" button to the desktop ConfigPanel that opens the local project configuration file (`. ody/ody. json`) in the existing CodeMirror-based editor.

---

## Implement Config Panel and Init Wizard

**Completed:** 2026-02-24

Build the Configuration view panel (three-layer config display with inline editing) and the Init Wizard (stepped form for first-time setup).  The Config panel shows all config values from merged layers with source indicators, while the Init Wizard provides guided initial configuration.

---

