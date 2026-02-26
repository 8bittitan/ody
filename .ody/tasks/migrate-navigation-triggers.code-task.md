---
status: completed
created: 2026-02-25
started: 2026-02-25
completed: 2026-02-25
---
# Task: Migrate Navigation Triggers to Router Navigation

## Description
Update all remaining navigation triggers across the application to use `useNavigate()` or the `router` singleton instead of `setActiveView()` and Zustand state mutations. This covers Electron IPC menu actions, custom DOM events, cross-component callback props, and filter changes.

## Background
Navigation currently happens through multiple channels:
1. **Sidebar clicks** — handled by the Sidebar migration task.
2. **Electron IPC menu actions** (`window.ody.app.onMenuAction`) — `view:tasks`, `view:run`, `view:plan`, `view:config`, `project:add`, `editor:save`. These are in `Layout.tsx` lines 247-282.
3. **Custom DOM events** — `ody:view-run` (Layout.tsx lines 284-293) triggers navigation to the run view.
4. **Cross-component callback props** — `onOpenPlan`, `onOpenArchive`, `onOpenEditor`, `onBack`, `onOpenAuth`, `onOpenTaskBoard`, `onEditJson`, `onOpenInitWizard`, `onOpenConfigView`. These are passed from Layout.tsx to view components.
5. **Filter changes** — `setLabelFilter` and `setStatusFilter` in TaskBoard.

Items 1, 3, and parts of 4 are handled in `__root.tsx`. Item 2 is handled in route files. This task ensures nothing is missed and all triggers are migrated.

## Technical Requirements
1. **Electron IPC menu actions** (in `__root.tsx`):
   - `view:tasks` → `navigate({ to: '/tasks' })`
   - `view:run` → `navigate({ to: '/run' })`
   - `view:plan` → `navigate({ to: '/plan' })`
   - `view:config` → `navigate({ to: '/config' })`
   - `project:add` → call `handleAddProject()` (unchanged)
   - `editor:save` → dispatch `ody:save-editor` DOM event (unchanged)
2. **Custom DOM event** `ody:view-run` (in `__root.tsx`):
   - Replace `setActiveView('run')` with `navigate({ to: '/run' })`.
3. **Cross-component callbacks** (in route files):
   - `TaskBoard.onOpenPlan` → `navigate({ to: '/plan' })` (in tasks route)
   - `TaskBoard.onOpenArchive` → `navigate({ to: '/archive' })` (in tasks route)
   - `TaskBoard.onOpenEditor(taskPath)` → `navigate({ to: '/editor', search: { taskPath } })` (in tasks route)
   - `TaskEditor.onBack` → `navigate({ to: '/tasks' })` (in editor route)
   - `ConfigPanel.onEditJson(configPath)` → `navigate({ to: '/config-editor', search: { path: configPath } })` (in config route)
   - `ConfigEditor.onBack` → `navigate({ to: '/config' })` (in config-editor route)
   - `TaskImport.onOpenAuth` → `navigate({ to: '/auth' })` (in import route)
   - `TaskImport.onOpenTaskBoard` → `navigate({ to: '/tasks' })` (in import route)
   - `GenerationOutput.onOpenTaskBoard` → `navigate({ to: '/tasks' })` (in plan route)
   - `SettingsModal.onOpenConfigView` → `navigate({ to: '/config' })` (in root layout)
4. **Filter changes in TaskBoard**:
   - Replace `setLabelFilter(label)` with `navigate({ search: (prev) => ({ ...prev, label }) })`.
   - Replace `setStatusFilter(status)` with `navigate({ search: (prev) => ({ ...prev, status }) })`.
5. Audit all usages of `setActiveView`, `setSelectedTaskPath`, `setConfigEditorPath`, `setLabelFilter`, and `setStatusFilter` across the codebase to ensure none are missed.

## Dependencies
- **create-root-route-layout** — IPC and DOM event handlers live in the root layout.
- **create-tasks-route-with-search-params** — TaskBoard callbacks are in the tasks route.
- **create-editor-route-with-search-params** — TaskEditor callback is in the editor route.
- **create-config-editor-route-with-search-params** — ConfigEditor callback is in the config-editor route.
- **create-simple-view-routes** — remaining view callbacks are in their respective route files.

## Implementation Approach
1. **Audit**: Search the entire `src/renderer/` directory for:
   - `setActiveView` — should be zero occurrences after migration.
   - `setSelectedTaskPath` — should be zero occurrences (replaced by route search params).
   - `setConfigEditorPath` — should be zero occurrences (replaced by route search params).
   - `setLabelFilter` — should be zero occurrences (replaced by search param navigation).
   - `setStatusFilter` — should be zero occurrences (replaced by search param navigation).
   - `ody:view-run` event dispatches — keep these but ensure handlers use `navigate`.
2. **Update `__root.tsx`** with the IPC menu action handler using `navigate()`.
3. **Update `__root.tsx`** with the `ody:view-run` DOM event handler using `navigate()`.
4. **Update `__root.tsx`** so `SettingsModal.onOpenConfigView` uses `navigate({ to: '/config' })`.
5. **Update `TaskBoard.tsx`**: Replace all store-based filter mutations with `useNavigate` calls for search param updates. This requires `TaskBoard` to receive a navigate function or use `useNavigate()` directly.
6. **Review any other component** that dispatches `window.dispatchEvent(new CustomEvent('ody:view-run'))` and ensure it still works — the dispatch stays, but the listener in `__root.tsx` now calls `navigate`.

## Acceptance Criteria

1. **Menu shortcuts navigate correctly**
   - Given the user presses `Cmd+N` (mapped to `view:plan`)
   - When the IPC action fires
   - Then the app navigates to `/plan`

2. **Custom DOM events navigate**
   - Given a component dispatches `ody:view-run`
   - When the event listener fires in `__root.tsx`
   - Then the app navigates to `/run`

3. **All setActiveView calls removed**
   - Given the entire `src/renderer/` source
   - When I search for `setActiveView`
   - Then zero occurrences are found

4. **All ViewSlice setters removed**
   - Given the entire `src/renderer/` source
   - When I search for `setSelectedTaskPath`, `setConfigEditorPath`, `setLabelFilter`, `setStatusFilter`
   - Then zero occurrences are found (outside of the ViewSlice definition itself, which is deleted in a later task)

5. **Filter URL updates work**
   - Given the user changes a label filter in TaskBoard
   - When the filter changes
   - Then the URL updates to include the new search param

## Metadata
- **Complexity**: High
- **Labels**: routing, navigation, migration, desktop
