---
status: completed
created: 2026-02-25
started: 2026-02-25
completed: 2026-02-25
---
# Task: Delete Layout.tsx and Finalize Migration Cleanup

## Description
Delete the now-obsolete `Layout.tsx` component and perform a final cleanup pass across the codebase. All Layout.tsx responsibilities have been distributed: the outer shell to `__root.tsx`, view rendering to individual route files, plan streaming to the plan route, and navigation to the router. This task ensures no dead code, broken imports, or missed references remain.

## Background
`Layout.tsx` was a 617-line monolithic component that handled:
- Outer shell (header, sidebar, footer) → moved to `__root.tsx`
- View switching via ternary chain → replaced by route components
- Plan generation streaming → moved to `routes/plan.tsx`
- Project management UI → moved to `__root.tsx`
- IPC menu action handlers → moved to `__root.tsx`
- Custom DOM event handlers → moved to `__root.tsx`
- Modals (InitWizard, SettingsModal, switch dialog) → moved to `__root.tsx`

After deletion, `App.tsx` imports `RouterProvider` instead of `Layout`, and the router renders `__root.tsx` as the root layout.

## Technical Requirements
1. Delete `packages/desktop/src/renderer/components/Layout.tsx`.
2. Verify `App.tsx` no longer imports `Layout` (should already be done in the App.tsx migration task).
3. Search for any remaining imports of `Layout` across `src/renderer/` and remove them.
4. Search for any remaining references to `ViewId` — if `Sidebar.tsx` still exports it, ensure it's imported from the correct location. If `ViewId` is no longer needed anywhere (since route paths replace it), remove the type.
5. Verify the `VIEW_META` constant is defined in `__root.tsx` and not duplicated.
6. Check that no component still receives `setActiveView` as a callback prop.
7. Run `bun typecheck` to confirm no type errors across the entire workspace.
8. Run `bun lint` to confirm no lint issues.
9. Run `bun fmt` to ensure consistent formatting.
10. Run `bun test` to confirm no test failures.
11. Verify the generated `routeTree.gen.ts` is up to date and includes all 10 routes (root, index, tasks, run, plan, import, config, config-editor, auth, archive, editor).

## Dependencies
- **All previous tasks** — every task in the migration must be complete before this final cleanup.

## Implementation Approach
1. Delete `packages/desktop/src/renderer/components/Layout.tsx`.
2. Search for dead imports:
   ```
   grep -rn "from.*Layout" src/renderer/
   grep -rn "from.*viewSlice" src/renderer/
   grep -rn "setActiveView" src/renderer/
   ```
3. Remove any found dead imports or references.
4. Evaluate `ViewId` usage:
   - If it's still used in `__root.tsx` (for `VIEW_META` typing or sidebar active view derivation), keep the export in `Sidebar.tsx` or move to `types/`.
   - If sidebar now uses `<Link>` with `activeProps` and `VIEW_META` uses route paths directly, `ViewId` may be fully replaceable with string literals derived from route paths.
5. Run the full CI check suite:
   ```sh
   bun lint
   bun fmt
   bun typecheck
   bun test
   ```
6. Fix any issues that arise.
7. Test the app end-to-end:
   - Start the desktop app with `bun run start` from `packages/desktop`.
   - Navigate to every view via sidebar.
   - Open the editor from a task.
   - Open the config editor from config.
   - Use keyboard shortcuts (`Cmd+N`, `Cmd+,`).
   - Verify filters work on the task board.
   - Verify back buttons work.
   - Verify project switching works.
   - Verify the URL hash updates correctly.

## Acceptance Criteria

1. **Layout.tsx deleted**
   - Given the components directory
   - When I check for `Layout.tsx`
   - Then the file does not exist

2. **No dead imports**
   - Given the entire `src/renderer/` source
   - When I search for imports of `Layout`, `viewSlice`, or `setActiveView`
   - Then zero occurrences are found

3. **Type check passes**
   - Given the full workspace
   - When I run `bun typecheck`
   - Then there are no type errors

4. **Lint passes**
   - Given the full workspace
   - When I run `bun lint`
   - Then there are no lint errors

5. **Tests pass**
   - Given the full workspace
   - When I run `bun test`
   - Then all tests pass

6. **All views accessible**
   - Given the running desktop app
   - When I navigate to each of the 9 views
   - Then each renders correctly with proper URL hash

## Metadata
- **Complexity**: Medium
- **Labels**: cleanup, migration, desktop
