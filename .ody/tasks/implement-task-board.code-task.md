---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement Task Board (Kanban View)

## Description
Build the Task Board view showing tasks in a kanban-style layout with three columns (Pending, In Progress, Completed). Each task is displayed as a card with title, description excerpt, labels, complexity, and action buttons. The board supports label filtering and includes toolbar actions.

## Background
The Task Board is the default view and primary task management interface. It displays `.code-task.md` files grouped by status (from YAML frontmatter). Pending cards show hover-revealed Run/Edit/Del actions. In-progress cards have a distinct accent-bordered design with an embedded mini-terminal showing live agent output. Completed cards are muted with a green checkmark. The toolbar provides search, "New Plan", and "Archive" actions.

## Technical Requirements
1. Create `src/renderer/components/TaskBoard.tsx` -- main kanban board component
2. Create `src/renderer/components/TaskCard.tsx` -- individual task card component
3. Wire `tasks:list`, `tasks:read`, `tasks:states`, `tasks:byLabel`, `tasks:delete` IPC handlers with actual logic using `@internal/tasks`
4. Task card displays:
   - Title (from `# Task:` heading)
   - Description excerpt (condensed, max 200 chars)
   - Label chips (colored per-category: blue for api, red for security, green for feature, amber for database)
   - Complexity + created date footer
   - Hover-revealed action row: Run, Edit, Del
5. Three columns: Pending (amber indicator), In Progress (accent indicator), Completed (green indicator)
6. Column headers: colored dot + name + horizontal rule + task count badge
7. In-progress card variant with accent border, embedded mini-terminal, iteration counter, Stop button
8. Completed card variant with reduced opacity, green checkmark, muted styling
9. Label filter bar in toolbar for filtering tasks by label
10. Run action opens a confirmation modal before starting the agent
11. Delete action opens a confirmation dialog
12. Edit action navigates to the Task Editor view
13. FadeUp animation on cards with stagger delays

## Dependencies
- `implement-app-layout-shell` task must be completed
- `implement-ipc-layer-and-preload` task must be completed
- `implement-zustand-store` task must be completed

## Implementation Approach
1. Implement main process task IPC handlers:
   - `tasks:list`: use `getTaskFilesInTasksDir()` and parse each file for title, description, labels, complexity, dates
   - `tasks:read`: use `readFile()` for full task content
   - `tasks:states`: use `getTaskStates()` from `@internal/tasks`
   - `tasks:byLabel`: use `getTaskFilesByLabel()` from `@internal/tasks`
   - `tasks:delete`: delete specified files, return confirmation
2. Build `TaskBoard.tsx`:
   - Load tasks via `useTasks` hook on mount
   - Group tasks by status into three columns
   - Render columns with header (colored dot, name, count badge)
   - Apply `fadeUp` animation with stagger delays
3. Build `TaskCard.tsx` with three variants:
   - **Pending**: standard card with hover-revealed actions
   - **In Progress**: accent border, mini-terminal area (consumes agent output from store), Stop button
   - **Completed**: muted opacity, green checkmark icon
4. Label chips: parse `**Labels**: ...` from task metadata, assign colors based on keyword matching
5. Toolbar: search input (filters by title), "New Plan" button (navigates to Plan view), "Archive" button
6. Run confirmation modal: shows task name, backend, iterations, auto-commit toggle, Cancel/Start buttons
7. Delete confirmation dialog: shows task name, Cancel/Delete buttons (red destructive action)
8. Connect card actions to navigation (Edit -> Task Editor view) and agent execution (Run -> agent:run IPC)

## Acceptance Criteria

1. **Tasks Display in Columns**
   - Given task files with different statuses
   - When opening the Task Board
   - Then tasks appear in the correct columns (Pending, In Progress, Completed)

2. **Card Content**
   - Given a task with title, description, labels, and complexity
   - When viewing its card
   - Then all metadata is displayed correctly with proper styling

3. **Label Filtering**
   - Given tasks with different labels
   - When applying a label filter
   - Then only tasks matching the label are shown

4. **Run Confirmation**
   - Given a pending task card
   - When clicking "Run"
   - Then a confirmation modal appears with task details and Start/Cancel buttons

5. **Delete Confirmation**
   - Given a task card
   - When clicking "Del"
   - Then a confirmation dialog appears, and confirming deletes the task file

6. **FadeUp Animation**
   - Given the Task Board loading
   - When cards appear
   - Then they animate in with staggered fadeUp effect

## Metadata
- **Complexity**: High
- **Labels**: task-board, kanban, ui, desktop
