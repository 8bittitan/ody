---
status: completed
created: 2026-03-09
started: 2026-03-09
completed: 2026-03-09
---

# Task: Replace TaskBoard Filters with Multi-Select Autocomplete

## Description
Convert the label and status filters on the task board page from horizontal pill-button toggles to multi-select autocomplete (combobox) inputs. This improves usability when there are many labels, and lets users combine multiple filter values to narrow down tasks more precisely.

## Background
The `TaskBoard` component currently renders label and status filters as rows of toggle `<button>` elements inside `<Collapsible>` wrappers. Labels are dynamic (derived from task data via `uniqueLabels`), and statuses are hardcoded (`pending`, `in_progress`, `completed`) with an explicit `all` option. Both filters are single-select. The project already uses `@base-ui/react` for headless UI primitives, and the library ships a `Combobox` primitive that has not been wrapped yet. All other UI wrappers live in `packages/desktop/src/renderer/components/ui/`.

## Technical Requirements
1. **Create a `Combobox` UI wrapper component** in `packages/desktop/src/renderer/components/ui/combobox.tsx`, using `@base-ui/react/combobox` as the headless primitive. Follow the same styling and export conventions as the existing `select.tsx` wrapper (Tailwind classes, CVA variants, named part exports).
2. **The combobox must support multi-select.** Selected values are displayed as dismissible chips/tags within or directly below the input. Typing into the input filters the available options.
3. **Replace the label filter** (`TaskBoard.tsx`, approximately lines 307-346) with the new multi-select combobox. Options are populated from the existing `uniqueLabels` memo. An empty selection means "show all labels."
4. **Replace the status filter** (`TaskBoard.tsx`, approximately lines 348-373) with the new multi-select combobox. Options are the three `TaskStatus` values (`pending`, `in_progress`, `completed`), using display names from `COLUMN_META`. Remove the explicit `all` option — an empty selection means "show all statuses."
5. **Update filtering logic** in `TaskBoard.tsx` to support multi-select: a task passes the label filter if its `labels` array intersects with the selected labels (OR semantics). A task passes the status filter if its `status` is included in the selected statuses. Empty selection arrays pass all tasks.
6. **State management stays local.** Replace `localLabelFilter: string | null` with `localLabelFilter: string[]` and `localStatusFilter: TaskStatus | 'all'` with `localStatusFilter: TaskStatus[]`. Do not modify URL search params, the route definition in `tasks.tsx`, or the `onFiltersChange` callback.
7. **Do not modify** the `AgentRunner` component or any other consumer of label/status filters.
8. **Preserve keyboard accessibility.** The combobox should be navigable via arrow keys, selectable via Enter, and dismissible via Escape, consistent with `@base-ui/react/combobox` defaults.

## Dependencies
- `@base-ui/react` (already installed, v1.2.0+) — specifically `@base-ui/react/combobox`
- Existing UI wrapper conventions in `packages/desktop/src/renderer/components/ui/`
- `TaskBoard.tsx` filter state and `uniqueLabels` memo
- `COLUMN_META` for status display labels

## Implementation Approach
1. **Read the `@base-ui/react/combobox` API** to understand available primitives (`Root`, `Input`, `Listbox`, `Option`, `Popup`, etc.) and multi-select support.
2. **Create `combobox.tsx`** in the `ui/` directory. Export styled wrapper parts. Support a `multiple` mode that renders selected values as chips with an `×` dismiss button. Style the dropdown, options, and input to match the existing dark theme and design tokens used across the app.
3. **Refactor `TaskBoard.tsx` state:** change `localLabelFilter` to `string[]` (default `[]`) and `localStatusFilter` to `TaskStatus[]` (default `[]`). Remove the `effectiveLabelFilter` / `effectiveStatusFilter` derivations that merge URL and local state — use local state directly.
4. **Update the `filteredTasks` memo** to use array intersection checks instead of single-value equality.
5. **Replace the label filter JSX** (the `Collapsible` with pill buttons) with the new `Combobox` component, passing `uniqueLabels` as options.
6. **Replace the status filter JSX** similarly, passing the three statuses with their `COLUMN_META` display labels as options.
7. **Verify** that clearing all selections in either combobox shows all tasks, and that selecting multiple values filters correctly with OR semantics.

## Acceptance Criteria

1. **Combobox wrapper exists and is reusable**
   - Given the `packages/desktop/src/renderer/components/ui/` directory
   - When inspecting `combobox.tsx`
   - Then it exports a multi-select-capable combobox built on `@base-ui/react/combobox`, styled consistently with the app's design system

2. **Label filter renders as autocomplete**
   - Given the task board page with tasks that have various labels
   - When the user clicks on the label filter input
   - Then a dropdown appears listing all unique labels, and typing narrows the list

3. **Multi-select labels with chip display**
   - Given the label autocomplete is open
   - When the user selects multiple labels
   - Then each selected label appears as a dismissible chip, and the task list shows only tasks matching any of the selected labels

4. **Status filter renders as autocomplete**
   - Given the task board page
   - When the user clicks on the status filter input
   - Then a dropdown appears listing `Pending`, `In Progress`, and `Completed`

5. **Multi-select statuses**
   - Given the status autocomplete
   - When the user selects `Pending` and `In Progress`
   - Then only tasks with those statuses are displayed

6. **Empty selection shows all**
   - Given either filter
   - When no values are selected (all chips dismissed or input cleared)
   - Then all tasks are shown (no filtering applied for that dimension)

7. **AgentRunner is unchanged**
   - Given the `AgentRunner` component
   - When reviewing the code
   - Then its label filter implementation is untouched

8. **Keyboard accessible**
   - Given either combobox
   - When navigating with arrow keys, selecting with Enter, and dismissing with Escape
   - Then the combobox behaves correctly without requiring a mouse

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, ui, filters, taskboard
