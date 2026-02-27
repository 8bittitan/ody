---
status: completed
created: 2026-02-24
started: 2026-02-24
completed: 2026-02-24
---
# Task: Add Task Detail Dialog on Card Click

## Description
Add a dialog to the tasks page that displays the full task details when a user clicks on a task card. Currently, task cards show a summary (title, truncated description, labels, complexity, date) but there is no way to view the complete task content — including the full description, background, technical requirements, implementation approach, acceptance criteria, and metadata — without opening the editor. Clicking anywhere on the card body (outside of the existing Run/Edit/Del action buttons) should open a read-only detail dialog.

## Background
The TaskBoard component (`packages/desktop/src/renderer/components/TaskBoard.tsx`) renders task cards in a Kanban-style board with three columns (Pending, In Progress, Completed). Each card is rendered via `TaskCard.tsx` and shows a summary of the task. The full task content is a markdown file stored on disk as `.code-task.md` and can be retrieved via the existing `tasks:read` IPC channel, which returns `{ filePath, content }`. The `useTasks` hook already exposes a `readTask(filePath)` method that calls this IPC endpoint. The project uses `@base-ui/react/dialog` via a local `ui/dialog.tsx` wrapper, and several dialog patterns already exist in the codebase (run confirmation, delete confirmation, archive confirmation, settings modal). The rendered markdown content should reuse the same styling conventions (Tailwind utility classes, `text-light`, `text-mid`, `text-dim` color tokens) present throughout the desktop app.

## Technical Requirements
1. Clicking on the task card body (the `<article>` element) must open the detail dialog, but clicks on the Run, Edit, Del, and Stop action buttons must NOT trigger the dialog (use `event.stopPropagation()` on those buttons).
2. The dialog must fetch the full task markdown content via `readTask(filePath)` from the `useTasks` hook when opened, displaying a loading state while the content is being fetched.
3. The dialog content should render the raw markdown as structured, styled HTML — parse the markdown sections (Description, Background, Technical Requirements, Dependencies, Implementation Approach, Acceptance Criteria, Metadata) and present them with appropriate headings, lists, and text styling. Use a lightweight approach: either parse sections with simple regex/string splitting or integrate a small markdown renderer (e.g., `react-markdown`). Prefer the simpler approach unless a markdown renderer is already in the project.
4. The dialog must display the task title in the `DialogTitle`, the task status as a colored badge in the header area, and labels/complexity/dates in a metadata strip.
5. The dialog should use `max-w-2xl` to accommodate longer content and include a scrollable content area for task files with extensive details.
6. The dialog must include a footer with a Close button (using the existing `DialogFooter` pattern) and optionally an "Edit" button that invokes `onOpenEditor(task.filePath)` to jump to the editor view.
7. The dialog must be controlled via component state in `TaskBoard.tsx`, following the same pattern used for `runTarget`, `deleteTarget`, and `showArchiveConfirm` (nullable `TaskSummary` state).

## Dependencies
- `packages/desktop/src/renderer/components/ui/dialog.tsx` — existing Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter components built on `@base-ui/react/dialog`
- `packages/desktop/src/renderer/components/TaskCard.tsx` — the card component that needs an `onClick` handler added, with `stopPropagation` on action buttons
- `packages/desktop/src/renderer/components/TaskBoard.tsx` — the board component where the dialog state and rendering will be added
- `packages/desktop/src/renderer/hooks/useTasks.ts` — provides `readTask(filePath)` for fetching full task content via IPC
- `packages/desktop/src/renderer/components/ui/scroll-area.tsx` — for scrollable dialog content area
- `packages/desktop/src/renderer/types/ipc.ts` — `TaskSummary` type definition

## Implementation Approach
1. **Add `onClick` prop to `TaskCard`**: Extend `TaskCardProps` with an `onClick: (task: TaskSummary) => void` callback. Attach it to the `<article>` element's `onClick` handler. Add `event.stopPropagation()` to all existing button `onClick` handlers (Run, Edit, Del, Stop) so they don't bubble up and trigger the card click.
2. **Add detail dialog state to `TaskBoard`**: Introduce a `detailTarget` state (`TaskSummary | null`) in `TaskBoard.tsx`. Pass `setDetailTarget` as the `onClick` prop to each `TaskCard`. When `detailTarget` is set (non-null), open the dialog.
3. **Create a `TaskDetailDialog` component**: Build a new component (either inline in `TaskBoard.tsx` or as a separate file at `packages/desktop/src/renderer/components/TaskDetailDialog.tsx`) that:
   - Accepts `task: TaskSummary | null`, `open: boolean`, `onClose: () => void`, and `onEdit: (filePath: string) => void` props.
   - When `open` becomes `true`, calls `readTask(task.filePath)` and stores the result in local state.
   - Displays a loading spinner while fetching.
   - Once loaded, parses the markdown content into sections using regex (split on `## ` headings) and renders each section with proper styling: `<h3>` for section headings, `<p>` for paragraphs, `<ul>/<li>` for list items, and `<pre>` or inline code for code blocks.
   - Shows the task status badge, labels, complexity, and dates in a metadata area below the title.
4. **Render the dialog in `TaskBoard`**: Add the `TaskDetailDialog` (or inline `<Dialog>`) after the existing dialogs in `TaskBoard.tsx`, controlled by the `detailTarget` state. Wire the `onEdit` callback to call `onOpenEditor(filePath)` and close the dialog.
5. **Style the dialog**: Use `max-w-2xl` for width, `bg-panel border-edge` for the content panel, and wrap the markdown body in a `ScrollArea` with a `max-h-[70vh]` constraint. Use existing color tokens (`text-light` for headings, `text-mid` for body, `text-dim` for secondary info). Apply the same label badge styling from `TaskCard` (`getLabelClassName`).
6. **Handle edge cases**: Show an error state if `readTask` fails. Clear `detailTarget` and fetched content when the dialog closes. Ensure keyboard accessibility (Escape closes the dialog, which `@base-ui/react/dialog` handles by default).

## Acceptance Criteria

1. **Card click opens detail dialog**
   - Given the task board is loaded with at least one task
   - When the user clicks on a task card body
   - Then a dialog opens showing the full task details

2. **Action buttons do not trigger dialog**
   - Given a pending task card is visible
   - When the user clicks the Run, Edit, or Del button on that card
   - Then the respective action fires (run confirmation, editor, delete confirmation) and the detail dialog does NOT open

3. **Full content is displayed**
   - Given the detail dialog is open for a task
   - When the markdown content finishes loading
   - Then all sections (Description, Background, Technical Requirements, Dependencies, Implementation Approach, Acceptance Criteria, Metadata) are rendered with appropriate formatting

4. **Loading state is shown**
   - Given the user clicks a task card to open the detail dialog
   - When the content is being fetched via IPC
   - Then a loading indicator is displayed inside the dialog until content arrives

5. **Edit button navigates to editor**
   - Given the detail dialog is open
   - When the user clicks the "Edit" button in the dialog footer
   - Then the editor view opens for that task's file and the dialog closes

6. **Dialog closes properly**
   - Given the detail dialog is open
   - When the user clicks Close, clicks the backdrop, or presses Escape
   - Then the dialog closes and internal state is reset

## Metadata
- **Complexity**: Medium
- **Labels**: feature, desktop, ui
