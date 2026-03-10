# Task Archive

Generated: 2026-03-10T17:45:28.298Z

Total tasks archived: 57

---

## Add Close X Button to All Dialogs

**Completed:** 2026-02-24

All dialog windows in the desktop app should display a close "X" button in the top-right corner, giving users a clear and consistent way to dismiss any dialog.  Currently, nearly every dialog explicitly suppresses this button by passing `showCloseButton={false}`, even though the underlying `DialogContent` component already supports rendering one via the `showCloseButton` prop.

---

## Add Task Detail Dialog on Card Click

**Completed:** 2026-02-24

Add a dialog to the tasks page that displays the full task details when a user clicks on a task card.  Currently, task cards show a summary (title, truncated description, labels, complexity, date) but there is no way to view the complete task content — including the full description, background, technical requirements, implementation approach, acceptance criteria, and metadata — without opening the editor.  Clicking anywhere on the card body (outside of the existing Run/Edit/Del action buttons) should open a read-only detail dialog.

---

## Collapsible Sidebar with Icon-Only Mode and Keyboard Shortcut

**Completed:** 2026-02-24

Make the main sidebar collapsible so it can toggle between its full-width state (showing icons + labels + project names) and a narrow icon-only state.  When collapsed, navigation items should display only their Lucide icon, and project names should be truncated with ellipsis if they exceed the available width.  The toggle should be triggerable via a keyboard shortcut (`Cmd+[` on macOS, `Ctrl+[` on Windows/Linux) as well as a visible UI toggle button.

---

## Fix Archive Viewer to Read from .ody/history with Date-Grouped Display

**Completed:** 2026-02-24

The desktop Archive view does not display archived files because it reads from `. ody/archives/` while the CLI `ody compact` command writes archives to `. ody/history/`.

---

## Fix Editor Cursor Reset on Every Keystroke

**Completed:** 2026-02-24

The CodeMirror-based task editor resets the cursor position to the start of the file on every keystroke.  This makes the editor effectively unusable for editing task files, as the user cannot maintain their position while typing.  The root cause is that unstable callback references in the parent component cause the CodeMirror initialization `useEffect` to destroy and recreate the editor view on every render cycle.

---

## Fix Task Board Label Filter Not Filtering Displayed Tasks

**Completed:** 2026-02-24

Selecting filter labels on the Tasks page of the desktop app visually highlights the selected label but does not actually filter the displayed tasks.  The `TaskBoard` component reads the raw unfiltered `tasks` array from the `useTasks` hook instead of the `filteredTasks` computed value, causing the label filter state to be written to the Zustand store but never consumed for rendering.

---

## Move Generation Output to Right Column and Remove Pending Tasks List

**Completed:** 2026-02-24

Restructure the plan page layout by removing the `PlanList` component (pending tasks list) from the right column and relocating the "Generation output" box from within `PlanCreator` to occupy the right column in its place.  This gives the generation output more dedicated screen real estate and removes a panel that duplicates information already available on the task board.

---

## Parse ANSI in Plan Generation Output Panels

**Completed:** 2026-02-24

The plan page's "Generation output" panel currently renders raw process output in a plain `<pre>`, which exposes ANSI escape fragments like `[0m` instead of showing clean or styled text.  Implement ANSI parsing for these log-style panels by extracting the existing converter logic into a shared renderer utility and reusing it across generation-output surfaces.

---

## Remove PTY Sessions and node-pty Dependency

**Completed:** 2026-02-24

Remove all PTY session functionality and the `node-pty` native dependency from the codebase.  The PTY-based terminal feature in the desktop app will be evaluated again later, so this is a clean removal rather than a refactor.  The goal is to eliminate the native addon dependency, simplify the build pipeline, and remove dead code paths that depend on PTY.

---

## Replace CodeMirror with Rendered Markdown Editor

**Completed:** 2026-02-24

Replace the current CodeMirror-based raw source editing on the task edit page with a rich-text/WYSIWYG markdown editor that displays rendered markdown content.  Users should edit the visually rendered output (headings, bold, lists, etc. ) rather than raw markdown syntax.

---

## Replace Project Switcher with Base UI Dropdown Menu

**Completed:** 2026-02-24

Replace the current sidebar project list (a vertical stack of buttons with a hand-rolled context menu) with a single Base UI dropdown menu.  The dropdown trigger displays the active project name and, when opened, lists all projects with options to switch, copy path, remove, or add a new project.  This consolidates the project switching UI into a compact, consistent control that works identically in both expanded and collapsed sidebar modes.

---

## Replace Run Page Task Selector with Base UI Select

**Completed:** 2026-02-24

Replace the native HTML `<select>` element used for task selection on the Agent Runner (run) page with the project's existing Base UI `Select` component from `@/components/ui/select`.  This brings the task selector in line with the rest of the UI, which has already been migrated to Base UI primitives, improving visual consistency and accessibility.

---

## Rewrite RichMarkdownEditor with @milkdown/react Bindings

**Completed:** 2026-02-24

The `RichMarkdownEditor` component currently uses the vanilla Milkdown API (`Editor. make()`) inside a `useEffect` with an async IIFE, manual lifecycle management, and several imperative `view. setProps()` calls for keyboard handlers and dispatch interception.

---

## Skip Run Dialog When Running a Single Task from the Task Board

**Completed:** 2026-02-24

When a user clicks the "Run" button on an individual task card in the Task Board, the agent should start immediately without showing the run confirmation dialog.  The dialog adds unnecessary friction for single-task runs where the user has already made an explicit choice about which task to execute.  The run dialog should still appear in other contexts (e.

---

## Wire "New Task" Button to Navigate to Plan View

**Completed:** 2026-02-24

The global "New Task" button in the top header bar of the Layout component currently has no click handler and does nothing when clicked.  It should navigate the user to the Plan view so they can create a new plan, which is the entry point for generating tasks.

---

## Wrap Generation Output in Scroll Area

**Completed:** 2026-02-24

Replace the native `overflow-auto` scrolling on the `<pre>` element in the `GenerationOutput` component with the project's `ScrollArea` component.  This will contain the generation output within its panel and prevent it from extending the page's height, while providing a styled, consistent scrollbar that matches the rest of the application's scroll behavior (e. g.

---

## Add TanStack Router Vite Plugin

**Completed:** 2026-02-25

Configure the `@tanstack/router-plugin` Vite plugin in `vite. renderer. config.

---

## Create Config Editor Route with Search Params

**Completed:** 2026-02-25

Create `src/renderer/routes/config-editor. tsx` for the `/config-editor` route.  This route renders `<ConfigEditor>` and uses a required `path` search param to identify which config file to edit.

---

## Create Editor Route with Search Params

**Completed:** 2026-02-25

Create `src/renderer/routes/editor. tsx` for the `/editor` route.  This route renders `<TaskEditor>` and uses a required `taskPath` search param to identify which task file to edit.

---

## Create Index Redirect Route

**Completed:** 2026-02-25

Create `src/renderer/routes/index. tsx` that redirects the root path (`/`) to `/tasks`.  This ensures the app always lands on the tasks view when first loaded or when the hash is empty.

---

## Create Root Route Layout (__root.tsx)

**Completed:** 2026-02-25

Create `src/renderer/routes/__root. tsx` which serves as the root layout for the entire application.  This file extracts the outer shell from the current `Layout.

---

## Create Router Instance with Hash History

**Completed:** 2026-02-25

Create the central router instance at `src/renderer/router. ts` using `createHashHistory` and `createRouter` from `@tanstack/react-router`.  This module-level singleton is imported by `App.

---

## Create Simple View Route Files

**Completed:** 2026-02-25

Create route files for the six views that don't require search params: `/run`, `/plan`, `/import`, `/config`, `/auth`, and `/archive`.  Each route file maps a path to its existing view component wrapped in an `<ErrorBoundary>`.

---

## Create Tasks Route with Search Params

**Completed:** 2026-02-25

Create `src/renderer/routes/tasks. tsx` for the `/tasks` route.  This route renders `<TaskBoard>` and uses validated search params (`label` and `status`) to replace the `labelFilter` and `statusFilter` state that currently lives in the Zustand `ViewSlice`.

---

## Delete Layout.tsx and Finalize Migration Cleanup

**Completed:** 2026-02-25

Delete the now-obsolete `Layout. tsx` component and perform a final cleanup pass across the codebase.  All Layout.

---

## Install TanStack Router Dependencies

**Completed:** 2026-02-25

Add `@tanstack/react-router`, `@tanstack/react-router-with-query`, `@tanstack/router-plugin`, and `@tanstack/router-devtools` to the desktop package.  This is the foundational step that enables all subsequent routing work.

---

## Migrate Navigation Triggers to Router Navigation

**Completed:** 2026-02-25

Update all remaining navigation triggers across the application to use `useNavigate()` or the `router` singleton instead of `setActiveView()` and Zustand state mutations.  This covers Electron IPC menu actions, custom DOM events, cross-component callback props, and filter changes.

---

## Migrate Sidebar to Use TanStack Router Links

**Completed:** 2026-02-25

Update `Sidebar. tsx` to use TanStack Router's `<Link>` component with `activeProps`/`inactiveProps` instead of callback-based `onClick` handlers and the `activeView` prop for highlighting.  This eliminates the need for the parent to pass `activeView` and `onViewSelect` — the sidebar becomes self-aware of routing state.

---

## Remove Zustand ViewSlice and Clean Up Store

**Completed:** 2026-02-25

Delete the `ViewSlice` from the Zustand store since all its state (`labelFilter`, `statusFilter`, `selectedTaskPath`, `configEditorPath`) has been migrated to route search params.  Update the combined `AppStore` type and `useStore` creation to remove the slice.

---

## Hybrid migration — @tanstack/react-query for server state, Zustand for client state

**Completed:** 2026-02-25

Introduce `@tanstack/react-query` in the `@ody/desktop` Electron renderer to manage all server-derived state (data fetched from the Electron main process via IPC), while keeping Zustand for client-only and event-driven state.  The current Zustand store is essentially a hand-rolled cache of IPC data with manual `isLoading` booleans and try/catch error handling — exactly the problem React Query solves.  Four of six slices (Project, Config, Task, Auth) will be replaced by React Query queries and mutations.

---

## Update App.tsx Entry Point with RouterProvider

**Completed:** 2026-02-25

Replace the `<Layout />` component in `App. tsx` with `<RouterProvider router={router} />` from `@tanstack/react-router`.  This wires the entire application to use the router for view rendering.

---

## Add Change Detection Job to Release Workflow

**Completed:** 2026-02-27

Add a `detect-changes` job to `. github/workflows/release. yml` that determines whether CLI and/or desktop release lanes should run based on which files were modified in the merged release PR.

---

## Add Desktop GitHub Release Publishing Job

**Completed:** 2026-02-27

Add a `release-desktop` job to `. github/workflows/release. yml` that creates a GitHub Release for the desktop app, tagged with `desktop-vX.

---

## Add Desktop Tag Creation Job to Release Workflow

**Completed:** 2026-02-27

Add a `tag-desktop` job to `. github/workflows/release. yml` that creates a `desktop-vX.

---

## Add Desktop Version Bump Input to Prepare Release Workflow

**Completed:** 2026-02-27

Extend `. github/workflows/prepare-release. yml` to accept an optional `desktop_bump` input so that release PRs can carry desktop version updates alongside CLI version bumps.

---

## Add macOS Desktop Build Job to Release Workflow

**Completed:** 2026-02-27

Add a `build-desktop` job to `. github/workflows/release. yml` that builds the Electron desktop application on `macos-latest` using Electron Forge and uploads the resulting installer artifacts (DMG) for the downstream release publishing job.

---

## Refactor CLI Release Jobs with Conditional Gates

**Completed:** 2026-02-27

Refactor the existing `tag`, `build`, and `release` jobs in `release. yml` to depend on the new `detect-changes` job and only run when CLI-impacting changes are detected.  The jobs should be renamed to `tag-cli`, `build-cli`, and `release-cli` for clarity alongside the new desktop lane.

---

## Render Full Markdown in Task Detail Dialog

**Completed:** 2026-03-05

Replace the hand-rolled plain-text parser in `TaskDetailDialog` with a proper markdown rendering solution so the task detail dialog displays fully rendered markdown — including inline formatting (bold, italic, code), code blocks, links, nested lists, blockquotes, and tables — instead of the current limited plain-text approximation.

---

## Add Global Run Control To Desktop Header

**Completed:** 2026-03-06

Implement a global `Run` control in the Desktop application's top-level header that starts the agent for the active project in continuous mode.  While the agent is running, the header control should switch to `Stop`.  If the run ends because there are no remaining tasks to execute, the app should stop the loop and show a toast notification so the user understands why execution ended.

---

## Compare CLI Update Versions Semantically Instead of by String Equality

**Completed:** 2026-03-06

The CLI update check currently decides whether an update is needed by testing whether the current and latest version strings are different.  Replace this with semantic version comparison so newer local builds, prereleases, and equal normalized versions are handled correctly and `ody update` does not offer a downgrade or false-positive update.

---

## Fix CLI Entrypoint to Preserve Failure Exit Codes

**Completed:** 2026-03-06

The CLI entrypoint currently logs top-level errors and then always exits with status code `0`, which causes failed commands to appear successful to shells, scripts, and CI.  Update the entrypoint so successful runs still exit cleanly, but setup failures, command parsing errors, and uncaught runtime errors preserve a non-zero exit status.

---

## Fix `ody update` Reporting Success After Failed Install Attempts

**Completed:** 2026-03-06

The `ody update` command currently logs an installation failure but then continues into the success path, printing `Updated to ... ` and `Update complete` even when the update did not succeed.  Fix the command flow so a failed install produces a clear failure result and a non-zero process status without emitting contradictory success messages.

---

## Handle `ody init` Prompt Cancellation Without Persisting Invalid Values

**Completed:** 2026-03-06

The interactive `ody init` flow currently converts some cancelled prompt results to strings without checking `isCancel()`, which can persist cancellation sentinel values into the generated config.  Fix prompt handling so cancellation exits cleanly and no invalid `model` or `agent` values are written to `. ody/ody.

---

## Harden `plan` and `task import` Completion Validation

**Completed:** 2026-03-06

The `plan` and `task import` commands currently treat detection of `<woof>COMPLETE</woof>` as sufficient success, even though they kill the backend process immediately afterward and do not validate the final exit status or stream-processing outcome.  Tighten these flows so they only report success when the command finished in a verifiably healthy way and so ambiguous or partial completion markers do not produce false positives.

---

## Hydrate Agent State on Desktop Load

**Completed:** 2026-03-06

When the desktop app loads (or the renderer reloads), the UI has no way to learn whether an agent is already running.  The Zustand agent store initializes `isRunning: false`, and the only updates come from push events (`agent:started`, `agent:complete`, `agent:stopped`).  If the renderer wasn't mounted when those events fired, the Run/Stop button in the header, the footer status dot, and the sidebar indicator all show "idle" even though an agent process is active in the main process.

---

## Make Desktop Graceful Stop Actually Interrupt the Current Agent Run

**Completed:** 2026-03-06

The desktop app exposes “graceful” and “force” stop modes for agent runs, but the graceful path does not actually signal the current backend process.  Fix the stop behavior so the graceful option meaningfully interrupts or requests shutdown of the active iteration instead of merely preventing the next loop from starting.

---

## Remove Render-Phase State Updates from Desktop Views

**Completed:** 2026-03-06

Some desktop React components currently call state setters during render, which is a React antipattern and can lead to unstable rerender behavior, warnings, or accidental render loops.  Refactor these flows so state is updated from effects, event handlers, or derived rendering logic instead of inside the render body.

---

## Restrict Desktop IPC File Access to the Active Project Task Boundaries

**Completed:** 2026-03-06

Several Electron IPC handlers in the desktop app trust arbitrary file paths from the renderer whenever the path string contains a slash.  Tighten these handlers so reads, writes, snapshots, and deletions are constrained to the active project’s intended task file boundaries instead of allowing arbitrary filesystem access through the preload bridge.

---

## Stop Active Agent Runs Before Switching Projects in Desktop

**Completed:** 2026-03-06

The desktop app currently allows switching to a different project while an agent run is active, but it only resets renderer-side state and does not stop the underlying backend process in the main process.  Fix project switching so the old run is explicitly stopped or blocked before the active project changes, preventing hidden background mutations against the previous project.

---

## Wire or Remove the No-Op Auto-Commit Toggle in Desktop Agent Runner

**Completed:** 2026-03-06

The desktop Agent Runner exposes an “Auto-commit after run” switch in its confirmation dialog, but the selected value is never used to change run behavior.  Fix this false-control UI by either wiring the toggle into real run configuration or removing it from the dialog.

---

## Allow Interactive Plan Mode to Create Multiple Task Files

**Completed:** 2026-03-09

The `ody plan -i` interactive mode is currently restricted to creating exactly one `. code-task. md` file per session.

---

## Improve Task Detail Dialog Body Text Readability

**Completed:** 2026-03-09

The body text in the task detail dialog is hard to read in dark mode.  The combination of `text-mid` color (`#9496ac`) and `text-xs` (12px) font size produces low-contrast, small text that strains readability for the content-heavy markdown view.  Bump the color to `text-light` and the size to `text-sm` so the dialog content is comfortable to read.

---

## Rename `shouldCommit` Config Property to `autoCommit`

**Completed:** 2026-03-09

Rename the `shouldCommit` configuration property to `autoCommit` across the entire codebase — schema, CLI flag, desktop UI, prompt builders, documentation, and config files.  The old `shouldCommit` key must still be accepted in JSON config files during a deprecation period, with a warning logged to guide users toward the new name.

---

## Replace TaskBoard Filters with Multi-Select Autocomplete

**Completed:** 2026-03-09

Convert the label and status filters on the task board page from horizontal pill-button toggles to multi-select autocomplete (combobox) inputs.  This improves usability when there are many labels, and lets users combine multiple filter values to narrow down tasks more precisely.

---

## Make Plan Command Interactive by Default

**Completed:** 2026-03-10

Invert the plan command's default behavior so that running `ody plan` (with no flags and no positional argument) launches the agent interactively — the way `-i` / `--interactive` works today.  Add a new `--yolo` flag that triggers the current default behavior (collect descriptions via the clack TUI, then run the agent non-interactively in the background).  Remove the `-i` / `--interactive` flag entirely.

---

## Prompt for Another Interactive Plan After Generation

**Completed:** 2026-03-10

Update the `ody plan --interactive` CLI flow so that after the interactive planning session completes and new `. code-task. md` file(s) have been created, the user is prompted to start another interactive plan instead of the command exiting immediately.

---

## Replace "New Task" Header Action with Repositioned "Run" Button

**Completed:** 2026-03-10

Remove the "New Task" button from the desktop header action bar and reposition the existing "Run" button to sit immediately to the right of the "Refresh" button.  This simplifies the header by removing the plan navigation shortcut and gives the Run/Stop toggle a more natural placement next to the Refresh action.

---

