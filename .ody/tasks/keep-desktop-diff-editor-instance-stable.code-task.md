---
status: pending
created: 2026-03-15
started: null
completed: null
---
# Task: Keep the desktop diff editor instance stable during review edits

## Description
Refactor the desktop diff-review component so it does not destroy and recreate the entire CodeMirror merge editor every time the proposed content changes.

## Background
`packages/desktop/src/renderer/components/editor/DiffView.tsx` currently builds a new `MergeView` inside a React effect and tears it down whenever `original`, `proposed`, or `onProposedChange` changes. In review mode, proposed content can change on each keystroke, which means the merge editor may be repeatedly reinitialized during normal editing.

That is an expensive pattern for large files and rich diff views. It can introduce lag, reset editor state unnecessarily, and create avoidable DOM and editor-instance churn in one of the heaviest parts of the renderer.

## Technical Requirements
1. Initialize the merge editor once per relevant review session instead of once per content change.
2. Update document contents through CodeMirror state transactions or equivalent incremental APIs.
3. Preserve current review-mode editing behavior and `onProposedChange` notifications.
4. Avoid unnecessary DOM resets such as replacing container HTML on normal content updates.
5. Keep the refactor scoped to the desktop diff editor path.

## Dependencies
- `packages/desktop/src/renderer/components/editor/DiffView.tsx` is the primary component to change.
- `packages/desktop/src/renderer/components/TaskEditor.tsx` renders the diff view in AI review mode.
- The existing editor theme setup in `packages/desktop/src/renderer/components/editor/theme.ts` should continue to apply.

## Implementation Approach
1. Split merge-view creation from document-update logic in `DiffView`.
2. Keep references to the live `MergeView` instance and any child editors needed for updates.
3. Dispatch incremental content changes into the left or right document only when inputs actually differ from the current editor state.
4. Stabilize `onProposedChange` handling so content edits do not force full editor re-creation.
5. Verify review mode still supports editing, accepting, and rejecting AI changes without cursor-jump or reset issues.

## Scope Notes
- This task is about diff-review performance, not broader editor UX changes.
- Preserve the current visual layout and review semantics.
- Avoid introducing unrelated editor-framework changes.

## Acceptance Criteria

1. **No full editor rebuild on each keystroke**
   - Given the user is editing proposed content in review mode
   - When the proposed text changes repeatedly
   - Then the merge editor instance remains mounted instead of being destroyed and recreated each time

2. **Large diffs remain usable**
   - Given the review UI is showing a larger file diff
   - When the user scrolls or edits the proposed side
   - Then the UI remains responsive and does not reset the diff view unnecessarily

3. **Review behavior is preserved**
   - Given the user accepts or rejects an AI suggestion
   - When review mode transitions complete
   - Then content updates and callbacks still behave correctly after the refactor

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, editor, codemirror, diff, performance
