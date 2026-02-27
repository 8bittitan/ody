---
status: completed
created: 2026-02-25
started: 2026-02-25
completed: 2026-02-25
---
# Task: Create Root Route Layout (__root.tsx)

## Description
Create `src/renderer/routes/__root.tsx` which serves as the root layout for the entire application. This file extracts the outer shell from the current `Layout.tsx` — the title bar header, sidebar, main content area (`<Outlet />`), footer, and modal dialogs (InitWizard, SettingsModal, project switch confirmation).

## Background
Currently `Layout.tsx` (617 lines) is a monolithic component handling the outer shell, view switching, plan generation streaming, project management, and all navigation triggers. The root route takes over the shell responsibilities while individual route components handle their own view content. The root route also hosts global effects: Electron IPC menu action listener, `ody:view-run` custom DOM event listener, keyboard shortcut for sidebar toggle, and project initialization/config loading.

## Technical Requirements
1. Create `packages/desktop/src/renderer/routes/__root.tsx`.
2. Use `createRootRoute` from `@tanstack/react-router` and export `Route`.
3. The `RootLayout` component must render:
   - The title bar header with ODY branding, settings button, and help button.
   - The `<Sidebar>` component with all project management props.
   - A `<main>` area containing the page header (project name, view title/subtitle, Refresh and New Task buttons) and `<Outlet />` for child routes.
   - The footer status bar (agent state, project path, backend name).
   - The `InitWizard`, `SettingsModal`, and project switch confirmation `Dialog`.
4. Derive the active view from the current pathname using `useRouterState({ select: (s) => s.location.pathname })` for sidebar highlighting and page header content.
5. Preserve the `VIEW_META` record mapping view IDs to title/subtitle pairs.
6. Move hooks from Layout.tsx: `useProjects`, `useConfig`, `useTasks`, `useApp`, `useNotifications`, `useStore` selectors for `isRunning`, `sidebarCollapsed`, `toggleSidebar`, `resetAgentState`.
7. Render the "Add your first project" empty state when `projects.length === 0 && !isLoading`.
8. Pass `onViewSelect` to Sidebar as `(id) => navigate({ to: \`/\${id}\` })`.
9. Include `TanStackRouterDevtools` in dev mode only: `{import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}`.

## Dependencies
- **create-router-instance-with-hash-history** — the router must exist for the root route to function.
- **add-tanstack-router-vite-plugin** — the Vite plugin must be configured to detect this route file.

## Implementation Approach
1. Create the file `packages/desktop/src/renderer/routes/__root.tsx`.
2. Import `createRootRoute`, `Outlet`, `useNavigate`, `useRouterState` from `@tanstack/react-router`.
3. Import `TanStackRouterDevtools` from `@tanstack/router-devtools`.
4. Copy the `VIEW_META` constant from `Layout.tsx`.
5. Copy the `getProjectName` helper from `Layout.tsx`.
6. Implement `RootLayout` by extracting the following from `Layout.tsx`:
   - All `useState` for modals (`showInitWizard`, `showSettingsModal`, `showSwitchDialog`, `pendingSwitchPath`).
   - The `useProjects` hook and all project management handlers (`handleAddProject`, `handleProjectSelect`, `handleConfirmSwitch`, `handleCancelSwitch`, `handleRemoveProject`, `handleCopyProjectPath`, `handleBrowseProject`, `applySwitch`).
   - The `useConfig`, `useTasks`, `useApp`, `useNotifications` hooks.
   - The `useStore` selectors for `isRunning`, `sidebarCollapsed`, `toggleSidebar`, `resetAgentState`.
   - The `useEffect` for `activeProjectPath` change (config loading, init wizard).
   - The keyboard shortcut `useEffect` for `Cmd+[` sidebar toggle.
   - The Electron IPC menu action `useEffect` — but now using `navigate()` instead of `setActiveView()`.
   - The custom DOM event `useEffect` for `ody:view-run` — now using `navigate({ to: '/run' })`.
7. Replace the ternary view chain with `<Outlet />`.
8. Derive `activeView` from pathname: `const pathname = useRouterState({ select: (s) => s.location.pathname }); const activeView = pathname.slice(1) || 'tasks';`.
9. Use `activeView` for `VIEW_META[activeView]` lookups and sidebar `activeView` prop.
10. Keep the "New Task" button in the page header navigating to `/plan`: `navigate({ to: '/plan' })`.
11. Keep the "Refresh" button calling `loadTasks()`.
12. **Do NOT** include plan generation streaming state here — that belongs in the plan route.

## Acceptance Criteria

1. **Root layout renders shell**
   - Given the app is running
   - When any route is active
   - Then the title bar, sidebar, page header, footer, and modals are rendered

2. **Sidebar highlights active route**
   - Given the user navigates to `/config`
   - When the sidebar renders
   - Then the "Config" item is highlighted

3. **Outlet renders child routes**
   - Given the root layout renders
   - When a child route like `/tasks` is active
   - Then `<Outlet />` renders the tasks route component

4. **IPC menu actions navigate**
   - Given the Electron main process sends `view:tasks` menu action
   - When the handler fires
   - Then `navigate({ to: '/tasks' })` is called and the view changes

5. **Page header shows view metadata**
   - Given the user is on `/archive`
   - When the page header renders
   - Then it displays "Archive" as the title and "Inspect completed runs and historical results." as the subtitle

6. **Devtools in dev mode only**
   - Given `import.meta.env.DEV` is true
   - When the root layout renders
   - Then `TanStackRouterDevtools` is visible

## Metadata
- **Complexity**: High
- **Labels**: routing, layout, desktop
