---
status: completed
created: 2026-02-24
started: 2026-02-24
completed: 2026-02-24
---
# Task: Parse ANSI in Plan Generation Output Panels

## Description
The plan page's "Generation output" panel currently renders raw process output in a plain `<pre>`, which exposes ANSI escape fragments like `[0m` instead of showing clean or styled text. Implement ANSI parsing for these log-style panels by extracting the existing converter logic into a shared renderer utility and reusing it across generation-output surfaces.

## Background
The desktop app already has ANSI-to-HTML conversion logic in `packages/desktop/src/renderer/components/AgentOutput.tsx` (`toAnsiHtml` + `escapeHtml`) for the run page Log View. However, the plan page output in `packages/desktop/src/renderer/components/PlanCreator.tsx` renders `streamOutput` directly in a `<pre>`, so terminal color/reset sequences leak into the UI. The import flow (`packages/desktop/src/renderer/components/TaskImport.tsx`) and task board live preview path (`packages/desktop/src/renderer/components/TaskBoard.tsx` -> `TaskCard.tsx`) also show plain text and can display the same artifacts.

Reusing the existing parser keeps behavior consistent with AgentOutput and avoids introducing a second ANSI handling strategy.

## Technical Requirements
1. Extract ANSI rendering utilities from `AgentOutput.tsx` into a shared file under `packages/desktop/src/renderer/lib/` (for example `ansi.ts`)
2. The shared utility must provide a function that converts ANSI-formatted plain text into safe HTML for React rendering (preserving current color/bold behavior)
3. Refactor `AgentOutput.tsx` to consume the shared utility without changing existing user-visible behavior
4. Update `PlanCreator.tsx` generation output rendering to use parsed ANSI HTML instead of raw text interpolation
5. Ensure plan output still shows fallback states (`Waiting...` / `No output yet.`) when stream content is empty
6. Apply the same parser to `TaskImport.tsx` generation output for consistency with plan output
7. Sanitize task board in-progress live output preview path (`TaskBoard.tsx` / `TaskCard.tsx`) so ANSI escapes are not shown in inline previews
8. Preserve existing typography, spacing, and scroll behavior of all affected panels

## Dependencies
- `packages/desktop/src/renderer/components/AgentOutput.tsx` - current source of ANSI conversion logic
- `packages/desktop/src/renderer/components/PlanCreator.tsx` - plan generation output panel currently rendering raw chunks
- `packages/desktop/src/renderer/components/TaskImport.tsx` - import generation output panel currently rendering raw chunks
- `packages/desktop/src/renderer/components/TaskBoard.tsx` - computes output preview lines for in-progress tasks
- `packages/desktop/src/renderer/components/TaskCard.tsx` - displays live output preview text
- `packages/desktop/src/renderer/lib/` - target location for shared renderer utility

## Implementation Approach
1. **Create shared ANSI renderer utility**
   - Add `packages/desktop/src/renderer/lib/ansi.ts`
   - Move `COLOR_MAP`, `escapeHtml`, and ANSI parsing logic from `AgentOutput.tsx` into exported helpers
   - Export a primary helper such as `toAnsiHtml(content: string): string`

2. **Refactor AgentOutput to use shared utility**
   - Remove duplicated local converter definitions from `AgentOutput.tsx`
   - Import `toAnsiHtml` from the new shared module
   - Keep existing `dangerouslySetInnerHTML` log rendering and autoscroll behavior unchanged

3. **Apply ANSI parsing to PlanCreator output panel**
   - Compute parsed HTML for `streamOutput`
   - Render parsed output in the generation panel using `dangerouslySetInnerHTML`
   - Keep current empty-state and in-progress fallback text behavior

4. **Apply ANSI parsing to TaskImport output panel**
   - Mirror the same rendering approach as plan output
   - Keep existing panel copy and controls intact

5. **Clean task board inline preview path**
   - Normalize preview output in `TaskBoard.tsx` so ANSI sequences do not surface in `TaskCard`
   - Use a plain-text path suitable for compact card previews (strip-only helper may be added to shared ANSI utility if needed)

6. **Verify behavior across views**
   - Run desktop typecheck
   - Manually confirm log output no longer shows raw sequences like `[0m` in plan/import/task-card preview surfaces
   - Confirm AgentOutput log colors/bold behavior is unchanged after refactor

## Acceptance Criteria

1. **Plan page no longer leaks raw ANSI escapes**
   - Given a plan generation stream includes terminal ANSI sequences
   - When the user views "Generation output" on the plan page
   - Then raw fragments such as `[0m` are not displayed

2. **Plan output remains readable during idle/generation states**
   - Given no stream output has arrived yet
   - When generation is idle or in progress
   - Then the existing fallback messages still render correctly

3. **Import output panel matches plan behavior**
   - Given ANSI-formatted stream chunks in import flow
   - When the user views "Generation Output" in import
   - Then escapes are not shown and output is readable

4. **Task board live preview is clean**
   - Given an in-progress task emits ANSI-formatted output
   - When the preview appears in the task card
   - Then the preview contains readable text without visible escape codes

5. **AgentOutput behavior remains stable**
   - Given run-page log output containing ANSI colors/bold
   - When rendered in Log View
   - Then styled rendering remains functionally equivalent to current behavior

6. **Shared utility is reusable**
   - Given another renderer component needs ANSI handling
   - When importing from `renderer/lib/ansi`
   - Then conversion can be reused without duplicating parser logic

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, ui, plan-page, output, ansi, refactor
