# Progress Log

Generated: 2026-03-10T17:45:28.298Z

---

2026-02-24 | parse-ansi-in-generation-output | Completed
  - Extracted ANSI conversion logic (COLOR_MAP, escapeHtml, toAnsiHtml) from AgentOutput.tsx into shared utility at renderer/lib/ansi.ts
  - Added stripAnsi helper for plain-text stripping of ANSI codes
  - Refactored AgentOutput.tsx to import toAnsiHtml from shared module (no behavior change)
  - Updated PlanCreator.tsx generation output to render ANSI-parsed HTML via dangerouslySetInnerHTML
  - Updated TaskImport.tsx generation output with same ANSI parsing approach
  - Cleaned TaskBoard.tsx outputPreview with stripAnsi to prevent escape codes in TaskCard live preview
  - All validation passing: lint (0 warnings/errors), fmt, typecheck

2026-02-24 | replace-run-page-task-selector-with-base-ui-select | Completed
  - Replaced native HTML <select> in AgentRunner.tsx (lines 236-249) with Base UI Select components from @/components/ui/select
  - Added imports for Select, SelectContent, SelectItem, SelectTrigger, SelectValue
  - Used controlled value/onValueChange pattern matching existing ConfigPanel.tsx usage
  - Preserved "Run current task filter" default option as SelectItem with empty string value
  - SelectTrigger uses size="sm" and w-full to match previous styling
  - All pending tasks render as SelectItem entries with task.filePath values
  - All validation passing: lint (0 warnings/errors), fmt, typecheck (all packages exit 0)

2026-02-24 | wrap-generation-output-in-scroll-area | Completed
  - Replaced native overflow-auto scrolling on <pre> in GenerationOutput.tsx with ScrollArea component hierarchy
  - Imported ScrollArea, ScrollAreaViewport, ScrollAreaContent, ScrollAreaScrollbar, ScrollAreaThumb from @/components/ui/scroll-area
  - Wrapped both conditional <pre> branches (ANSI output and placeholder) inside ScrollArea > ScrollAreaViewport > ScrollAreaContent
  - ScrollArea root uses min-h-0 flex-1 to fill remaining vertical space in the flex-col section (matching TaskBoard pattern)
  - Removed flex-1 and overflow-auto from <pre> elements, added min-h-full for short content fill
  - Added vertical ScrollAreaScrollbar with ScrollAreaThumb for styled scrollbar appearance
  - All validation passing: lint (0 warnings/errors), fmt, typecheck (all packages exit 0)

2026-02-24 | fix-editor-cursor-reset-on-keystroke | Completed
  - Root cause: CodeMirror init useEffect depended on unstable callback props (onChange, onInlinePrompt, syncHistory), causing editor destroy/recreate on every keystroke
  - Stored onChange, onInlinePrompt, onHistoryChange callbacks in useRef holders; CodeMirror extensions now read from refs instead of closing over props
  - Removed unstable dependencies from init useEffect; now only depends on `language` (static per session)
  - Added keymapCompartment for the Cmd+K binding so it reads onInlinePromptRef.current
  - updateListener reads onChangeRef.current and onHistoryChangeRef.current for stable closures
  - Removed useCallback wrapper from syncHistory; it now reads directly from onHistoryChangeRef
  - Memoized onInlinePrompt and onHistoryChange handlers in TaskEditor.tsx with useCallback as defense-in-depth
  - Existing value-sync, readOnly, and highlightedRange useEffects unchanged (already correct)
  - All validation passing: lint (0 warnings/errors), fmt, typecheck (all packages exit 0)

2026-02-24 | fix-task-board-label-filter | Completed
  - Bug: TaskBoard used raw `tasks` array instead of `filteredTasks` from useTasks hook, so label filter state was written to Zustand store but never consumed for rendering
  - Added `filteredTasks` to the destructured return from `useTasks()` in TaskBoard.tsx
  - Changed `filteredBySearch` memo to use `filteredTasks` as its base instead of `tasks`, so label filtering is applied before text search
  - `uniqueLabels` still derives from full `tasks` array so all labels remain visible in filter UI regardless of active filter
  - All validation passing: lint (0 warnings/errors), fmt, typecheck (all packages exit 0)

2026-02-24 | fix-archive-viewer-history-directory | Completed
  - Renamed resolveArchivesDirPath to resolveHistoryDirPath, pointing to .ody/history instead of .ody/archives
  - Redesigned ArchiveEntry type to support date-grouped archives with separate tasks/progress/legacy file slots
  - Rewrote archive:list IPC handler to traverse date-stamped subdirectories (YYYY-MM-DD/) and legacy flat .md files
  - Updated parseTaskCountFromArchive to support CLI format ("Total tasks archived: N") alongside desktop legacy format
  - Rewrote archive:compact handler to write to .ody/history/YYYY-MM-DD/ with separate tasks.md and progress.md matching CLI format
  - Redesigned ArchiveViewer.tsx to render date-grouped cards with separate Tasks/Progress toggle sections per date
  - All validation passing: lint (0 warnings/errors), fmt, typecheck (all packages exit 0)

2026-02-24 | wire-new-task-button-to-plan-view | Completed
  - Added onClick handler to the "New Task" button in Layout.tsx (line 408) that calls setActiveView('plan')
  - Consistent with existing navigation patterns: sidebar, Electron menu (CmdOrCtrl+N), TaskBoard empty state onOpenPlan
  - All validation passing: lint (0 warnings/errors), fmt, typecheck (all packages exit 0)

2026-02-24 | add-task-detail-dialog | Completed
  - Added optional onClick prop to TaskCard with stopPropagation on Run, Edit, Del, and Stop action buttons
  - Created TaskDetailDialog component at renderer/components/TaskDetailDialog.tsx
  - Dialog fetches full task markdown via readTask(filePath) from useTasks hook, shows loading spinner while fetching
  - Parses markdown into sections (strips YAML frontmatter, splits on ## headings) and renders with styled headings, lists, paragraphs
  - Displays task title in DialogTitle, status badge in header, labels/complexity/dates in metadata strip
  - Uses max-w-2xl width, ScrollArea with max-h-[70vh] for scrollable content, bg-panel border-edge styling
  - Footer includes Close button and Edit button that calls onOpenEditor and closes the dialog
  - Added detailTarget state (TaskSummary | null) in TaskBoard.tsx following existing runTarget/deleteTarget pattern
  - Handles error state if readTask fails, clears state on dialog close
  - All validation passing: lint (0 warnings/errors), fmt, typecheck (all packages exit 0)

2026-02-24 | collapsible-sidebar-with-keybind | Completed
  - Created UISlice in store/slices/uiSlice.ts with sidebarCollapsed boolean, toggleSidebar action, and localStorage persistence
  - Wired UISlice into combined Zustand store (store/index.ts) as part of AppStore type
  - Created lightweight Tooltip component (ui/tooltip.tsx) for hover tooltips since @base-ui/react has no tooltip primitive
  - Refactored Sidebar.tsx to accept collapsed/onToggle props; conditionally renders icon-only mode vs full-width mode
  - In collapsed mode: nav items show only icons with tooltips, projects show single-char avatars with tooltips, status section shows compact icons
  - In expanded mode: project names truncate with ellipsis, full labels visible
  - Added ChevronsLeft/ChevronsRight toggle button at sidebar bottom
  - Sidebar animates between w-56 (224px) and w-14 (56px) via transition-all duration-200
  - Added Cmd+[ / Ctrl+[ keyboard shortcut in Layout.tsx to toggle sidebar
  - Layout.tsx consumes sidebarCollapsed and toggleSidebar from Zustand store, passes to Sidebar
  - Collapsed state persists via localStorage across view changes and app restarts
  - All validation passing: lint (0 warnings/errors), fmt, typecheck (all packages exit 0)

2026-02-24 | add-close-button-to-dialogs | Completed
  - Removed showCloseButton={false} from all 10 DialogContent instances across 7 files
  - Files updated: TaskDetailDialog.tsx, Layout.tsx, TaskBoard.tsx (3), TaskEditor.tsx, AgentRunner.tsx (2), ConfigEditor.tsx, SettingsModal.tsx
  - Added pr-6 padding to TaskDetailDialog header and SettingsModal header to prevent overlap with close button
  - InitWizard.tsx already used default (true) and was unchanged
  - All validation passing: lint (0 warnings/errors), fmt, typecheck (all packages exit 0)

2026-02-24 | remove-pty-sessions-and-node-pty | Completed
  - Deleted packages/desktop/src/main/pty.ts (PtySession class)
  - Deleted packages/desktop/src/renderer/components/TerminalView.tsx (xterm.js terminal view)
  - Removed node-pty from dependencies, xterm/xterm-addon-fit/xterm-addon-web-links from devDependencies in packages/desktop/package.json
  - Removed all PTY-related IPC handlers (pty:input, pty:resize, agent:runOnce) and ptySession guards from ipc.ts
  - Removed pty:input/pty:resize channels, RunOnceOptions type, agent:runOnce channel, and pty property from OdyApi in renderer/types/ipc.ts
  - Removed pty bridge and runOnce from both preload scripts (preload.ts and preload/index.ts)
  - Removed startOnce callback and RunOnceOptions import from useAgent.ts hook
  - Removed "Open in Terminal" button and onOpenTerminal prop from EditorToolbar.tsx
  - Removed PTY-related terminal launch logic from TaskEditor.tsx (useAgent/useStore imports, startOnce call, info toast)
  - Removed Terminal View tab and TerminalView import from AgentOutput.tsx (now log-only)
  - Removed onOpenTerminal/showOpenTerminal props from ConfigEditor.tsx EditorToolbar usage
  - Removed buildInteractiveCommand() from Harness base class, Backend facade, and all backend implementations (claude.ts, codex.ts, opencode.ts)
  - Updated CLI edit command (packages/cli/src/cmd/task/edit.ts) to use buildCommand instead of buildInteractiveCommand
  - Removed 'node-pty' from external array in packages/desktop/vite.main.config.ts
  - Regenerated bun.lock after dependency removal
  - All validation passing: lint (0 warnings/errors), fmt, typecheck (no new errors introduced)

2026-02-24 | skip-run-dialog-for-single-task | Completed
  - Removed run confirmation dialog from TaskBoard.tsx — clicking "Run" on a task card now starts the agent immediately
  - Refactored startTaskRun to accept a TaskSummary parameter directly instead of reading from dialog state
  - startTaskRun now uses config defaults for iterations (config.maxIterations) and auto-commit (config.autoCommit)
  - Added isRunning guard at the top of startTaskRun to prevent concurrent runs without needing the dialog
  - Removed runTarget, runIterations, runShouldCommit state variables and the config-sync useEffect
  - Removed the Switch component import (only used by the run dialog's auto-commit toggle)
  - Removed the entire run confirmation Dialog JSX block (~65 lines)
  - Updated TaskCard onRun handler from setRunTarget to directly call startTaskRun
  - AgentRunner page run dialog is unaffected (lives in a separate component)

2026-03-10 | prompt-for-another-interactive-plan-after-generation | Completed
  - Refactored the CLI interactive plan branch into a repeatable session loop that prompts `Add another plan?` after each successful run
  - Preserved immediate failure propagation for non-zero interactive backend exits and clean exit behavior for declined or cancelled follow-up prompts
  - Added focused CLI tests covering repeat, decline, cancel, and failure behavior for interactive planning
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`
  - All validation passing: lint (0 warnings/errors), fmt, typecheck (no new errors introduced)

2026-02-24 | replace-project-switcher-with-dropdown-menu | Completed
  - Replaced vertical project button list and hand-rolled context menu in Sidebar.tsx with a single DropdownMenu from @/components/ui/dropdown-menu
  - Removed contextMenu useState, useEffect with click/blur/keydown listeners, contextProject derivation, and absolute-positioned context menu div
  - Expanded mode: single dropdown trigger button showing active project name with ChevronDown indicator
  - Collapsed mode: single circular initial-letter button as dropdown trigger wrapped in Tooltip
  - Dropdown content uses DropdownMenuRadioGroup/RadioItem for project switching with active project indicated
  - Per-project "Copy Path" and "Remove" (destructive) actions in grouped sections within dropdown
  - "Add Project" item at bottom of dropdown with Plus icon, calling onAddProject
  - Loading state shows pulse animation on trigger; empty state shows "No projects added" with only Add Project available
  - SidebarProps interface unchanged; all existing callback props preserved
  - Removed useState/useEffect imports (no longer needed), added dropdown-menu and lucide-react icon imports
  - All validation passing: lint (0 warnings/errors), fmt, typecheck (no new Sidebar errors)

2026-02-24 | replace-codemirror-with-rendered-markdown-editor | Completed
  - Selected Milkdown (ProseMirror-based, markdown-native) as the rich-text editor library for best markdown round-trip fidelity
  - Installed @milkdown/kit@7.18.0 and @milkdown/react@7.18.0 in packages/desktop
  - Created RichMarkdownEditor.tsx component using vanilla Milkdown API (imperative lifecycle, same pattern as existing CodeMirror wrapper)
  - Handles YAML frontmatter by stripping it before Milkdown and prepending on serialization; displays as collapsible raw-text section
  - Preserves MarkdownEditorHandle imperative API: undo (undoCommand), redo (redoCommand), focus, getSelectionRange (maps ProseMirror positions to raw markdown character offsets)
  - Selection mapping uses textBetween + indexOf for ProseMirror-to-markdown offset conversion
  - Cmd+K / Ctrl+K wired via ProseMirror handleKeyDown for inline AI edit prompt
  - Read-only mode toggle via ProseMirror editable prop, history change reporting via dispatchTransaction hook
  - Integrated RichMarkdownEditor into TaskEditor.tsx replacing MarkdownEditor import and component reference
  - MarkdownEditor.tsx retained for ConfigEditor.tsx (JSON editing) — CodeMirror removed only from the task edit view
  - DiffView.tsx and theme.ts unchanged — CodeMirror merge view retained for diff review step
  - Added comprehensive ProseMirror/Milkdown styles to globals.css (headings, lists, code blocks, links, blockquotes, hr, tables)
  - Imported @milkdown/kit/prose/view/style/prosemirror.css base styles
  - All validation passing: lint (0 warnings/errors), fmt, typecheck (no new errors; only pre-existing DOM lib errors)

2026-02-24 | rewrite-rich-markdown-editor-with-milkdown-react | Completed
  - Rewrote RichMarkdownEditor.tsx from vanilla Milkdown API to official @milkdown/react bindings
  - Split monolithic component into InnerEditor (uses useEditor/useInstance hooks) + outer RichMarkdownEditor (wraps in MilkdownProvider)
  - InnerEditor uses useEditor((root) => Editor.make()...) for lifecycle management — removed manual useEffect async IIFE, editor.destroy(), editorRef/editorReadyRef tracking
  - Replaced manual containerRef div with <Milkdown /> mount point component
  - useInstance() provides [loading, getEditor] for imperative access — replaced editorRef.current checks
  - Removed dynamic import of @milkdown/kit/core — now uses static imports since useEditor handles async creation
  - Preserved all existing functionality: frontmatter handling, Cmd+K inline prompt, history reporting, readOnly sync, external value sync, undo/redo/focus/getSelectionRange imperative methods
  - Preserved public API (RichMarkdownEditorProps, RichMarkdownEditorHandle, displayName) — no consumer changes needed
  - Preserved milkdown-editor CSS class on wrapping container div for existing globals.css styles
  - All validation passing: lint (0 warnings/errors), fmt, typecheck (no new errors; only pre-existing DOM lib errors)

2026-02-25 | replace-zustand-with-tanstack-query | Completed
  - Installed @tanstack/react-query in packages/desktop devDependencies
  - Created QueryClient (src/renderer/lib/queryClient.ts) with IPC-appropriate defaults (staleTime: 30s, retry: 1, no refetchOnWindowFocus)
  - Created centralized query key factory (src/renderer/lib/queryKeys.ts) for projects, config, tasks, and auth domains
  - Wrapped renderer App in QueryClientProvider
  - Rewrote useProjects hook: useQuery for list/active, useMutation for add/remove/switch, IPC onSwitched listener updates cache directly
  - Rewrote useConfig hook: useQuery for config.load(), useMutation for save/saveGlobal/validate/resetGuiOverrides with cache invalidation
  - Rewrote useTasks hook: useQuery for tasks.list() and tasks.states(), filters/selection read from Zustand ViewSlice
  - Rewrote useAuth hook: useQuery for auth.list(), useMutation for saveJira/saveGitHub/removeJira/removeGitHub with invalidation
  - Created ViewSlice (src/renderer/store/slices/viewSlice.ts) absorbing labelFilter, statusFilter, selectedTaskPath, configEditorPath from removed slices
  - Updated store/index.ts to compose only AgentSlice & UISlice & ViewSlice & AppSlice
  - Updated AgentRunner and TaskBoard to source activeProjectPath from useProjects() instead of useStore
  - Deleted four Zustand slice files: projectSlice.ts, configSlice.ts, taskSlice.ts, authSlice.ts
  - All validation passing: bun lint (0 errors/warnings), bun fmt, bun typecheck (all packages pass)

2026-02-25 | install-tanstack-router-dependencies | Completed
  - Added `@tanstack/react-router` and `@tanstack/react-router-with-query` to `packages/desktop/package.json` dependencies
  - Added `@tanstack/router-plugin` and `@tanstack/router-devtools` to `packages/desktop/package.json` devDependencies
  - Ran `bun add` commands from workspace root and updated `bun.lock`
  - Verified `packages/desktop/node_modules/@tanstack/react-router` exists
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-02-25 | add-tanstack-router-vite-plugin | Completed
  - Configured `TanStackRouterVite` as the first plugin in `packages/desktop/vite.renderer.config.ts` with routes and generated tree paths
  - Created `packages/desktop/src/renderer/routes/.gitkeep` to establish the routes directory for file-based route generation
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-02-25 | create-router-instance-with-hash-history | Completed
  - Added `packages/desktop/src/renderer/router.ts` with a module-level hash-history TanStack router singleton and Register augmentation
  - Added temporary `packages/desktop/src/renderer/routeTree.gen.ts` placeholder export so typecheck passes before route generation
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-02-25 | create-root-route-layout | Completed
  - Added `packages/desktop/src/renderer/routes/__root.tsx` with root shell layout, modal/dialog handling, router-based navigation triggers, and `<Outlet />` child rendering
  - Kept global project/config/task loading behavior and sidebar toggle shortcut; moved menu and custom events to `navigate()` route transitions
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-02-25 | update-app-entry-with-router-provider | Completed
  - Replaced `<Layout />` with `<RouterProvider router={router} />` in `packages/desktop/src/renderer/App.tsx`
  - Added `RouterProvider` and `router` imports, and removed obsolete `Layout` import
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-02-25 | create-simple-view-routes | Completed
  - Added six route files in `packages/desktop/src/renderer/routes/`: `run.tsx`, `plan.tsx`, `import.tsx`, `config.tsx`, `auth.tsx`, and `archive.tsx`, each rendering the expected view component inside `ErrorBoundary`
  - Moved plan streaming lifecycle into `routes/plan.tsx` with `api.agent` output/complete/stopped/verify-failed listeners, task refresh on completion, and `GenerationOutput` task-board navigation via router
  - Wired route-based navigation callbacks for import/config views, including config JSON editing route navigation and a root-level `ody:open-init-wizard` event listener in `routes/__root.tsx` to preserve modal behavior
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-02-25 | create-tasks-route-with-search-params | Completed
  - Added `routes/tasks.tsx` with validated `label`/`status` search params and router-based navigation callbacks for plan, archive, and editor
  - Updated `TaskBoard.tsx` to support route-driven label/status filters with URL-sync callbacks while keeping store-based fallback for legacy usage
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-02-25 | create-editor-route-with-search-params | Completed
  - Added `routes/editor.tsx` with required `taskPath` search validation and route-level back navigation to `/tasks`
  - Updated `TaskEditor.tsx` to take `taskPath` as a prop and removed direct `selectedTaskPath` store reads
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-02-25 | create-config-editor-route-with-search-params | Completed
  - Added `routes/config-editor.tsx` with required `path` search validation and route-level back navigation to `/config`
  - Updated `ConfigEditor.tsx` to consume `configPath` from props instead of Zustand `configEditorPath`
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-02-25 | migrate-navigation-triggers | Completed
  - Confirmed router-based navigation in `routes/__root.tsx` menu/custom-event handlers and route callback props for tasks/editor/config/import/plan flows
  - Removed remaining legacy `setActiveView` / ViewSlice setter references outside `store/slices/viewSlice.ts` by migrating `useTasks` and local fallback state usage in affected components
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-02-25 | migrate-sidebar-to-router-links | Completed
  - Updated `Sidebar.tsx` navigation items to use TanStack Router `<Link>` with `activeProps`/`inactiveProps` in expanded and collapsed modes
  - Removed `activeView` and `onViewSelect` props from `Sidebar`, and stopped passing them from `routes/__root.tsx` and legacy `components/Layout.tsx`
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-02-25 | create-index-redirect-route | Completed
  - Added `packages/desktop/src/renderer/routes/index.tsx` with `beforeLoad` redirect from `/` to `/tasks` using TanStack Router `redirect`
  - Matched existing route typing workaround by using `(createFileRoute as any)` to satisfy current generated-route type constraints
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-02-25 | remove-zustand-view-slice | Completed
  - Removed Zustand `ViewSlice` from `packages/desktop/src/renderer/store/index.ts` and simplified `AppStore` to `AgentSlice & UISlice & AppSlice`
  - Deleted `packages/desktop/src/renderer/store/slices/viewSlice.ts` after confirming no remaining `ViewSlice`/`createViewSlice`/setter references in `src/renderer`
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-02-25 | delete-layout-and-finalize-cleanup | Completed
  - Deleted obsolete `packages/desktop/src/renderer/components/Layout.tsx` and confirmed no remaining `Layout`, `viewSlice`, or `setActiveView` references in `src/renderer`
  - Confirmed `VIEW_META` now only exists in `routes/__root.tsx` and `App.tsx` continues to render `RouterProvider`
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-02-27 | add-change-detection-job-to-release-workflow | Completed
  - Added a new `detect-changes` job in `.github/workflows/release.yml` using `dorny/paths-filter@v3.0.2` to emit `cli_changed` and `desktop_changed` outputs for release-lane gating.
  - Validation run: `bun lint` (warnings only, no errors), `bun fmt`, `bun typecheck`.

2026-02-27 | add-desktop-version-bump-to-prepare-release | Completed
  - Added optional `desktop_bump` workflow input in `.github/workflows/prepare-release.yml`, made changeset generation include `@ody/desktop` only when selected, and updated PR title/body plus new-version outputs to report desktop version bumps.
  - Validation run: `bun lint` (warnings only, no errors), `bun fmt`, `bun typecheck`.

2026-02-27 | refactor-cli-release-jobs-with-conditional-gates | Completed
  - Renamed release workflow CLI lane jobs from `tag`/`build`/`release` to `tag-cli`/`build-cli`/`release-cli`, gated `tag-cli` on `detect-changes` output `cli_changed`, and updated all `needs`/tag output references accordingly.
  - Validation run: `bun lint` (warnings only, no errors), `bun fmt`, `bun typecheck`.

2026-02-27 | add-desktop-tag-creation-job | Completed
  - Added `tag-desktop` in `.github/workflows/release.yml`, gated on `detect-changes` desktop output, with `desktop-vX.Y.Z` tag creation/push, existing-tag skip behavior, and `tag` job output for downstream desktop jobs.
  - Validation run: `bun lint` (warnings only, no errors), `bun fmt`, `bun typecheck`.

2026-02-27 | add-macos-desktop-build-job | Completed
  - Added `build-desktop` to `.github/workflows/release.yml` (macOS runner, `needs: [tag-desktop]`, non-empty tag gate), with Bun setup, desktop `make` build, and `ody-desktop-macos` artifact upload from `packages/desktop/out/make/**/*`.
  - Validation run: `bun lint` (warnings only, no errors), `bun fmt`, `bun typecheck`.

2026-02-27 | add-desktop-release-publishing-job | Completed
  - Added `release-desktop` to `.github/workflows/release.yml` with `needs: [tag-desktop, build-desktop]`, desktop tag gate, artifact download (`ody-desktop-macos`), and `softprops/action-gh-release@v2.5.0` publishing under the desktop tag with generated release notes.
  - Validation run: `bun lint` (warnings only, no errors), `bun fmt`, `bun typecheck`.

2026-03-05 | render-markdown-in-task-detail-dialog | Completed
  - Installed react-markdown@10.1.0 and remark-gfm@4.0.1 in packages/desktop
  - Removed hand-rolled parseMarkdownSections, renderSectionBody, and MarkdownSection type from TaskDetailDialog.tsx
  - Created RenderedMarkdown component using react-markdown with remark-gfm for GFM support (tables, strikethrough, task lists)
  - Mapped all markdown elements (h1-h4, p, ul, ol, li, a, strong, em, code, pre, blockquote, hr, table, input) to styled React elements using existing Tailwind design tokens (text-light, text-mid, text-dim, border-edge, bg-panel, etc.)
  - Inline code styled with bg-accent-bg/text-primary; fenced code blocks in bordered pre with monospace font
  - Frontmatter and "# Task:" title line stripped before rendering since dialog header already displays them
  - Dialog chrome (header, status badge, labels, metadata, footer buttons, loading/error states) unchanged
  - All validation passing: bun lint (0 errors, only pre-existing react-hooks-js todos), bun fmt, bun typecheck (all packages pass)

2026-03-06 | add-global-run-button-to-desktop-header | Completed
  - Added a global Run/Stop control to the desktop header, starting continuous project-wide runs and surfacing a toast when the loop ends because no unresolved tasks remain
  - Threaded an agent completion reason from the main process to the renderer and centralized `useAgent` IPC subscriptions to avoid duplicate listeners across screens
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-03-06 | restrict-desktop-ipc-file-access-to-project-boundaries | Completed
  - Locked task IPC file operations to the active project's `.ody/tasks` directory with canonical path validation and kept config editing limited to known Ody config files
  - Applied the same boundary checks to inline edit file access so slash-containing renderer paths are no longer trusted
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-03-06 | fix-cli-entrypoint-exit-codes | Completed
  - Updated the CLI entrypoint to stop forcing `process.exit()` on success and to preserve a non-zero `process.exitCode` when top-level command execution throws
  - Added a focused entrypoint test covering both success and failure exit-status behavior
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-03-06 | stop-agent-before-switching-projects-in-desktop | Completed
  - Made desktop project switching wait for the real agent stop lifecycle before changing the active project, and only reset renderer agent state after the switch succeeds
  - Moved `agent:stopped` synchronization to the actual main-process shutdown path so the run indicator and project views no longer hide a still-running backend process
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-03-06 | fix-update-command-false-success-reporting | Completed
  - Refactored `ody update` to stop on install failures without falling through to success messaging, and set a non-zero exit status for failed installs
  - Added focused CLI tests covering failed update, successful update, and `--check` behavior
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-03-06 | harden-plan-and-import-agent-completion-validation | Completed
  - Shared the CLI completion-marker parser/validator, removed early process kills from `plan` and `task import`, and now require a clean exit plus a standalone `<woof>COMPLETE</woof>` marker before reporting success
  - Added focused tests covering strict marker detection, ambiguous marker output, missing markers, and non-zero exit handling
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-03-06 | handle-init-prompt-cancellation-safely | Completed
  - Guarded cancellable `ody init` model and agent text prompts before string coercion so cancel sentinels are never persisted into `.ody/ody.json`
  - Added a focused CLI regression test for cancelled, blank, and trimmed prompt values
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-03-06 | make-desktop-graceful-stop-actually-interrupt-runs | Completed
  - Made desktop graceful stop send `SIGTERM` to the active backend process and escalate to `SIGKILL` after a short timeout so runs do not hang indefinitely
  - Updated Agent Runner stop dialog and notifications to describe the real stop behavior instead of implying a passive wait-for-next-cycle flow
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-03-06 | wire-or-remove-no-op-auto-commit-toggle-in-agent-runner | Completed
  - Removed the no-op auto-commit switch from the Agent Runner run dialog and replaced it with config-derived status text
  - Aligned run-start messaging with other desktop entry points so auto-commit is described as config-driven instead of a per-run override
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`
[2026-03-06] Completed remove-render-phase-state-updates-in-desktop-views: removed render-phase state updates from TaskBoard and tied init wizard visibility to the active project path in the desktop root route.
[2026-03-06] Completed compare-update-versions-semantically: switched CLI update detection to semantic version ordering and added tests for equal, newer, local-newer, and prerelease cases.
[2026-03-06] Completed hydrate-agent-state-on-desktop-load: added agent:status IPC channel so the renderer can query current agent state on mount and project switch, hydrating the Zustand store with isRunning/iteration/maxIterations from the main process.

2026-03-09 | rename-should-commit-to-auto-commit | Completed
  - Renamed `shouldCommit` config property to `autoCommit` across the entire codebase
  - Updated zod schema (configSchema + Config.Schema) in internal/config
  - Added backward-compatible deprecation shim: legacy `shouldCommit` key in JSON config is migrated to `autoCommit` with a console.warn
  - Renamed CLI flag from `--shouldCommit` to `--autoCommit` in init.ts (alias `-c` preserved)
  - Updated prompt builder (runPrompt.ts) template text and placeholder tokens
  - Updated all desktop components: form.ts, AgentRunner, TaskBoard, __root, SettingsModal, InitWizard, ConfigPanel
  - Updated documentation: configuration.mdx, init.mdx, config.mdx, configuration_schema.json, README.md
  - Updated .ody/ody.json, AGENTS.md, and task/planning markdown files for consistency
  - Validation passing: `bun lint`, `bun fmt`, `bun typecheck`

2026-03-09 | taskboard-autocomplete-filters | Completed
  - Created reusable MultiCombobox UI wrapper in packages/desktop/src/renderer/components/ui/combobox.tsx using @base-ui/react/combobox primitives with multi-select, chip display, and dismiss support
  - Replaced single-select Collapsible pill-button label filter with MultiCombobox (OR semantics across selected labels)
  - Replaced single-select Collapsible pill-button status filter with MultiCombobox (OR semantics across selected statuses)
  - Refactored TaskBoard.tsx local state: localLabelFilter changed from string|null to string[], localStatusFilter from TaskStatus|'all' to TaskStatus[]
  - Updated filteredTasks memo to use array intersection checks instead of single-value equality
  - Empty selection in either combobox shows all tasks (no filtering applied)
  - Preserved TaskBoardProps interface and route definition in tasks.tsx unchanged
  - AgentRunner component untouched
  - Validation passing: `bun lint` (0 errors, 22 pre-existing warnings), `bun fmt`, `bun typecheck`

2026-03-09 | improve-task-detail-dialog-body-text-readability | Completed
  - Updated MARKDOWN_COMPONENTS in TaskDetailDialog.tsx to improve dark-mode readability
  - Changed text color from text-mid to text-light for body elements: p, ul, ol, li, em, td
  - Changed font size from text-xs to text-sm for body elements: p, ul, ol, pre, td, th, blockquote
  - Blockquote kept text-dim color (intentionally de-emphasized), only size bumped
  - Table headers kept text-light color, only size bumped
  - Headings (h1-h4), strong, a, inline code unchanged — already had appropriate styling
  - Validation passing: `bun lint` (0 errors, 22 pre-existing warnings), `bun fmt`, `bun typecheck`

2026-03-09 | allow-interactive-plan-to-create-multiple-tasks | Completed
  - Rewrote `INTERACTIVE_PLAN_PROMPT` in `internal/builders/src/planPrompt.ts` to allow one or more task files instead of forcing exactly one
  - Added decomposition and logical ordering guidance so broad interactive plans can produce multiple discrete task files with dependencies first
  - Preserved the collaborative workflow: restate request, ask focused questions, summarize tasks and assumptions, then emit files
  - Switched the interactive prompt's file-format section to reuse `TASK_FILE_FORMAT` for consistency with the shared task template
  - Validation passing: `bun lint` (0 errors, 22 pre-existing warnings), `bun fmt`, `bun typecheck`

2026-03-10 | replace-new-task-with-run-in-header | Completed
  - Removed the desktop header's `New Task` action and reordered the remaining controls to `Refresh`, then `Run`/`Stop` in `packages/desktop/src/renderer/routes/__root.tsx`
  - Validation passing: `bun lint` (0 errors, 22 pre-existing warnings), `bun fmt`, `bun typecheck`

2026-03-10 | make-plan-interactive-by-default | Completed
  - Flipped `ody plan` to launch the interactive harness by default, added `--yolo` for the previous prompted background flow, and removed the old interactive flag from the command definition
  - Re-exported `buildInteractivePlanPrompt` from `@internal/builders` and updated the CLI command to import it through the barrel
  - Validation passing: `bun lint` (0 errors, 22 pre-existing warnings), `bun fmt`, `bun typecheck`
