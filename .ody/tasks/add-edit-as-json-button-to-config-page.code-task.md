---
status: completed
created: 2026-02-24
started: 2026-02-24
completed: 2026-02-24
---
# Task: Add "Edit as JSON" Button to Config Page

## Description
Add an "Edit as JSON" button to the desktop ConfigPanel that opens the local project configuration file (`.ody/ody.json`) in the existing CodeMirror-based editor. The editor should reuse the same settings, theme, and capabilities as the task edit editor (MarkdownEditor with `oneDark` + `artDecoTheme`, undo/redo, Cmd+S save, inline AI editing via Cmd+K). This gives users a way to directly edit the raw JSON config when the form UI is insufficient or when they prefer working with JSON directly.

## Background
The desktop app currently has a `ConfigPanel` component (`packages/desktop/src/renderer/components/ConfigPanel.tsx`) that provides a rich form-based UI for editing configuration. While comprehensive, some users prefer editing the raw JSON directly — especially for complex or bulk changes. The app already has a mature editor infrastructure built around CodeMirror 6 (used by `TaskEditor` for `.code-task.md` files) that includes a themed markdown editor, undo/redo, save handling, inline AI editing, and a toolbar. This task adapts that editor infrastructure to also handle JSON config files.

The current view navigation pattern is state-driven: set target data in the Zustand store, then set `activeView` to switch views. The `TaskEditor` flow (`TaskBoard` -> set `selectedTaskPath` -> set `activeView('editor')`) serves as the template for this new flow.

## Technical Requirements
1. Add an "Edit as JSON" button to the `ConfigPanel` action buttons row (alongside "Save to Project", "Save to Global", and "Reset GUI Overrides")
2. Clicking the button should open the local `.ody/ody.json` file in a CodeMirror editor view
3. The editor must use the same CodeMirror setup as `MarkdownEditor`: `basicSetup`, `oneDark` theme, custom `artDecoTheme`, undo/redo support, history change tracking, and the `Mod-k` inline prompt keybinding
4. Replace the `markdown()` language extension with a JSON language extension (`@codemirror/lang-json`) for syntax highlighting and validation
5. The editor toolbar should include Back, Save, Undo, and Redo buttons (AI Edit and Open in Terminal can be omitted or kept as optional)
6. Cmd+S must save the JSON back to disk
7. After saving, the ConfigPanel form state should refresh to reflect any changes made in the JSON editor
8. The editor must handle JSON parse errors gracefully — if the user writes invalid JSON the save should either warn or be prevented
9. The view transition should follow the existing pattern: store the config file path in state, switch `activeView` to the config editor view

## Dependencies
- `@codemirror/lang-json` package — needs to be added as a dependency to `packages/desktop` (or confirm it's already available)
- Existing `MarkdownEditor` component at `packages/desktop/src/renderer/components/editor/MarkdownEditor.tsx` — to be adapted or extended
- Existing `EditorToolbar` component at `packages/desktop/src/renderer/components/editor/EditorToolbar.tsx` — reused for the toolbar
- Existing `useEditor` hook at `packages/desktop/src/renderer/hooks/useEditor.ts` — to be adapted or a parallel `useConfigEditor` hook created
- IPC handlers: `editor:save` at `packages/desktop/src/main/ipc.ts:1096` for writing, and an existing or new handler for reading the config file path
- Zustand store for view state management (`activeView`, and a new state field for the config editor file path)
- `ConfigPanel` component at `packages/desktop/src/renderer/components/ConfigPanel.tsx` — where the button is added
- `Layout` component at `packages/desktop/src/renderer/components/Layout.tsx` — where the new view is wired into the view switching logic

## Implementation Approach
1. **Install `@codemirror/lang-json`** — Add the CodeMirror JSON language package to `packages/desktop` dependencies. Verify it's compatible with the existing CodeMirror 6 setup.

2. **Create a `JsonEditor` component (or generalize `MarkdownEditor`)** — Either:
   - (a) Create a new `JsonEditor` component in `packages/desktop/src/renderer/components/editor/` that mirrors `MarkdownEditor` but swaps `markdown()` for `json()` from `@codemirror/lang-json`. This is the cleaner approach since JSON and Markdown have different needs. OR
   - (b) Add a `language` prop to `MarkdownEditor` to make it generic (e.g., `language: 'markdown' | 'json'`), switching the language extension accordingly. Rename to `CodeEditor` if going this route.
   - Recommended: Option (b) — generalize the existing editor with a `language` prop to avoid code duplication. Keep the component name as-is or rename to `CodeEditor`.

3. **Create a `useConfigEditor` hook** — Modeled after `useEditor`, but simplified for config files:
   - `loadConfig(projectPath)` — resolves the local `.ody/ody.json` path and reads its content via IPC
   - `save()` — validates JSON syntax before writing, calls `editor:save` IPC handler
   - Tracks `content`, `savedContent`, `isDirty`, `isSaving`, `fileName`
   - Omit inline AI editing state unless desired (can be added later)

4. **Create a `ConfigEditor` view component** — In `packages/desktop/src/renderer/components/ConfigEditor.tsx`:
   - Uses `useConfigEditor` hook for state management
   - Renders `EditorToolbar` (with Back, Save, Undo, Redo; optionally hide AI Edit / Terminal buttons)
   - Renders the generalized editor component with `language="json"`
   - Handles Cmd+S for save
   - On back navigation, reloads the config form state to pick up changes

5. **Add Zustand state for config editor** — In the store or the config slice:
   - Add `configEditorPath: string | null` state field
   - Add `setConfigEditorPath` action

6. **Add "Edit as JSON" button to `ConfigPanel`** — In the action buttons row at the bottom of `ConfigPanel.tsx`:
   - Add a new `Button` with variant `"outline"` labeled "Edit as JSON" with an appropriate icon (e.g., `FileCode` or `Code` from lucide-react)
   - On click, dispatch a custom DOM event or call a callback prop to trigger the view switch

7. **Wire up view switching in `Layout.tsx`** — Add a new `activeView` value (e.g., `'config-editor'`):
   - Pass an `onEditJson` callback from Layout to ConfigPanel
   - In the callback, resolve the local config file path and set it in state, then switch to `'config-editor'` view
   - Render `ConfigEditor` when `activeView === 'config-editor'`
   - On back from `ConfigEditor`, switch back to `'config'` view and reload config

8. **Add IPC support for reading the config file path** — The `config:load` handler already knows the local config path. Either:
   - Expose the resolved local config file path in the `config:load` response
   - Or add a small `config:localPath` handler that returns the path to `.ody/ody.json` for the active project
   - The `editor:save` and `editor:snapshot` handlers can be reused for reading/writing since they work with arbitrary file paths

9. **Handle edge cases** — JSON validation before save (show error toast if invalid), handle missing `.ody/ody.json` (create it on first edit or show a message), and ensure the config form reloads after the JSON editor saves.

## Acceptance Criteria

1. **Button Visibility**
   - Given the user is on the Config page in the desktop app
   - When the page renders
   - Then an "Edit as JSON" button is visible in the action buttons row

2. **Opens JSON Editor**
   - Given the user is on the Config page
   - When they click "Edit as JSON"
   - Then the view switches to a CodeMirror editor displaying the contents of the local `.ody/ody.json` file

3. **Editor Uses Same Settings as Task Editor**
   - Given the JSON editor is open
   - When the editor renders
   - Then it uses the same `oneDark` + `artDecoTheme` theming, `basicSetup`, undo/redo, and toolbar layout as the task edit editor

4. **JSON Syntax Highlighting**
   - Given the JSON editor is open
   - When viewing the config content
   - Then JSON syntax highlighting is applied (keys, strings, numbers, booleans are colored)

5. **Save Works**
   - Given the user has made changes in the JSON editor
   - When they press Cmd+S or click the Save button
   - Then the changes are written to `.ody/ody.json` on disk

6. **Config Form Refreshes After Save**
   - Given the user saved changes in the JSON editor and navigated back
   - When the Config page renders
   - Then the form fields reflect the updated values from the JSON

7. **Invalid JSON Prevention**
   - Given the user has typed invalid JSON in the editor
   - When they attempt to save
   - Then a warning or error toast is shown and the invalid content is not written to disk

8. **Back Navigation**
   - Given the user is in the JSON editor
   - When they click the Back button
   - Then the view returns to the Config page

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, config, editor, ui
