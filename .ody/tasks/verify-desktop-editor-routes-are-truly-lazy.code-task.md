---
status: completed
created: 2026-03-15
started: 2026-03-16
completed: 2026-03-16
---
# Task: Verify desktop editor routes are truly lazy and isolated from startup bundles

## Description
Audit and, if needed, tighten code-splitting around editor-heavy desktop routes so Milkdown and CodeMirror dependencies stay out of the renderer startup path until the user opens an editor view.

## Background
The desktop package depends on several heavy editor libraries, including Milkdown and CodeMirror packages declared in `packages/desktop/package.json`. Editor routes such as `packages/desktop/src/renderer/routes/editor.tsx` and `packages/desktop/src/renderer/routes/config-editor.tsx` directly import editor components, while the generated route tree in `packages/desktop/src/renderer/routeTree.gen.ts` statically wires all routes together.

`packages/desktop/vite.renderer.config.ts` enables TanStack Router auto code splitting, which is promising, but the app should explicitly verify that editor-only code is not leaking into the initial renderer bundle. If leakage exists, route or component boundaries should be tightened.

## Technical Requirements
1. Confirm whether editor-only dependencies are excluded from the initial renderer bundle.
2. If they are not, introduce explicit lazy boundaries so editor code loads only when editor routes are visited.
3. Keep non-editor routes free from editor-package imports where possible.
4. Preserve current route behavior and navigation semantics.
5. Keep changes scoped to the desktop package.

## Dependencies
- `packages/desktop/src/renderer/routes/editor.tsx` and `packages/desktop/src/renderer/routes/config-editor.tsx` define the editor entry points.
- `packages/desktop/src/renderer/routeTree.gen.ts` reflects TanStack Router's generated route graph.
- `packages/desktop/vite.renderer.config.ts` already enables auto code splitting.
- Editor-heavy components such as `packages/desktop/src/renderer/components/TaskEditor.tsx` and `packages/desktop/src/renderer/components/ConfigEditor.tsx` pull in large dependencies.

## Implementation Approach
1. Measure or inspect the renderer bundle output to confirm whether editor packages appear in the startup chunk.
2. If needed, refactor editor route modules to use stronger lazy route/component loading boundaries.
3. Ensure editor-specific imports remain contained to editor paths and are not re-exported through shared modules that load on startup.
4. Verify navigation to and from editor routes still works correctly and that loading states remain acceptable.
5. Document any remaining bundle-size tradeoffs if some dependencies cannot be split cleanly.

## Scope Notes
- This task is an audit plus targeted bundle optimization, not a full editor rewrite.
- If the current setup is already sufficient, the task may conclude with minimal code changes and verification artifacts.
- Avoid unrelated route refactors.

## Acceptance Criteria

1. **Startup bundle excludes editor-heavy code**
   - Given the renderer starts on a non-editor route
   - When bundle contents are inspected
   - Then editor-heavy packages such as Milkdown and CodeMirror are not eagerly loaded unless required by that route

2. **Editor routes still work**
   - Given the user navigates to the task editor or config editor
   - When the route loads lazily
   - Then the editor UI still renders correctly and remains functional

3. **Non-editor navigation stays lightweight**
   - Given the user only uses task board, run, config, auth, and archive views
   - When the app runs normally
   - Then editor dependencies do not impose unnecessary startup cost on those flows

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, bundle, performance, routing, editor
