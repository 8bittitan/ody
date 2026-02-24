---
status: completed
created: 2026-02-22
started: 2026-02-24
completed: 2026-02-24
---
# Task: Implement Config Panel and Init Wizard

## Description
Build the Configuration view panel (three-layer config display with inline editing) and the Init Wizard (stepped form for first-time setup). The Config panel shows all config values from merged layers with source indicators, while the Init Wizard provides guided initial configuration.

## Background
The Config View displays a three-layer merged config (GUI per-project > local `.ody/ody.json` > global `~/.ody/ody.json`). Each field shows its source: `(gui)`, `(local)`, `(global)`, or `(default)`. Users can save to either the GUI layer (desktop-only, `electron-store`) or global layer (`~/.ody/ody.json`). The Init Wizard is a form matching the CLI's `ody init` flow but with GUI controls: backend dropdown (showing only detected backends), model input (with single/per-command toggle), agent profile, validators list, and integration settings.

## Technical Requirements
1. Create `src/renderer/components/ConfigPanel.tsx` with the full config form
2. Create `src/renderer/components/InitWizard.tsx` as a Dialog-based wizard
3. Wire `config:load`, `config:save`, `config:saveGlobal`, `config:validate`, `config:resetGuiOverrides` IPC handlers in main process with actual logic
4. Wire `backends:available` IPC handler to call `getAvailableBackends()` from `@internal/backends`
5. Config panel features:
   - All config fields as editable form controls
   - Source indicator per field (`(gui)`, `(local)`, `(global)`, `(default)`)
   - Model field: toggle between "Single" and "Per-command" mode
   - Validator commands: dynamic list with add/remove
   - Integration sections (Jira/GitHub): collapsible
   - Two save buttons: "Save to Project" and "Save to Global"
   - "Reset GUI Overrides" button
6. Init Wizard features:
   - Backend selector dropdown (only detected backends)
   - Model text input (with per-command toggle)
   - Agent profile text input (default "build")
   - Validator command dynamic list
   - Skip permissions toggle (Claude only)
   - Tasks directory input
   - Notification preference radio group
   - Jira/GitHub integration sections
   - Preview button (shows JSON)
   - Writes `.ody/ody.json` on completion
7. Show Init Wizard on first launch if no config exists

## Dependencies
- `implement-app-layout-shell` task must be completed
- `implement-ipc-layer-and-preload` task must be completed
- `implement-zustand-store` task must be completed
- `implement-project-management` task must be completed

## Implementation Approach
1. Implement main process config IPC handlers:
   - `config:load`: call `Config.load()` from `@internal/config`, read GUI overrides from `electron-store` keyed by project path, merge and return `{ merged, layers }`
   - `config:save`: write to local `.ody/ody.json` or GUI `electron-store` layer
   - `config:saveGlobal`: write to `~/.ody/ody.json`
   - `config:validate`: use `Config.parse()` from `@internal/config`
   - `config:resetGuiOverrides`: clear `electron-store` entry for active project
   - `backends:available`: call `getAvailableBackends()` from `@internal/backends`
2. Build `ConfigPanel.tsx`:
   - Use `useConfig` hook to load config on mount
   - Render each field with appropriate shadcn control (Input, Select, Switch, RadioGroup)
   - Show source badge next to each field
   - Model toggle: Switch between single Input and three labeled Inputs
   - Validators: list of Input cards with delete buttons, "Add command" input at bottom
   - Save buttons call respective IPC methods
3. Build `InitWizard.tsx`:
   - Wrap in shadcn Dialog
   - Single form with all fields
   - Backend selector calls `backends:available` to populate options
   - Conditional fields (skipPermissions only shown for Claude backend)
   - Preview mode shows formatted JSON
   - Submit writes config via `config:save('local', ...)`
4. Auto-show wizard: in `App.tsx`, check if config exists via `config:load`; if null, open wizard dialog

## Acceptance Criteria

1. **Config Loads and Displays**
   - Given a project with `.ody/ody.json`
   - When opening the Config panel
   - Then all config values are displayed with correct source indicators

2. **Three-Layer Merge**
   - Given global, local, and GUI configs with different values
   - When viewing the Config panel
   - Then the merged result uses correct precedence (GUI > local > global)

3. **Save to Project**
   - Given an edited config value
   - When clicking "Save to Project"
   - Then the GUI override is persisted in electron-store

4. **Init Wizard Generates Config**
   - Given a project without `.ody/ody.json`
   - When completing the Init Wizard
   - Then a valid config file is written to `.ody/ody.json`

5. **Backend Detection**
   - Given the Init Wizard backend selector
   - When opening the dropdown
   - Then only detected backends are shown as options

## Metadata
- **Complexity**: High
- **Labels**: config, init-wizard, ui, desktop
