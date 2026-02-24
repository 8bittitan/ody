---
status: completed
created: 2026-02-24
started: 2026-02-24
completed: 2026-02-24
---
# Task: Fix Editor Cursor Reset on Every Keystroke

## Description
The CodeMirror-based task editor resets the cursor position to the start of the file on every keystroke. This makes the editor effectively unusable for editing task files, as the user cannot maintain their position while typing. The root cause is that unstable callback references in the parent component cause the CodeMirror initialization `useEffect` to destroy and recreate the editor view on every render cycle.

## Background
The desktop app uses a `MarkdownEditor` component (`packages/desktop/src/renderer/components/editor/MarkdownEditor.tsx`) built on CodeMirror 6. The component receives `value`, `onChange`, `onInlinePrompt`, and `onHistoryChange` props from `TaskEditor.tsx`. The CodeMirror `EditorView` is created inside a `useEffect` whose dependency array includes these callback props. When any dependency reference changes, the effect cleanup destroys the `EditorView` and the next run creates a fresh one — resetting cursor position, scroll position, and undo history.

The `TaskEditor` component passes `onInlinePrompt` and `onHistoryChange` as inline arrow functions, which create new references on every render. Since typing triggers `onChange` → `setContent` → re-render → new callback references → effect cleanup → editor destruction → editor recreation, the cursor resets on every keystroke.

## Technical Requirements
1. The `MarkdownEditor` component must NOT destroy and recreate the CodeMirror `EditorView` when callback props change
2. The CodeMirror initialization `useEffect` must only depend on truly static values (the container mount, `language`)
3. Mutable props (`onChange`, `onInlinePrompt`, `onHistoryChange`, `readOnly`, `highlightedRange`, `value`) must be handled through CodeMirror's reconfiguration API or stable refs — not by tearing down the editor
4. Cursor position, scroll position, and undo history must be preserved across all normal editing interactions
5. External value changes (e.g., after accepting an AI edit) must still update the editor content correctly

## Dependencies
- `@codemirror/state` — `Compartment` for dynamic reconfiguration of extensions
- `@codemirror/view` — `EditorView` for dispatching reconfigurations
- `@codemirror/commands` — undo/redo depth queries for history sync
- React `useRef` for storing stable references to mutable callbacks

## Implementation Approach
1. **Store callbacks in refs instead of closing over them in the effect**: Create `useRef` holders for `onChange`, `onInlinePrompt`, `onHistoryChange`, and `syncHistory`. Update the ref values on every render (or in a layout effect). The CodeMirror extensions will read from the refs, ensuring stable closures that always call the latest callback.

2. **Remove unstable dependencies from the initialization useEffect**: Strip `onChange`, `onInlinePrompt`, `syncHistory`, `highlightedRange`, `readOnly`, and `value` from the dependency array of the `useEffect` at `MarkdownEditor.tsx:112`. The effect should only depend on `language` (which determines the parser extension and is static per editor session). The `value` prop is only needed for the initial `doc:` — use a ref to capture the initial value.

3. **Use Compartments for all dynamic extensions**: The component already uses `readOnlyCompartment` and `highlightCompartment`. Add a new `keymapCompartment` for the Cmd+K keymap binding that calls `onInlinePrompt`. This allows updating the inline prompt handler without recreating the editor.

4. **Wire up the updateListener through a ref**: The `EditorView.updateListener` extension should call `onChangeRef.current(...)` and `syncHistoryRef.current(...)` instead of directly referencing the `onChange` and `syncHistory` closures. This way the listener extension is stable but always invokes the latest callback.

5. **Memoize callbacks in TaskEditor.tsx as a complementary fix**: Wrap `onInlinePrompt` and `onHistoryChange` in `useCallback` in `TaskEditor.tsx` (lines 228-238) so they don't create new references unnecessarily. This is a defense-in-depth measure — the ref-based approach in `MarkdownEditor` is the primary fix.

6. **Keep the value-sync useEffect unchanged**: The existing `useEffect` at `MarkdownEditor.tsx:165` that dispatches content changes when `value` differs from the current doc is already correct. It only fires when `value` actually changes and correctly checks `value === currentValue` to avoid no-op dispatches.

7. **Verify no regressions in readOnly and highlight reconfiguration**: The existing `useEffect` blocks for `readOnly` (line 184) and `highlightedRange` (line 194) use Compartment reconfiguration and should continue working as-is, since they don't depend on callback stability.

## Acceptance Criteria

1. **Cursor stays in place while typing**
   - Given the task editor is open with a file loaded
   - When the user places the cursor at an arbitrary position and types characters
   - Then the cursor advances naturally with each character and does not jump to the start of the file

2. **Undo history is preserved during editing**
   - Given the user has typed several words in the editor
   - When the user presses Cmd+Z
   - Then the last change is undone and the cursor moves to the correct position (not the start)

3. **Scroll position is preserved during editing**
   - Given the user has scrolled to the middle of a long task file and is typing
   - When a keystroke occurs
   - Then the viewport does not jump to the top of the file

4. **External content updates still work**
   - Given the user accepts an AI inline edit that changes the file content
   - When the editor transitions from review mode back to edit mode
   - Then the editor displays the updated content correctly

5. **Cmd+K inline prompt still works**
   - Given the user selects text and presses Cmd+K
   - When the inline prompt overlay appears
   - Then the selection range is correctly captured and the highlight decoration is applied

6. **Undo/Redo toolbar buttons remain functional**
   - Given the user makes edits in the editor
   - When they click Undo or Redo in the toolbar
   - Then the editor correctly undoes or redoes the last change and the toolbar button states update

## Metadata
- **Complexity**: Medium
- **Labels**: bug, desktop, editor, codemirror, ux
