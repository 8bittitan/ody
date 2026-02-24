---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement Settings Modal

## Description
Build the Settings modal accessible from the title bar, providing quick access to the most common configuration fields through a tabbed interface (General, Backend, Validators). This is separate from the full Config View in the sidebar.

## Background
The Settings modal provides a focused, tabbed interface for the most frequently changed settings. It's accessed from the "Settings" button in the custom title bar. The General tab has project directory, max iterations, auto-commit, and sound notifications. The Backend tab shows a radio card list of detected backends with their models. The Validators tab has a dynamic list of validation commands with add/remove functionality.

## Technical Requirements
1. Create a Settings modal component using shadcn Dialog
2. Three tabs using shadcn Tabs:
   - **General**: project directory (read-only + Browse), max iterations (number input), auto-commit toggle (Switch), sound notifications toggle (Switch)
   - **Backend**: radio card list of detected backends (RadioGroup with card-style items), each showing name + model, active backend has accent "Active" badge
   - **Validators**: list of current commands in mono-font cards with hover-revealed remove buttons, "Add" input with Enter key support
3. Wire to config IPC: read from merged config, save changes
4. Sound notifications toggle saves to `electron-store` (desktop-only preference)
5. Backend selection calls `backends:available` to populate the list
6. Modal follows the Art Deco modal pattern: panel bg, edge border, header with gear icon badge, footer with Save/Cancel

## Dependencies
- `implement-config-panel` task must be completed
- `implement-app-layout-shell` task must be completed
- `implement-theme-system` task must be completed

## Implementation Approach
1. Build the modal structure using shadcn Dialog:
   - DialogTrigger in the title bar's "Settings" button
   - DialogContent with 500px width
   - Header: gear icon in accent badge + "Settings" title + "Manage your preferences" subtitle
   - Footer: Cancel (dim text) + "Save Settings" (accent button)
2. General tab:
   - Read-only text input for project directory with "Browse" button (calls native dialog)
   - Number input for max iterations with helper text
   - Switch for auto-commit (maps to `shouldCommit`)
   - Switch for sound notifications (desktop-only, `electron-store`)
3. Backend tab:
   - Call `backends:available` on mount to get list
   - Render each backend as a radio card (RadioGroup.Item styled as Card)
   - Show backend name, associated model name
   - Active backend highlighted with accent border + "Active" Badge
4. Validators tab:
   - Map over `config.validatorCommands`
   - Each command in a mono-font Card with text-light color
   - Hover-revealed "x" remove button (opacity transition)
   - Bottom: Input field + Enter key handler to add new command
   - Toast notification on add/remove
5. Save action: collect form state, save to appropriate config layer via IPC
6. Wire "Settings" button in title bar to open the dialog

## Acceptance Criteria

1. **Modal Opens**
   - Given the title bar
   - When clicking "Settings"
   - Then the Settings modal opens with the General tab active

2. **General Tab**
   - Given the General tab
   - When viewing it
   - Then project directory, max iterations, auto-commit, and sound notifications are displayed

3. **Backend Selection**
   - Given the Backend tab
   - When viewing it
   - Then detected backends are shown as selectable radio cards with the active one highlighted

4. **Validator Management**
   - Given the Validators tab
   - When adding a command and pressing Enter
   - Then it appears in the list; when removing, it disappears with a toast

5. **Settings Persist**
   - Given changes in the Settings modal
   - When clicking "Save Settings"
   - Then the config updates and a success toast appears

## Metadata
- **Complexity**: Medium
- **Labels**: settings, modal, config, ui, desktop
