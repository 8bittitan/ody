---
status: completed
created: 2026-02-24
started: 2026-02-24
completed: 2026-02-24
---
# Task: Rewrite RichMarkdownEditor with @milkdown/react Bindings

## Description
The `RichMarkdownEditor` component currently uses the vanilla Milkdown API (`Editor.make()`) inside a `useEffect` with an async IIFE, manual lifecycle management, and several imperative `view.setProps()` calls for keyboard handlers and dispatch interception. This is fragile and hard to maintain. The `@milkdown/react` package is already installed (`^7.18.0`) but entirely unused. Rewrite the component to use the official React bindings (`MilkdownProvider`, `useEditor`, `useInstance`, `<Milkdown />`) for a cleaner, more idiomatic integration.

## Background
The desktop app has a rich-text markdown editor at `packages/desktop/src/renderer/components/editor/RichMarkdownEditor.tsx` built on Milkdown (ProseMirror-based). The component receives `value`, `onChange`, `readOnly`, `onInlinePrompt`, and `onHistoryChange` props from `TaskEditor.tsx`. It exposes an imperative handle (`undo`, `redo`, `focus`, `getSelectionRange`) via `forwardRef`/`useImperativeHandle`. The editor supports YAML frontmatter (split/join before passing to Milkdown), Cmd+K inline AI edit prompting, and undo/redo history state reporting.

The current vanilla approach:
- Dynamically imports `Editor` from `@milkdown/kit/core` in an async IIFE inside `useEffect`
- Manually manages a `containerRef` DOM element, `editorRef`, and `editorReadyRef` for lifecycle
- Calls `editor.destroy()` in the cleanup function
- Uses multiple `view.setProps()` calls to wire keyboard handlers and `dispatchTransaction` interception
- Requires careful coordination of refs to avoid stale closures

The `@milkdown/react` package (v7.18.0) provides:
- `MilkdownProvider` — React context provider for editor state
- `useEditor(factory, deps)` — hook that receives a factory `(container: HTMLElement) => Editor` and manages creation/cleanup
- `useInstance()` — returns `[loading, getEditor]` for imperative access to the editor
- `<Milkdown />` — component that renders the `<div data-milkdown-root>` mount point

## Technical Requirements
1. Replace the manual `useEffect`-based editor initialization with `useEditor()` from `@milkdown/react`
2. Replace manual `editorRef` / `editorReadyRef` tracking with `useInstance()` returning `[loading, getEditor]`
3. Replace the manual `containerRef` div with the `<Milkdown />` component
4. Remove the dynamic `await import('@milkdown/kit/core')` — use static imports since `useEditor` handles async creation internally
5. Wrap the editor subtree in `<MilkdownProvider>` so the hooks have access to context
6. Preserve the exact same public API: `RichMarkdownEditorProps`, `RichMarkdownEditorHandle`, and `displayName`
7. Preserve all existing functionality: frontmatter handling, Cmd+K inline prompt, history reporting, readOnly sync, external value sync, undo/redo/focus/getSelectionRange imperative methods
8. Preserve the CSS class `milkdown-editor` on the container div wrapping the editor for existing styles in `globals.css`
9. No changes to any consuming components (`TaskEditor.tsx`, `EditorToolbar.tsx`, etc.)

## Dependencies
- `@milkdown/react` — `MilkdownProvider`, `Milkdown`, `useEditor`, `useInstance` (already installed at `^7.18.0`)
- `@milkdown/kit/core` — `Editor`, `defaultValueCtx`, `editorViewCtx`, `rootCtx` (already used)
- `@milkdown/kit/plugin/history` — `history`, `undoCommand`, `redoCommand` (already used)
- `@milkdown/kit/plugin/listener` — `listener`, `listenerCtx` (already used)
- `@milkdown/kit/preset/commonmark` — `commonmark` (already used)
- `@milkdown/kit/prose/history` — `undoDepth`, `redoDepth` (already used)
- `@milkdown/kit/utils` — `callCommand`, `getMarkdown`, `replaceAll` (already used)

## Implementation Approach

### Architecture: Two-component split

Because `useEditor` and `useInstance` must be called inside a `<MilkdownProvider>`, split the current monolithic component into:

1. **`RichMarkdownEditor`** (outer) — the public component. Wraps everything in `<MilkdownProvider>`, handles frontmatter UI, and delegates to `InnerEditor`.
2. **`InnerEditor`** (inner, same file) — uses `useEditor()` to set up the editor with plugins, and `useInstance()` to power the imperative handle. The outer component forwards `ref` to this inner component.

### Step-by-step

1. **Replace imports**: Remove the `Editor` type import (no longer needed separately). Add imports from `@milkdown/react`: `Milkdown`, `MilkdownProvider`, `useEditor`, `useInstance`. Remove `forwardRef` dependency on the outer component pattern (still needed for `InnerEditor`).

2. **Keep unchanged**: `SelectionRange` type, `RichMarkdownEditorProps`, `RichMarkdownEditorHandle`, frontmatter helpers (`FRONTMATTER_RE`, `splitFrontmatter`, `joinFrontmatter`), and `mapSelectionToMarkdown` function.

3. **Create `InnerEditor`** as a `forwardRef` component accepting props:
   - `body: string` — the markdown body (frontmatter already stripped)
   - `frontmatterRef: React.RefObject<string>` — current frontmatter for selection offset calculations
   - `onChangeRef: React.RefObject<(v: string) => void>` — stable ref to onChange
   - `onInlinePromptRef: React.RefObject<...>` — stable ref to onInlinePrompt
   - `onHistoryChangeRef: React.RefObject<...>` — stable ref to onHistoryChange
   - `readOnly: boolean`

4. **Inside `InnerEditor`**:
   - Call `useEditor((root) => Editor.make().config(...).use(commonmark).use(listener).use(history), [])` with an empty dependency array (editor is created once, refs handle mutable callbacks).
   - Call `useInstance()` to get `[loading, getEditor]`.
   - Use a `useEffect` that fires when `loading` becomes `false` to wire up Cmd+K keyboard handler and `dispatchTransaction` interception (same logic as current code, using `getEditor()`).
   - Implement `useImperativeHandle(ref, ...)` using `getEditor()` and `loading` for guard checks (same imperative methods as current code).
   - Use a `useEffect` on `[body, loading, getEditor]` to sync external value changes via `replaceAll`.
   - Use a `useEffect` on `[readOnly, loading, getEditor]` to sync readOnly via `view.setProps({ editable })`.
   - Render `<Milkdown />` (the mount point component).

5. **Rewrite `RichMarkdownEditor`**:
   - Split value into `frontmatter` and `body` using `splitFrontmatter(value)`.
   - Maintain `frontmatterRef`, `onChangeRef`, `onInlinePromptRef`, `onHistoryChangeRef` as stable refs updated on each render.
   - Render the frontmatter collapsible UI (unchanged).
   - Render `<MilkdownProvider>` wrapping a styled div with class `milkdown-editor` containing `<InnerEditor ref={ref} ... />`.
   - The `handleFrontmatterChange` callback uses `splitFrontmatter(value).body` to reconstruct the full content (instead of calling `editor.action(getMarkdown())` which is unavailable outside the provider).

6. **Remove eliminated code**:
   - `editorRef` and `editorReadyRef` refs
   - `initialValueRef` ref
   - The entire `useEffect` at line 164-265 (async IIFE lifecycle)
   - The dynamic `import('@milkdown/kit/core')`
   - The `containerRef` ref and the `<div ref={containerRef}>` mount point

### Key mapping: current vs new

| Concern | Current | New |
|---|---|---|
| Editor lifecycle | `useEffect` + async IIFE + `editor.destroy()` | `useEditor()` hook |
| DOM mount point | `containerRef` div + `ctx.set(rootCtx, container)` | `<Milkdown />` component (root passed to factory) |
| Editor access | `editorRef.current` + `editorReadyRef.current` | `getEditor()` + `loading` from `useInstance()` |
| Imperative handle | `useImperativeHandle` with `editorRef.current` | `useImperativeHandle` with `getEditor()` |
| Value sync | `useEffect` on `value` calling `replaceAll` | `useEffect` on `body` calling `replaceAll` |
| ReadOnly sync | `useEffect` calling `view.setProps` | Same, using `getEditor()` |
| onChange | `listenerCtx.markdownUpdated` in config | Same, inside `useEditor` factory |
| Cmd+K shortcut | `view.setProps({ handleKeyDown })` | Same, in `useEffect` after editor ready |
| History reporting | `view.setProps({ dispatchTransaction })` | Same, in `useEffect` after editor ready |
| Dynamic import | `await import('@milkdown/kit/core')` | Static import (useEditor handles async) |

## Acceptance Criteria

1. **Editor renders and is editable**
   - Given the user opens a `.code-task.md` file in the editor
   - When the editor loads
   - Then headings, bold text, lists, and other markdown elements are rendered as rich text (same as before)
   - And the user can type and edit content normally

2. **AI Inline Edit still works (Cmd+K)**
   - Given the user selects text and presses Cmd+K
   - When the inline prompt overlay appears
   - Then the selection range is correctly captured as raw markdown character offsets
   - And submitting an AI edit instruction produces a diff review with correct original vs. proposed content
   - And accepting the change updates the editor with the new content

3. **AI Edit toolbar button still works**
   - Given the user clicks the AI Edit button in the toolbar
   - When `editorRef.current.getSelectionRange()` is called
   - Then it returns the correct selection range (or null if no selection)
   - And the inline prompt flow proceeds correctly

4. **Undo/Redo functional**
   - Given the user makes several edits
   - When the user clicks Undo/Redo in the toolbar or uses Cmd+Z / Cmd+Shift+Z
   - Then the previous/next state is restored
   - And the toolbar button states (`canUndo`, `canRedo`) update correctly via `onHistoryChange`

5. **ReadOnly mode during AI execution**
   - Given the user submits an AI edit instruction
   - When `readOnly={true}` is passed to the editor
   - Then the editor becomes non-editable
   - And it returns to editable when `readOnly` becomes `false`

6. **Frontmatter preserved**
   - Given a task file with YAML frontmatter
   - When the user edits the body and saves
   - Then the frontmatter block is preserved exactly
   - And editing the frontmatter via the collapsible section updates the full content correctly

7. **External value sync**
   - Given the parent component updates the `value` prop (e.g., after accepting an AI edit)
   - When the editor receives the new value
   - Then the editor content updates to reflect the new body without destroying the editor instance

8. **No consumer changes required**
   - Given the updated `RichMarkdownEditor`
   - When reviewing `TaskEditor.tsx` and other consuming components
   - Then no changes are needed — the props interface and imperative handle are identical

9. **CSS styling preserved**
   - Given the editor renders
   - When inspecting the DOM
   - Then the `milkdown-editor` class is present on the wrapping container
   - And all existing styles from `globals.css` apply correctly

## Files Modified
- `packages/desktop/src/renderer/components/editor/RichMarkdownEditor.tsx` — full rewrite of component internals

No other files need to change.

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, editor, milkdown, react, refactor
