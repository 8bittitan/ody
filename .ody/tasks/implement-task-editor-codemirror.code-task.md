---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement Task Editor with CodeMirror 6

## Description
Build the Task Editor view powered by CodeMirror 6 with markdown syntax highlighting, manual editing support, save/undo/redo toolbar, and file persistence via IPC. This is the base editing experience before AI integration is added.

## Background
The Task Editor opens when clicking "Edit" on a task card. It provides a full-width CodeMirror 6 editor with markdown support for `.code-task.md` files. The editor toolbar shows a back button, filename, Save button, undo/redo buttons, an "AI Edit" button (wired in a later task), and an "Open in Terminal" action. File changes are saved via the `editor:save` IPC channel. The editor uses `@codemirror/lang-markdown` for syntax highlighting and custom theming matching the Art Deco design.

## Technical Requirements
1. Create `src/renderer/components/TaskEditor.tsx` -- full editor view container
2. Create `src/renderer/components/editor/MarkdownEditor.tsx` -- CodeMirror 6 wrapper
3. Create `src/renderer/components/editor/EditorToolbar.tsx` -- toolbar component
4. Create `src/renderer/hooks/useEditor.ts` -- editor state management
5. Wire `editor:save` and `editor:snapshot` IPC handlers in main process
6. CodeMirror setup:
   - `@codemirror/lang-markdown` for syntax highlighting, folding, list continuation
   - `@codemirror/theme-one-dark` as base dark theme (or custom Art Deco theme)
   - Standard extensions: line numbers, highlight active line, bracket matching, search
   - History extension for undo/redo
7. Editor toolbar:
   - Back button (returns to Task Board)
   - Filename display
   - Save button (Cmd+S shortcut)
   - Undo/Redo buttons
   - "AI Edit" button (placeholder, wired in editor-ai-integration task)
   - "Open in Terminal" action (placeholder, wired in pty-terminal task)
   - Dirty state indicator (unsaved changes)
8. File persistence:
   - Load file content on editor open via `tasks:read` IPC
   - Save via `editor:save` IPC (writes to disk)
   - Track dirty state (unsaved changes)
   - Cmd+S keyboard shortcut for save
9. Custom Art Deco editor theme matching the design system colors

## Dependencies
- `implement-task-board` task must be completed
- `implement-ipc-layer-and-preload` task must be completed
- `setup-tailwind-shadcn-design-system` task must be completed

## Implementation Approach
1. Implement main process IPC handlers:
   - `editor:save`: write content to file path via `fs.writeFile()`
   - `editor:snapshot`: read file content and store as snapshot for later rollback, return content
2. Build `MarkdownEditor.tsx`:
   ```typescript
   import { EditorView, basicSetup } from 'codemirror';
   import { markdown } from '@codemirror/lang-markdown';
   import { oneDark } from '@codemirror/theme-one-dark';
   import { EditorState } from '@codemirror/state';
   
   // Create editor view with extensions
   // Mount to a ref div
   // Expose view for parent access (undo/redo/content)
   ```
3. Create custom Art Deco theme extension:
   - Background: card color
   - Text: light color for default text
   - Selection: accent-bg
   - Cursor: accent color
   - Line numbers: dim color
   - Active line: subtle accent highlight
4. Build `EditorToolbar.tsx`:
   - Back button navigates to Task Board (updates active view in store)
   - Save button calls `editor:save` IPC
   - Undo/Redo call `view.dispatch()` with undo/redo commands
   - Dirty indicator: compare current content to last saved content
5. Build `TaskEditor.tsx`:
   - Load task content on mount via `tasks:read`
   - Pass content to `MarkdownEditor`
   - Pass toolbar actions
   - Handle navigation guard (warn on unsaved changes)
6. Implement `useEditor` hook:
   - Track editor state: content, dirty, file path
   - Save action: call IPC, update dirty state
   - Snapshot action: call IPC, store for rollback

## Acceptance Criteria

1. **Editor Opens With Content**
   - Given a task file
   - When clicking "Edit" on its card
   - Then the editor opens with the file's markdown content and syntax highlighting

2. **Manual Editing**
   - Given the editor with loaded content
   - When typing changes
   - Then the dirty indicator appears and content updates in real-time

3. **Save Persists**
   - Given an editor with unsaved changes
   - When clicking Save or pressing Cmd+S
   - Then the file is written to disk and dirty indicator clears

4. **Undo/Redo Works**
   - Given editing operations
   - When clicking Undo
   - Then the last change is reverted, and Redo restores it

5. **Art Deco Theme**
   - Given the editor
   - When viewing it
   - Then colors match the Art Deco design system (dark background, accent cursor, proper text colors)

## Metadata
- **Complexity**: High
- **Labels**: editor, codemirror, ui, desktop
