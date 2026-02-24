---
status: completed
created: 2026-02-24
started: 2026-02-24
completed: 2026-02-24
---
# Task: Replace CodeMirror with Rendered Markdown Editor

## Description
Replace the current CodeMirror-based raw source editing on the task edit page with a rich-text/WYSIWYG markdown editor that displays rendered markdown content. Users should edit the visually rendered output (headings, bold, lists, etc.) rather than raw markdown syntax. The AI inline edit flow must continue to work as it does today, operating on the underlying markdown source. CodeMirror should be fully removed from the editor view (though it may remain for the diff review view if needed).

## Background
The task editor currently uses CodeMirror 6 with `@codemirror/lang-markdown` to provide syntax-highlighted raw markdown editing. While functional, this requires users to work directly with markdown syntax rather than seeing a rendered preview. The edit page lives in `TaskEditor.tsx` and delegates to `MarkdownEditor.tsx` (a CodeMirror wrapper). The AI edit flow sends the raw markdown content to the backend via IPC (`agent:editInline`), which returns modified file content extracted from `<modified_file>` tags. The diff review step uses `@codemirror/merge` in `DiffView.tsx` for side-by-side comparison. The task detail dialog in `TaskDetailDialog.tsx` already has a basic hand-rolled markdown renderer (`parseMarkdownSections` / `renderSectionBody`) for read-only display, but it only covers a subset of markdown patterns.

## Technical Requirements
1. Replace the CodeMirror editor in the task edit view with a rich-text markdown editor that renders headings, bold/italic, lists (ordered and unordered), code blocks, links, and horizontal rules as styled visual elements
2. The editor must support editing the YAML frontmatter block (`---...---`) — either as a collapsible raw text section or as structured form fields at the top of the editor
3. The editor must produce valid markdown source text that can be serialized back to disk in `.code-task.md` format
4. The AI inline edit flow must continue to function: when the user triggers AI edit (Cmd+K or toolbar button), the editor must provide the full raw markdown content and optional selection range to `api.agent.editInline`, exactly as it does today
5. The diff review mode (`DiffView.tsx`) may continue using `@codemirror/merge` for now, since it operates on raw text comparison — this is acceptable
6. The `MarkdownEditorHandle` imperative API (`undo`, `redo`, `focus`, `getSelectionRange`) must be preserved or replaced with equivalent functionality so `EditorToolbar.tsx` and `TaskEditor.tsx` continue to work
7. Remove all CodeMirror dependencies from the main editor view (`MarkdownEditor.tsx`). CodeMirror packages used only by `DiffView.tsx` may be retained
8. The editor must support read-only mode (used during AI edit execution) by toggling editability without destroying the editor instance

## Dependencies
- **Rich-text markdown editor library**: A library such as Milkdown (ProseMirror-based, markdown-native), Tiptap (ProseMirror-based with markdown extension), or BlockNote is needed. The chosen library must support bidirectional markdown serialization (parse markdown to rich editor state, serialize editor state back to markdown)
- **Existing AI edit IPC contract**: The `agent:editInline` IPC handler in `packages/desktop/src/main/ipc.ts:824` expects `{ filePath, fileContent, selection, instruction }` and returns modified content — this contract must remain unchanged
- **Existing inline edit prompt builder**: `internal/builders/src/inlineEditPrompt.ts` constructs the prompt from raw markdown — no changes needed as long as raw markdown is passed through
- **useEditor hook**: `packages/desktop/src/renderer/hooks/useEditor.ts` manages editor state transitions (`edit` / `prompt` / `review`) and must integrate with the new editor component
- **DiffView**: `packages/desktop/src/renderer/components/editor/DiffView.tsx` uses `@codemirror/merge` and can remain as-is for the review step

## Implementation Approach
1. **Evaluate and select a rich-text markdown editor library** — compare Milkdown, Tiptap+markdown, and BlockNote for: markdown round-trip fidelity, React 19 compatibility, frontmatter handling, programmatic content get/set, read-only toggle, undo/redo API, and selection range access. Select the library that best preserves the existing markdown structure of `.code-task.md` files without lossy transformations
2. **Create a new `RichMarkdownEditor` component** in `packages/desktop/src/renderer/components/editor/` that wraps the chosen library. It must accept the same props interface as the current `MarkdownEditor` (`content`, `onChange`, `readOnly`, `language`, `onInlinePrompt`, `onHistoryChange`) and expose the same imperative handle (`undo`, `redo`, `focus`, `getSelectionRange`). The `getSelectionRange` must return character offsets into the raw markdown string, not the rich-text DOM positions
3. **Handle YAML frontmatter** — strip the `---...---` frontmatter block before passing content to the rich editor, and prepend it back when serializing. Display it either as a collapsible raw-text input at the top of the editor or as structured metadata fields (status, created, started, completed)
4. **Integrate `RichMarkdownEditor` into `TaskEditor.tsx`** — replace the `<MarkdownEditor>` component reference in the `edit` mode branch. Ensure the `editorRef` works with the new imperative handle. Verify that the `Cmd+K` shortcut and toolbar AI Edit button still trigger `beginInlinePrompt` with the correct selection
5. **Verify AI edit round-trip** — when submitting an inline edit, confirm that `useEditor.submitInlineEdit()` receives the correct raw markdown from the new editor's serialization. After the AI returns modified content, confirm that the diff review (`DiffView.tsx`) displays the correct original vs. proposed comparison, and that accepting the result loads the new markdown back into the rich editor
6. **Update or remove `MarkdownEditor.tsx`** — if `DiffView.tsx` does not directly depend on `MarkdownEditor.tsx` (it uses its own `MergeView`), delete `MarkdownEditor.tsx` entirely. Remove unused CodeMirror imports from the editor toolbar and theme files. Clean up `package.json` to remove CodeMirror packages not needed by `DiffView.tsx`
7. **Style the rich editor** to match the existing editor theme — use the CSS custom properties from `theme.ts` (`--syntax-keyword`, `--syntax-heading`, etc.) or Tailwind classes to ensure visual consistency with the rest of the app. Ensure the editor fills the available space and respects the current layout
8. **Test edge cases** — verify: empty documents, documents with only frontmatter, large documents, documents with code blocks containing markdown-like syntax, undo/redo across AI edit accept/reject cycles, rapid Cmd+K triggers, and read-only mode toggle during AI execution

## Acceptance Criteria

1. **Rendered Editing**
   - Given the user opens a `.code-task.md` file in the editor
   - When the editor loads
   - Then headings, bold text, lists, code blocks, and other markdown elements are displayed as rendered/styled content, not as raw markdown syntax

2. **Markdown Round-Trip Fidelity**
   - Given the user opens a task file, makes no changes, and saves
   - When the file is written to disk
   - Then the markdown content is identical to the original (no whitespace drift, no reordering, no structural changes)

3. **AI Inline Edit Still Works**
   - Given the user presses Cmd+K and types an instruction
   - When the AI edit completes
   - Then the diff review shows the correct original and proposed content, and accepting the change updates the rendered editor with the new content

4. **Frontmatter Preserved**
   - Given a task file with YAML frontmatter
   - When the user edits the body and saves
   - Then the frontmatter block is preserved exactly as it was (or as modified through a dedicated frontmatter UI)

5. **Undo/Redo Functional**
   - Given the user makes several edits in the rendered editor
   - When the user clicks Undo in the toolbar or uses Cmd+Z
   - Then the previous state is restored, and Redo reverses the undo

6. **CodeMirror Removed from Edit View**
   - Given the updated codebase
   - When reviewing the editor view imports and dependencies
   - Then no CodeMirror packages are imported in the main edit mode components (CodeMirror may remain in DiffView only)

7. **Read-Only Mode During AI Execution**
   - Given the user submits an AI edit instruction
   - When the AI is processing
   - Then the editor is non-editable and returns to editable state when the AI completes or the user cancels

## Metadata
- **Complexity**: High
- **Labels**: desktop, editor, ui, markdown, refactor
