---
status: completed
created: 2026-02-24
started: 2026-02-24
completed: 2026-02-24
---
# Task: Fix Task Board Label Filter Not Filtering Displayed Tasks

## Description
Selecting filter labels on the Tasks page of the desktop app visually highlights the selected label but does not actually filter the displayed tasks. The `TaskBoard` component reads the raw unfiltered `tasks` array from the `useTasks` hook instead of the `filteredTasks` computed value, causing the label filter state to be written to the Zustand store but never consumed for rendering.

## Background
The desktop app's Tasks page (`TaskBoard` component) displays tasks in a 3-column Kanban layout (Pending, In Progress, Completed). A collapsible "Filter by label" panel lets users select a label to narrow the displayed tasks. The `useTasks` hook already computes a `filteredTasks` array using the Zustand store's `labelFilter` value, but `TaskBoard` destructures and uses the raw `tasks` array instead, bypassing the filter entirely. Meanwhile, the `AgentRunner` component implements its own local label filtering correctly using `useState`, proving the pattern works — it's just not wired up in `TaskBoard`.

## Technical Requirements
1. `TaskBoard` must use the `filteredTasks` value from the `useTasks` hook as the base for its search-filtered and grouped task lists
2. The `uniqueLabels` computation must continue to derive from the full `tasks` array so all labels remain visible in the filter UI regardless of the active filter
3. The text search filter (`filteredBySearch`) must compose on top of the label-filtered tasks, not the raw tasks
4. Selecting a label and then searching by text must apply both filters simultaneously
5. The "All labels" button must continue to clear the label filter and show all tasks

## Dependencies
- `packages/desktop/src/renderer/components/TaskBoard.tsx` — the component that needs the fix
- `packages/desktop/src/renderer/hooks/useTasks.ts` — the hook that exposes `filteredTasks` (already working correctly)
- `packages/desktop/src/renderer/store/slices/taskSlice.ts` — the Zustand slice managing `labelFilter` state

## Implementation Approach
1. In `TaskBoard.tsx`, update the destructured return from `useTasks()` to also include `filteredTasks`
2. Update the `filteredBySearch` memo to use `filteredTasks` as its base instead of `tasks`, so label filtering is applied before text search
3. Verify that `uniqueLabels` still derives from `tasks` (not `filteredTasks`) to keep all labels visible in the filter panel
4. Confirm that `groupedTasks` continues to derive from `filteredBySearch`, which now correctly chains both filters
5. Manually verify in the desktop app that selecting a label filters the Kanban columns, searching by text further narrows results, and clicking "All labels" resets the filter

## Acceptance Criteria

1. **Label filter applies to displayed tasks**
   - Given the Tasks page is open with multiple tasks having different labels
   - When the user selects a label filter (e.g., "feature")
   - Then only tasks with the "feature" label are displayed in the Kanban columns

2. **All labels button clears the filter**
   - Given a label filter is active and only matching tasks are displayed
   - When the user clicks the "All labels" button
   - Then all tasks are displayed regardless of their labels

3. **Label filter composes with text search**
   - Given a label filter is active showing a subset of tasks
   - When the user types a search query in the text search input
   - Then only tasks matching both the label filter and the search query are displayed

4. **All labels remain visible in the filter panel**
   - Given a label filter is active
   - When the user opens the filter panel
   - Then all unique labels from all tasks (not just filtered tasks) are still shown as filter options

5. **Toggle behavior still works**
   - Given a label filter is active
   - When the user clicks the same label again
   - Then the filter is deselected and all tasks are shown

## Metadata
- **Complexity**: Low
- **Labels**: bug, desktop, ui
