---
status: completed
created: 2026-02-24
started: 2026-02-24
completed: 2026-02-24
---
# Task: Replace Project Switcher with Base UI Dropdown Menu

## Description
Replace the current sidebar project list (a vertical stack of buttons with a hand-rolled context menu) with a single Base UI dropdown menu. The dropdown trigger displays the active project name and, when opened, lists all projects with options to switch, copy path, remove, or add a new project. This consolidates the project switching UI into a compact, consistent control that works identically in both expanded and collapsed sidebar modes.

## Background
The sidebar (`Sidebar.tsx`) currently renders projects as a vertical button list inside a dedicated `<section>`. In expanded mode it shows project name buttons; in collapsed mode it shows circular initial-letter buttons with tooltips. Right-clicking any project opens a custom absolute-positioned context menu (`div` at lines 322-358) with "Open", "Copy Path", and "Remove" actions. This hand-rolled menu does not use any Base UI primitive, while the rest of the application has been fully migrated to `@base-ui/react`.

The project already has a fully-styled `DropdownMenu` component built on `@base-ui/react/menu` at `packages/desktop/src/renderer/components/ui/dropdown-menu.tsx`. It exports `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, and related sub-components. This component is battle-tested and handles portal rendering, positioning, animations, keyboard navigation, and focus management out of the box.

The `Sidebar` receives `projects`, `activeProjectPath`, `onProjectSelect`, `onAddProject`, `onRemoveProject`, and `onCopyProjectPath` as props, all wired from `Layout.tsx` through the `useProjects` hook. The project switching flow includes a confirmation dialog when an agent is running (handled in `Layout.tsx` lines 203-231), which must remain intact.

## Technical Requirements
1. Replace the project button list and hand-rolled context menu in `Sidebar.tsx` with a single `DropdownMenu` component from `@/components/ui/dropdown-menu`.
2. The dropdown trigger must display the active project name (expanded mode) or the active project's initial letter (collapsed mode), styled consistently with the existing sidebar design tokens.
3. The dropdown content must list all projects as radio-style items (using `DropdownMenuRadioGroup` and `DropdownMenuRadioItem`) with the active project indicated, so clicking a project switches to it.
4. Include a separator and action items for each project: "Copy Path" and "Remove" (destructive variant) for the currently hovered/focused project, or alternatively place these as secondary actions accessible per-item.
5. Include an "Add Project" item at the bottom of the dropdown (separated), triggering `onAddProject`.
6. Remove all hand-rolled context menu state (`contextMenu` useState, the `useEffect` for click/blur/keydown listeners, and the absolute-positioned context menu `div`).
7. The dropdown must remain keyboard-accessible: navigable with arrow keys, selectable with Enter, dismissible with Escape.
8. No new dependencies -- `@base-ui/react` and the local `dropdown-menu.tsx` wrapper are already available.
9. The `SidebarProps` interface must remain unchanged -- all existing callback props are still used.
10. The existing project switch confirmation dialog in `Layout.tsx` must continue to work (it intercepts `onProjectSelect` when an agent is running).

## Dependencies
- `@/components/ui/dropdown-menu` -- the project's existing Base UI Menu wrapper (`packages/desktop/src/renderer/components/ui/dropdown-menu.tsx`), exporting `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, and related components.
- `@base-ui/react` v1.2.0+ -- already installed in `packages/desktop/package.json`.
- `Sidebar.tsx` props: `projects` (`Project[]`), `activeProjectPath` (`string | null`), `onProjectSelect`, `onAddProject`, `onRemoveProject`, `onCopyProjectPath` -- all passed from `Layout.tsx`.
- `useProjects` hook (`packages/desktop/src/renderer/hooks/useProjects.ts`) -- no changes needed, but its return values drive the sidebar.
- `Layout.tsx` orchestration (lines 193-231) -- the `handleProjectSelect` guard for running agents must remain intact and untouched.

## Implementation Approach
1. **Add imports** -- In `Sidebar.tsx`, import `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, and `DropdownMenuRadioGroup`/`DropdownMenuRadioItem` from `@/components/ui/dropdown-menu`. Add the `FolderOpen`, `Copy`, `Trash2`, and `ChevronDown` icons from `lucide-react` (or reuse existing imports as applicable).
2. **Remove context menu state** -- Delete the `contextMenu` useState, the `useEffect` that manages click/blur/keydown listeners (lines 79-109), the `contextProject` derivation (lines 111-113), and the hand-rolled context menu JSX (lines 322-358).
3. **Build the dropdown trigger (expanded mode)** -- Replace the project button list section (lines 167-219) with a `DropdownMenu` + `DropdownMenuTrigger`. The trigger should be a button displaying the active project name (or "Select project" if none) with a `ChevronDown` indicator, styled to match the sidebar's `text-xs`, `text-light`/`text-primary` tokens and fill the available width.
4. **Build the dropdown trigger (collapsed mode)** -- Replace the collapsed project icon buttons (lines 123-166) with a single `DropdownMenu` + `DropdownMenuTrigger` showing the active project's initial letter inside a circular button (matching the existing `size-8 rounded-md` style), wrapped in a `Tooltip`.
5. **Build the dropdown content** -- Inside `DropdownMenuContent`:
   - Add a `DropdownMenuLabel` showing "Projects".
   - Add a `DropdownMenuSeparator`.
   - Render a `DropdownMenuRadioGroup` with `value={activeProjectPath}` and `onValueChange={onProjectSelect}`. Each project is a `DropdownMenuRadioItem` with `value={project.path}` displaying the project name.
   - Add a `DropdownMenuSeparator`.
   - For each project (or for the selected project), provide "Copy Path" (`DropdownMenuItem` calling `onCopyProjectPath`) and "Remove" (`DropdownMenuItem` with `variant="destructive"` calling `onRemoveProject`).
   - Add a final `DropdownMenuSeparator` followed by an "Add Project" `DropdownMenuItem` with a `Plus` icon, calling `onAddProject`.
6. **Preserve the "+ Add" affordance** -- Keep the add-project button visible both inside the dropdown (as the last item) and optionally outside the trigger for quick access in expanded mode, depending on design preference.
7. **Verify loading state** -- When `isLoadingProjects` is true, show a loading indicator or disabled state on the trigger instead of the previous "Loading projects..." text.
8. **Verify empty state** -- When `projects.length === 0` and not loading, the trigger should show "No projects" or similar, and the dropdown should only show the "Add Project" item.
9. **Lint and format** -- Run `bunx oxlint src` and `bunx oxfmt -w src` from `packages/desktop` to ensure the change passes project linting and formatting rules.
10. **Manual QA** -- Verify the dropdown opens and closes correctly, project switching works, the running-agent confirmation dialog still triggers, keyboard navigation works, and the component renders cleanly in both sidebar modes.

## Acceptance Criteria

1. **Dropdown replaces button list**
   - Given the user views the sidebar in expanded mode
   - When the projects section renders
   - Then a single dropdown trigger (showing the active project name) replaces the previous vertical project button list

2. **Collapsed mode trigger**
   - Given the sidebar is collapsed
   - When the user views the projects area
   - Then a single circular initial-letter button serves as the dropdown trigger (matching the existing collapsed style)

3. **Project list in dropdown**
   - Given there are multiple projects
   - When the user opens the dropdown
   - Then all projects appear as selectable items with the active project visually indicated (radio indicator or check mark)

4. **Switching projects**
   - Given the user opens the dropdown and clicks a different project
   - When the selection changes
   - Then `onProjectSelect` is called with the new project path, triggering the existing switch flow (including the running-agent guard in Layout.tsx)

5. **Context actions available**
   - Given the user opens the dropdown
   - When viewing project items
   - Then "Copy Path" and "Remove" actions are accessible for projects (either inline per-item or in a sub-section)

6. **Add project from dropdown**
   - Given the user opens the dropdown
   - When they click "Add Project"
   - Then `onAddProject` is called, opening the native folder dialog

7. **Hand-rolled context menu removed**
   - Given the new dropdown is implemented
   - When inspecting the Sidebar component code
   - Then no `contextMenu` state, no manual `window.addEventListener` for click/blur/keydown, and no absolute-positioned context menu `div` remain

8. **Keyboard accessibility**
   - Given a keyboard user
   - When interacting with the project dropdown
   - Then the dropdown opens with Enter/Space, items are navigable with arrow keys, selection works with Enter, and Escape closes the menu

9. **Loading and empty states**
   - Given projects are loading or no projects exist
   - When the dropdown trigger renders
   - Then appropriate feedback is displayed (loading indicator or "No projects" text with only the "Add Project" action available)

10. **Agent running guard preserved**
    - Given an agent is currently running
    - When the user switches projects via the dropdown
    - Then the confirmation dialog from Layout.tsx still appears before the switch is applied

## Metadata
- **Complexity**: Medium
- **Labels**: ui, desktop, base-ui, sidebar, dropdown-menu, project-switching
