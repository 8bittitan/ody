---
status: pending
created: 2026-02-24
started: null
completed: null
---
# Task: Move Generation Output to Right Column and Remove Pending Tasks List

## Description
Restructure the plan page layout by removing the `PlanList` component (pending tasks list) from the right column and relocating the "Generation output" box from within `PlanCreator` to occupy the right column in its place. This gives the generation output more dedicated screen real estate and removes a panel that duplicates information already available on the task board.

## Background
The plan page currently uses a two-column grid layout defined in `Layout.tsx` at line 404: the left column renders `PlanCreator` (plan creation form + generation output box) and the right column renders `PlanList` (a list of pending tasks filtered from the task store). The generation output box is currently nested at the bottom of the `PlanCreator` component (lines 226-244 of `PlanCreator.tsx`), constrained by `max-h-56`. The pending tasks list in `PlanList.tsx` is a standalone 32-line component that filters tasks by `status === 'pending'` and renders them as cards. Since users can already view pending tasks on the task board (accessible via the "Open Task Board" link), the pending tasks panel on the plan page is redundant. Moving the generation output to the right column gives it more vertical space and prominence, improving the plan generation workflow.

## Technical Requirements
1. Remove the `<PlanList />` component from the plan view grid in `Layout.tsx` (line 410)
2. Extract the generation output box JSX (lines 226-244) and its associated state/logic (`streamOutput`, `isGenerating`, `onOpenTaskBoard`) out of `PlanCreator.tsx`
3. Create a new `GenerationOutput` component (or inline the JSX directly in `Layout.tsx`) to render in the right column where `PlanList` previously sat
4. The generation output in the right column should expand to fill the full height of the column (`h-full`), removing the previous `max-h-56` / `min-h-28` constraints
5. The `PlanCreator` component should no longer render the generation output section internally
6. The `PlanList` component import can be removed from `Layout.tsx`; the `PlanList.tsx` file itself may be deleted or left unused
7. Stream output state (`streamOutput`, `setStreamOutput`, `isGenerating`) must be lifted up or shared so that `PlanCreator` can write to it and the new right-column component can read from it

## Dependencies
- `packages/desktop/src/renderer/components/Layout.tsx` - contains the two-column grid layout for the plan view
- `packages/desktop/src/renderer/components/PlanCreator.tsx` - contains the plan creation form and the generation output box to be extracted
- `packages/desktop/src/renderer/components/PlanList.tsx` - the pending tasks component to be removed from the layout
- `packages/desktop/src/renderer/hooks/useTasks.ts` - provides tasks data; will no longer be needed by the plan view's right column
- `packages/desktop/src/renderer/lib/api.ts` - provides `api.agent.onOutput` used by stream output logic

## Implementation Approach
1. **Lift stream output state out of `PlanCreator`**: Move `streamOutput`, `setStreamOutput`, `isGenerating`, and the `useEffect` that subscribes to `api.agent.onOutput` / `api.agent.onComplete` / `api.agent.onStopped` / `api.agent.onVerifyFailed` up into the plan view section of `Layout.tsx` (or into a dedicated hook like `usePlanStream`). Pass the setter functions down to `PlanCreator` as props and the read values to the new output component.
2. **Create a `GenerationOutput` component**: Build a new component (e.g., `packages/desktop/src/renderer/components/GenerationOutput.tsx`) that accepts `streamOutput`, `isGenerating`, and `onOpenTaskBoard` as props. Style it as a full-height card matching the existing panel aesthetic (`bg-panel/92 border-edge h-full rounded-lg border p-4 backdrop-blur-sm`). The inner `<pre>` should use `flex-1 overflow-auto` instead of fixed `max-h-56` so it fills available space.
3. **Update `PlanCreator.tsx`**: Remove the generation output `<div>` block (lines 226-244). Remove `streamOutput` and `isGenerating` local state if fully lifted. Accept new props for `beginGeneration` trigger and stream callbacks so it can still initiate generation and signal the parent.
4. **Update `Layout.tsx`**: Replace `<PlanList />` with `<GenerationOutput />` in the grid. Remove the `PlanList` import. Wire up the lifted state between `PlanCreator` and `GenerationOutput`. Keep the existing grid proportions (`lg:grid-cols-[1.25fr_0.75fr]`) or adjust if desired.
5. **Optionally delete `PlanList.tsx`**: If the component is no longer used anywhere, remove the file to keep the codebase clean.
6. **Verify**: Confirm the plan page renders correctly with the form on the left and generation output on the right. Test single and batch generation flows to ensure stream output displays correctly in the new location. Verify the "Open Task Board" link still navigates to the tasks view.

## Acceptance Criteria

1. **Pending tasks list removed**
   - Given the user navigates to the plan page
   - When the page renders
   - Then there is no "Pending Tasks" panel or task card list visible on the plan page

2. **Generation output in right column**
   - Given the user navigates to the plan page
   - When the page renders
   - Then the "Generation output" box occupies the right column where the pending tasks list previously appeared

3. **Generation output fills available height**
   - Given the plan page is displayed at desktop resolution (lg breakpoint or wider)
   - When the user views the right column
   - Then the generation output panel fills the full height of the content area, not limited to 224px

4. **Stream output works correctly**
   - Given the user initiates a plan generation (single or batch)
   - When the agent streams output chunks
   - Then the output appears in real time in the right-column generation output box

5. **Open Task Board link works**
   - Given the generation output panel is displayed in the right column
   - When the user clicks "Open Task Board"
   - Then the view navigates to the tasks view

6. **Plan creation form unaffected**
   - Given the user is on the plan page
   - When interacting with the Single or Batch tab forms
   - Then all inputs, buttons, and prompt preview function identically to before

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, ui, layout, plan-page, refactor
