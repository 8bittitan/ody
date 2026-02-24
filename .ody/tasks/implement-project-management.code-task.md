---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement Project Management (Add, Switch, Remove)

## Description
Implement the project management system allowing users to add project folders, switch between projects, and remove projects from the list. This includes the sidebar project list, native folder picker dialog, project context menu, persistence via `electron-store`, and the welcome screen for first-launch.

## Background
Each project is a folder on disk containing (or that will contain) an `.ody/` directory. The project list and last-active project are persisted in `electron-store`. Switching projects reloads config, rescans tasks, and resets agent state. The sidebar shows all registered projects with the active one highlighted. A context menu on right-click provides Open, Copy Path, and Remove actions. If an agent is running when switching, a confirmation dialog is shown.

## Technical Requirements
1. Implement `projects:list` IPC handler -- returns all registered projects from `electron-store`
2. Implement `projects:add` IPC handler -- opens `dialog.showOpenDialog` for folder selection, adds to project list
3. Implement `projects:remove` IPC handler -- removes from list (not from disk)
4. Implement `projects:switch` IPC handler -- sets active project, reloads config/tasks, sends `projects:switched` event
5. Implement `projects:active` IPC handler -- returns current active project path
6. Implement sidebar project list in `Sidebar.tsx` with:
   - Project names, active project highlighted
   - "+ Add" button
   - Right-click context menu (Open, Copy Path, Remove)
7. Implement `useProjects` hook bridging IPC and store
8. Implement welcome screen for first launch (no projects registered)
9. Handle agent-running guard when switching projects
10. Persist project list and last-active project in `electron-store`
11. On launch, restore last-active project; if path no longer exists, fall back to project list or welcome screen

## Dependencies
- `implement-app-layout-shell` task must be completed
- `implement-ipc-layer-and-preload` task must be completed
- `implement-zustand-store` task must be completed

## Implementation Approach
1. In main process, create project manager using `electron-store`:
   ```typescript
   const store = new Store();
   // store.get('projects', []) -> { path: string; name: string }[]
   // store.get('activeProject', null) -> string | null
   ```
2. Implement IPC handlers:
   - `projects:add`: use `dialog.showOpenDialog({ properties: ['openDirectory'] })`, extract folder name from path, append to list, persist
   - `projects:switch`: validate path exists, set as active, reload config via `Config.load()` with new cwd, send `projects:switched` event
   - `projects:remove`: filter from list, if removing active project, switch to first remaining or null
3. In renderer `Sidebar.tsx`:
   - Render project list from `useProjects` hook
   - Active project gets accent-bg background and accent text
   - "+ Add" button at bottom of projects section
   - Right-click handler opens `DropdownMenu` context menu at cursor position
4. Implement welcome screen (`ProjectList.tsx` or similar):
   - Shown when no projects are registered
   - "Add Project" CTA button with folder icon
   - Brief description text
5. Agent guard: when switching projects, check `agentSlice.isRunning`. If true, show confirmation dialog
6. On app startup, check `store.get('activeProject')`, validate it exists on disk, switch to it

## Acceptance Criteria

1. **Add Project**
   - Given the sidebar
   - When clicking "+ Add" and selecting a folder
   - Then the project appears in the sidebar and is persisted

2. **Switch Project**
   - Given multiple projects in the sidebar
   - When clicking a different project
   - Then it becomes the active project and config/tasks reload

3. **Remove Project**
   - Given a project in the sidebar
   - When right-clicking and selecting "Remove"
   - Then it is removed from the list but not from disk

4. **Persistence**
   - Given projects have been added
   - When restarting the app
   - Then the project list and last-active project are restored

5. **Welcome Screen**
   - Given no projects are registered
   - When the app launches
   - Then a welcome screen with "Add Project" CTA is shown

6. **Agent Guard**
   - Given an agent is running
   - When trying to switch projects
   - Then a confirmation dialog appears

## Metadata
- **Complexity**: Medium
- **Labels**: projects, sidebar, electron, desktop
