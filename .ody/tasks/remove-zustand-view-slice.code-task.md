---
status: completed
created: 2026-02-25
started: 2026-02-25
completed: 2026-02-25
---
# Task: Remove Zustand ViewSlice and Clean Up Store

## Description
Delete the `ViewSlice` from the Zustand store since all its state (`labelFilter`, `statusFilter`, `selectedTaskPath`, `configEditorPath`) has been migrated to route search params. Update the combined `AppStore` type and `useStore` creation to remove the slice.

## Background
The `ViewSlice` in `store/slices/viewSlice.ts` holds four pieces of state:
- `labelFilter: string | null` → now a search param on `/tasks?label=...`
- `statusFilter: TaskStatus | 'all'` → now a search param on `/tasks?status=...`
- `selectedTaskPath: string | null` → now a search param on `/editor?taskPath=...`
- `configEditorPath: string | null` → now a search param on `/config-editor?path=...`

With all consumers migrated to read from route search params, the slice is dead code. The store index combines `AgentSlice & UISlice & ViewSlice & AppSlice` — removing `ViewSlice` leaves `AgentSlice & UISlice & AppSlice`.

## Technical Requirements
1. Delete `packages/desktop/src/renderer/store/slices/viewSlice.ts`.
2. Update `packages/desktop/src/renderer/store/index.ts`:
   - Remove the `ViewSlice` import.
   - Remove `ViewSlice` from the `AppStore` type union.
   - Remove `...createViewSlice(...args)` from the `useStore` creation.
3. Search the entire `src/renderer/` directory for any remaining imports of `ViewSlice`, `createViewSlice`, or the individual state/setter names (`labelFilter`, `statusFilter`, `selectedTaskPath`, `configEditorPath`, `setLabelFilter`, `setStatusFilter`, `setSelectedTaskPath`, `setConfigEditorPath`) from the store. Remove all occurrences.
4. Verify the app still compiles and the store works correctly with the remaining 3 slices.

## Dependencies
- **migrate-navigation-triggers** — all consumers of ViewSlice state and setters must be migrated to route-based patterns first.
- **create-tasks-route-with-search-params** — filters migrated to search params.
- **create-editor-route-with-search-params** — `selectedTaskPath` migrated.
- **create-config-editor-route-with-search-params** — `configEditorPath` migrated.

## Implementation Approach
1. Run a codebase search for all references to ViewSlice state and setters:
   ```
   grep -rn 'labelFilter\|statusFilter\|selectedTaskPath\|configEditorPath\|setLabelFilter\|setStatusFilter\|setSelectedTaskPath\|setConfigEditorPath\|ViewSlice\|createViewSlice' src/renderer/
   ```
2. Confirm all references are either in `viewSlice.ts`, `store/index.ts`, or already-migrated route files (which no longer use these).
3. Delete `packages/desktop/src/renderer/store/slices/viewSlice.ts`.
4. Update `packages/desktop/src/renderer/store/index.ts`:
   ```diff
   - import { createViewSlice, type ViewSlice } from './slices/viewSlice';
   
   - export type AppStore = AgentSlice & UISlice & ViewSlice & AppSlice;
   + export type AppStore = AgentSlice & UISlice & AppSlice;
   
     export const useStore = create<AppStore>()((...args) => ({
       ...createAgentSlice(...args),
       ...createUISlice(...args),
   -   ...createViewSlice(...args),
       ...createAppSlice(...args),
     }));
   ```
5. Run `bun typecheck` to confirm no compile errors.
6. Run `bun test` to confirm no test failures.

## Acceptance Criteria

1. **ViewSlice file deleted**
   - Given the store directory
   - When I check `store/slices/`
   - Then `viewSlice.ts` does not exist

2. **Store type updated**
   - Given `store/index.ts`
   - When I inspect `AppStore`
   - Then it equals `AgentSlice & UISlice & AppSlice` (no `ViewSlice`)

3. **No dangling references**
   - Given the entire `src/renderer/` source
   - When I search for `ViewSlice`, `createViewSlice`, `setLabelFilter`, `setStatusFilter`, `setSelectedTaskPath`, `setConfigEditorPath`
   - Then zero occurrences are found

4. **App compiles**
   - Given the updated store
   - When I run `bun typecheck`
   - Then there are no type errors

5. **Remaining slices work**
   - Given the store has `AgentSlice`, `UISlice`, and `AppSlice`
   - When the app runs
   - Then agent state, sidebar collapse, and fullscreen state all function correctly

## Metadata
- **Complexity**: Medium
- **Labels**: cleanup, zustand, store, desktop
