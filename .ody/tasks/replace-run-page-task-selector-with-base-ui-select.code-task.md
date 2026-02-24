---
status: completed
created: 2026-02-24
started: 2026-02-24
completed: 2026-02-24
---
# Task: Replace Run Page Task Selector with Base UI Select

## Description
Replace the native HTML `<select>` element used for task selection on the Agent Runner (run) page with the project's existing Base UI `Select` component from `@/components/ui/select`. This brings the task selector in line with the rest of the UI, which has already been migrated to Base UI primitives, improving visual consistency and accessibility.

## Background
The Agent Runner page (`AgentRunner.tsx`) contains a task selector that lets users pick a specific pending task to run. It currently uses a plain HTML `<select>` element (lines 234–250), while every other select-style control in the app uses the Base UI `Select` wrapper components defined in `@/components/ui/select`. The project completed a full migration from shadcn/ui to Base UI (`migrate-shadcn-to-base-ui.code-task.md` is marked completed), but this particular selector was missed or predates the migration.

The existing Base UI Select wrapper (`packages/desktop/src/renderer/components/ui/select.tsx`) exposes `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, and related sub-components built on top of `@base-ui/react/select`. The wrapper already handles portal rendering, scroll arrows, animation, and a check-mark indicator for the selected item.

## Technical Requirements
1. Replace the native `<select>` element in `AgentRunner.tsx` (lines 234–250) with the Base UI `Select` components from `@/components/ui/select`.
2. Maintain the existing controlled state behaviour: `selectedTaskPath` state and its setter must continue to drive the component via `value` / `onValueChange`.
3. Preserve the default "Run current task filter" option (empty-string value) as the placeholder or first selectable item.
4. Render each pending task as a `SelectItem` with `value={task.filePath}` displaying `task.title`.
5. Ensure the trigger element matches the existing design tokens (`bg-background`, `border-edge`, `text-light`, `h-8`, `w-full`, `rounded`, `text-sm`) or inherits equivalent styling from the `SelectTrigger` size="sm" variant.
6. The surrounding `<label>` and its `<span>` label text ("Specific task (optional)") must remain intact.
7. No new dependencies — `@base-ui/react` and the local `select.tsx` wrapper are already available.

## Dependencies
- `@/components/ui/select` — the project's existing Base UI Select wrapper (`packages/desktop/src/renderer/components/ui/select.tsx`), which exports `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, and related components.
- `@base-ui/react` v1.2.0+ — already installed in `packages/desktop/package.json`.
- `AgentRunner.tsx` state: `selectedTaskPath` (`useState<string>('')`) and the `pendingTasks` array from the `useTasks()` Zustand hook.

## Implementation Approach
1. **Add imports** — In `AgentRunner.tsx`, import `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, and `SelectItem` from `@/components/ui/select`.
2. **Replace the native select** — Remove the `<select>` block (lines 236–249) and replace it with the Base UI composition:
   - Wrap everything in `<Select value={selectedTaskPath} onValueChange={setSelectedTaskPath}>`.
   - Use `<SelectTrigger size="sm" className="...">` with a `w-full` class to fill the container width, keeping existing design-token classes where the default trigger styles diverge.
   - Inside the trigger, render `<SelectValue placeholder="Run current task filter" />`.
   - Render `<SelectContent>` containing one `<SelectItem value="">Run current task filter</SelectItem>` for the default option, followed by `pendingTasks.map(...)` producing `<SelectItem key={task.filePath} value={task.filePath}>{task.title}</SelectItem>`.
3. **Handle controlled value** — Base UI Select's `onValueChange` callback receives the new value directly (not a synthetic event), so the handler simplifies from `(event) => setSelectedTaskPath(event.target.value)` to just passing `setSelectedTaskPath` directly.
4. **Verify label association** — The outer `<label>` can remain as a wrapper. If Base UI's `SelectTrigger` does not auto-associate with the `<label>`, add an `aria-label` or `aria-labelledby` to ensure the selector remains accessible.
5. **Visual QA** — Confirm the dropdown renders correctly within the run page's side-panel layout: the trigger fills the available width, the popup appears above/below without clipping, scroll arrows appear for long task lists, and the selected item shows a check-mark indicator.
6. **Lint and format** — Run `bunx oxlint src` and `bunx oxfmt -w src` from `packages/desktop` (or the appropriate scope) to ensure the change passes project linting and formatting rules.

## Acceptance Criteria

1. **Base UI Select renders on run page**
   - Given the user navigates to the run page
   - When the Agent Runner panel loads with pending tasks
   - Then a Base UI Select component (not a native `<select>`) is rendered under the "Specific task (optional)" label

2. **Default placeholder behaviour**
   - Given no specific task has been selected
   - When the user views the select trigger
   - Then it displays "Run current task filter" as placeholder text

3. **Task list populates correctly**
   - Given there are pending (non-completed) tasks in the store
   - When the user opens the select dropdown
   - Then each pending task appears as a selectable item showing its title

4. **Selection updates state**
   - Given the user opens the dropdown and clicks a task
   - When the selection changes
   - Then `selectedTaskPath` updates to the selected task's `filePath`, and the trigger text updates to that task's title

5. **Clearing selection back to default**
   - Given a specific task is currently selected
   - When the user selects the "Run current task filter" option
   - Then `selectedTaskPath` resets to `""` and the trigger shows the default text

6. **Styling consistency**
   - Given the Base UI Select is rendered
   - When compared to other Select instances in the app (e.g., config page)
   - Then the trigger height, border, background, and text styles are consistent with the design system

7. **Accessibility preserved**
   - Given a screen reader or keyboard user
   - When interacting with the task selector
   - Then the component is fully navigable via keyboard (arrow keys, Enter, Escape) and has appropriate ARIA attributes

## Metadata
- **Complexity**: Low
- **Labels**: ui, desktop, base-ui, agent-runner, select
