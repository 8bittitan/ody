---
status: completed
created: 2026-02-25
started: 2026-02-25
completed: 2026-02-25
---
# Task: Create Config Editor Route with Search Params

## Description
Create `src/renderer/routes/config-editor.tsx` for the `/config-editor` route. This route renders `<ConfigEditor>` and uses a required `path` search param to identify which config file to edit. This replaces the `configEditorPath` state in the Zustand `ViewSlice`.

## Background
The config editor is a "hidden" view — it doesn't appear in the sidebar and is only reachable via programmatic navigation from `ConfigPanel` (when a user clicks "Edit JSON"). Currently, `Layout.tsx` calls `setConfigEditorPath(configPath)` then `setActiveView('config-editor')`. With routing, the config path is encoded in URL search params: `#/config-editor?path=.ody/ody.json`. The `ConfigEditor` component currently reads `configEditorPath` from the Zustand store.

## Technical Requirements
1. Create `packages/desktop/src/renderer/routes/config-editor.tsx`.
2. Define a `configEditorSearchSchema` using `zod` (v4) with a required `path` (string) field.
3. Use `createFileRoute('/config-editor')` with `validateSearch: configEditorSearchSchema`.
4. Create a `ConfigEditorPage` wrapper that:
   - Reads `path` from `Route.useSearch()`.
   - Uses `useNavigate()` for the back button.
   - Passes `configPath={path}` to `<ConfigEditor>`.
   - Passes `onBack={() => navigate({ to: '/config' })}`.
5. Wrap in `<ErrorBoundary title="Config editor view error">`.
6. Update `ConfigEditor` to accept `configPath` as a prop instead of reading `configEditorPath` from the store.

## Dependencies
- **add-tanstack-router-vite-plugin** — the Vite plugin must detect this route file.
- **create-root-route-layout** — `<Outlet />` in the root layout renders this route.

## Implementation Approach
1. Create `packages/desktop/src/renderer/routes/config-editor.tsx`:
   ```tsx
   import { createFileRoute, useNavigate } from '@tanstack/react-router';
   import { z } from 'zod/v4';
   import { ErrorBoundary } from '@/components/ErrorBoundary';
   import { ConfigEditor } from '@/components/ConfigEditor';

   const configEditorSearchSchema = z.object({
     path: z.string(),
   });

   export const Route = createFileRoute('/config-editor')({
     validateSearch: configEditorSearchSchema,
     component: ConfigEditorPage,
   });

   function ConfigEditorPage() {
     const { path } = Route.useSearch();
     const navigate = useNavigate();

     return (
       <ErrorBoundary title="Config editor view error">
         <ConfigEditor
           configPath={path}
           onBack={() => navigate({ to: '/config' })}
         />
       </ErrorBoundary>
     );
   }
   ```
2. Open `ConfigEditor.tsx` and update its interface:
   - Add `configPath: string` to props.
   - Remove the `useStore((state) => state.configEditorPath)` call.
   - Use the prop value instead.
3. The `onBack` callback in `Layout.tsx` currently calls `setConfigEditorPath(null)` — with routing, this cleanup is no longer needed.

## Acceptance Criteria

1. **Route renders ConfigEditor**
   - Given the URL is `#/config-editor?path=.ody/ody.json`
   - When the route renders
   - Then `<ConfigEditor>` is displayed editing the specified config file

2. **Back button navigates to config**
   - Given the config editor is open
   - When the user clicks the back button
   - Then the app navigates to `/config`

3. **Required param enforced**
   - Given the URL is `#/config-editor` with no `path` param
   - When the route tries to validate
   - Then validation fails and the route does not render

4. **Config path encoding**
   - Given a config path like `.ody/ody.json` or `~/.ody/ody.json`
   - When encoded in the URL
   - Then it is properly encoded and decoded without data loss

## Metadata
- **Complexity**: Medium
- **Labels**: routing, views, search-params, desktop
