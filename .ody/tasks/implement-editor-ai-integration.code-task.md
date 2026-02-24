---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement Editor AI Integration (Cmd+K Inline Prompt + Diff Review)

## Description
Add the AI-powered inline editing flow to the Task Editor: Cmd+K triggers a floating prompt input, the agent edits the file, and the result is shown in a side-by-side diff view using `@codemirror/merge`. Users can accept or reject the proposed changes.

## Background
The editor has three states: Edit mode (default), Prompt mode (Cmd+K triggered), and Review mode (diff after AI edit). The AI edit flow works by: user optionally selects text, presses Cmd+K, types an instruction, the main process snapshots the file, spawns the backend with `buildInlineEditPrompt()`, streams output, detects completion, reads the modified file, and sends the result back. The renderer shows a side-by-side diff where the proposed side is editable before accepting.

## Technical Requirements
1. Create `src/renderer/components/editor/InlinePrompt.tsx` -- floating prompt input bar
2. Create `src/renderer/components/editor/DiffView.tsx` -- side-by-side diff using `@codemirror/merge`
3. Implement custom CodeMirror keybinding extension for Cmd+K / Ctrl+K
4. Implement custom CodeMirror decoration extension to highlight selected region during prompt mode
5. Implement custom readonly extension to lock editor during agent execution
6. Wire `agent:editInline` IPC handler in main process:
   - Snapshot file on disk
   - Build prompt using `buildInlineEditPrompt()` from `@internal/builders`
   - Spawn configured backend
   - Stream output back via `agent:output` events
   - Detect completion (process exit or `<woof>COMPLETE</woof>` marker)
   - Read modified file from disk
   - Send result via `agent:editResult` event
7. Update `useEditor` hook with AI edit lifecycle:
   - Three editor states: 'edit', 'prompt', 'review'
   - Prompt mode: capture instruction, selection range
   - Review mode: original content (snapshot) vs proposed content (agent result)
   - Accept: save proposed content to disk
   - Reject: restore file from snapshot
8. Handle edge cases:
   - Agent failure: error state with Retry/Cancel buttons, restore snapshot
   - User cancellation mid-edit: kill agent process, restore snapshot
   - Large files: warn if file exceeds ~500KB

## Dependencies
- `implement-task-editor-codemirror` task must be completed
- `extract-internal-builders` task must be completed (for `buildInlineEditPrompt`)

## Implementation Approach
1. Create Cmd+K keybinding extension:
   ```typescript
   import { keymap } from '@codemirror/view';
   
   const inlineEditKeymap = keymap.of([{
     key: 'Mod-k',
     run: (view) => {
       // Get current selection
       // Trigger prompt mode callback
       return true;
     },
   }]);
   ```
2. Create selection highlight decoration:
   - Use `Decoration.mark` with a CSS class applying accent-bg background
   - Active only during prompt mode
3. Build `InlinePrompt.tsx`:
   - Floating div anchored below cursor or at selection top
   - Text input for instruction
   - Enter to submit, Escape to cancel
   - Spinner with "AI is editing..." during agent execution
   - Error state with Retry/Cancel on failure
4. Implement main process `agent:editInline` handler:
   ```typescript
   async function handleEditInline(win, opts) {
     const snapshot = await readFile(opts.filePath, 'utf-8');
     await writeFile(opts.filePath, opts.fileContent, 'utf-8'); // sync editor buffer to disk
     
     const prompt = buildInlineEditPrompt({
       fileContent: opts.fileContent,
       selection: opts.selection,
       instruction: opts.instruction,
     });
     
     const backend = new Backend(config.backend);
     const cmd = backend.buildCommand(prompt, model);
     // spawn, stream output, detect completion
     
     const proposed = await readFile(opts.filePath, 'utf-8');
     win.webContents.send('agent:editResult', proposed);
     await writeFile(opts.filePath, snapshot, 'utf-8'); // restore until user accepts
   }
   ```
5. Build `DiffView.tsx` using `@codemirror/merge`:
   - `MergeView` with original (left, readonly) and proposed (right, editable)
   - Apply Art Deco theme to both panes
   - Addition highlights in green-bg, deletion highlights in red-bg
6. Accept flow: write proposed content to disk via `editor:save`, return to edit mode
7. Reject flow: restore original content in editor, return to edit mode
8. Update `EditorToolbar.tsx`: wire "AI Edit" button to trigger Cmd+K flow

## Acceptance Criteria

1. **Cmd+K Triggers Prompt**
   - Given the editor in edit mode
   - When pressing Cmd+K
   - Then a floating input bar appears near the cursor

2. **Selection Highlighting**
   - Given text is selected when Cmd+K is pressed
   - When the prompt bar appears
   - Then the selection is highlighted with a visual decoration

3. **AI Edit Spawns Agent**
   - Given an instruction is entered in the prompt
   - When pressing Enter
   - Then the agent spawns, the editor becomes read-only, and a spinner is shown

4. **Diff Review**
   - Given the agent completes
   - When the result is received
   - Then a side-by-side diff shows original vs proposed with highlighted changes

5. **Accept Saves Changes**
   - Given the diff review mode
   - When clicking "Accept"
   - Then the proposed content is saved to disk and the editor returns to edit mode

6. **Reject Restores Original**
   - Given the diff review mode
   - When clicking "Reject"
   - Then the original content is restored and the editor returns to edit mode

7. **Error Handling**
   - Given the agent fails during an edit
   - When the error is detected
   - Then the prompt shows an error state with Retry/Cancel, and the file is restored from snapshot

## Metadata
- **Complexity**: High
- **Labels**: editor, ai-edit, codemirror, diff, desktop
