---
status: completed
created: 2026-02-24
started: 2026-02-24
completed: 2026-02-24
---
# Task: Add Close X Button to All Dialogs

## Description
All dialog windows in the desktop app should display a close "X" button in the top-right corner, giving users a clear and consistent way to dismiss any dialog. Currently, nearly every dialog explicitly suppresses this button by passing `showCloseButton={false}`, even though the underlying `DialogContent` component already supports rendering one via the `showCloseButton` prop.

## Background
The desktop app's dialog system is built on `@base-ui/react/dialog`, wrapped in a local UI layer at `packages/desktop/src/renderer/components/ui/dialog.tsx`. The `DialogContent` component accepts a `showCloseButton` prop (defaulting to `true`) that renders a `DialogPrimitive.Close` button with a Lucide `XIcon` absolutely positioned at `top-4 right-4`. However, 9 out of 10 dialog instances across the codebase explicitly set `showCloseButton={false}`, relying instead on footer Cancel/Close buttons and implicit dismiss via backdrop click or Escape. Only `InitWizard.tsx` currently shows the X button (by using the default). This inconsistency means users lack a universally visible close affordance across dialogs.

## Technical Requirements
1. Remove every `showCloseButton={false}` prop from `DialogContent` usage across all component files so the default `true` behavior takes effect
2. Ensure the X close button renders correctly in all dialog variants — small confirmation dialogs, medium settings modals, and large detail/wizard dialogs
3. Verify the X button does not overlap or visually conflict with dialog titles or other top-right content
4. Ensure the X button triggers the same close/dismiss logic as the existing Cancel or Close footer buttons (i.e., the `onOpenChange` callback resets the controlling state properly)

## Dependencies
- `packages/desktop/src/renderer/components/ui/dialog.tsx` — the shared `DialogContent` component that already implements the `showCloseButton` prop and X button rendering
- `lucide-react` — provides the `XIcon` used in the close button
- `@base-ui/react/dialog` — the underlying dialog primitive library (`DialogPrimitive.Close` handles the close trigger)

## Implementation Approach
1. **Audit all dialog instances**: Locate every `<DialogContent` usage across the desktop renderer components and note which ones pass `showCloseButton={false}`
2. **Remove `showCloseButton={false}` from each instance**: In the following files, remove the prop so the default `true` takes effect:
   - `packages/desktop/src/renderer/components/TaskDetailDialog.tsx`
   - `packages/desktop/src/renderer/components/SettingsModal.tsx`
   - `packages/desktop/src/renderer/components/TaskBoard.tsx` (3 inline dialogs)
   - `packages/desktop/src/renderer/components/AgentRunner.tsx` (2 inline dialogs)
   - `packages/desktop/src/renderer/components/Layout.tsx` (switch project dialog)
   - `packages/desktop/src/renderer/components/TaskEditor.tsx`
   - `packages/desktop/src/renderer/components/ConfigEditor.tsx`
3. **Verify `InitWizard.tsx` remains unchanged**: It already uses the default behavior and should not be affected
4. **Check for visual conflicts**: Review dialog headers and titles to ensure the absolutely-positioned X button at `top-4 right-4` does not overlap with title text or other elements. If any dialog has content too close to the top-right corner, add appropriate padding or adjust layout
5. **Validate close behavior**: Confirm that `DialogPrimitive.Close` triggers `onOpenChange(false)` on the `<Dialog>` root, which is how all controlled dialogs already handle dismissal — no additional wiring should be needed
6. **Build and lint**: Run `bun run build` and `bunx oxlint src` from `packages/desktop` to catch any issues

## Acceptance Criteria

1. **X Button Visible on All Dialogs**
   - Given any dialog in the application is opened
   - When the user views the dialog
   - Then an X close button is visible in the top-right corner of the dialog

2. **X Button Closes Dialog**
   - Given any dialog is open and the X button is visible
   - When the user clicks the X button
   - Then the dialog closes and the application returns to its previous state

3. **Consistent with Existing Dismiss Behavior**
   - Given any dialog is open
   - When the user clicks the X button
   - Then the behavior is identical to clicking the backdrop overlay or pressing Escape (the controlling state resets to its closed value)

4. **No Visual Overlap**
   - Given any dialog is open
   - When the user views the dialog header area
   - Then the X button does not overlap with the dialog title or any other content

5. **Footer Buttons Remain Functional**
   - Given any dialog with existing Cancel or Close footer buttons
   - When the user clicks those footer buttons
   - Then they continue to work as before alongside the new X button

## Metadata
- **Complexity**: Low
- **Labels**: ui, dialog, desktop, ux
