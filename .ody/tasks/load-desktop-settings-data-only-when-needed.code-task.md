---
status: completed
created: 2026-03-15
started: 2026-03-16
completed: 2026-03-16
---
# Task: Load desktop settings data only when the settings UI is opened

## Description
Refactor the desktop settings flow so configuration, notification, and backend-model queries only run when the settings modal is actually opened, and align those queries with the app's shared React Query key conventions.

## Background
`packages/desktop/src/renderer/routes/__root.tsx` always mounts `packages/desktop/src/renderer/components/SettingsModal.tsx`, even while the modal is closed. Inside that component, multiple React Query calls fire immediately, including config loading, sound settings, and backend-card/model discovery. The backend section also fans out model requests per backend.

This means the app performs settings-related work during normal navigation even if the user never opens settings. The component also uses ad hoc query keys such as `['config']`, `['soundEnabled']`, and `['backends', config]` instead of the established shared pattern in `packages/desktop/src/renderer/lib/queryKeys.ts`, making cache behavior harder to reason about.

## Technical Requirements
1. Ensure settings queries are disabled until the settings UI is opened.
2. Prevent closed settings UI from eagerly loading backend-model metadata.
3. Replace ad hoc settings-related query keys with stable shared keys.
4. Avoid mutating component form state from inside query functions.
5. Preserve the current settings UX and save behavior.

## Dependencies
- `packages/desktop/src/renderer/routes/__root.tsx` controls when `SettingsModal` is mounted.
- `packages/desktop/src/renderer/components/SettingsModal.tsx` contains the eager query behavior.
- `packages/desktop/src/renderer/hooks/useConfig.ts` and `packages/desktop/src/renderer/lib/queryKeys.ts` define the broader config-query pattern.
- `packages/desktop/src/renderer/lib/api.ts` and preload IPC already expose the needed settings calls.

## Implementation Approach
1. Decide whether to conditionally mount `SettingsModal` only when open, or keep it mounted but gate each query with `enabled: open`.
2. Add or extend shared query keys in `packages/desktop/src/renderer/lib/queryKeys.ts` for settings-adjacent data such as sound preferences and backend metadata.
3. Refactor `SettingsModal` queries to use stable keys and to avoid state-setting side effects inside query functions.
4. Move form hydration into `useEffect` or another explicit synchronization path that runs when config data arrives.
5. Ensure backend model discovery only runs when the backend tab or modal is actually needed, if practical.
6. Verify the modal opens quickly, displays loading states correctly, and still saves config plus sound settings as before.

## Scope Notes
- This task is about unnecessary background work and React Query hygiene, not a visual redesign.
- Keep the settings behavior project-scoped.
- Stay within `packages/desktop` unless shared query key updates require a small supporting change.

## Acceptance Criteria

1. **No eager closed-modal fetches**
   - Given the desktop app is running and the settings modal is closed
   - When the user navigates elsewhere in the app
   - Then settings queries do not run just because the modal component exists in the tree

2. **Settings data loads on open**
   - Given the user opens settings
   - When the modal becomes visible
   - Then config, sound preferences, and backend metadata load at that point and render correctly

3. **Stable query keys**
   - Given settings-related data is cached in React Query
   - When the app invalidates or refetches it
   - Then the relevant queries use shared, stable query-key helpers rather than ad hoc object-based keys

4. **Form hydration is explicit**
   - Given config data arrives from a query
   - When the form is initialized or refreshed
   - Then form state is synchronized outside the query function instead of relying on side effects inside `queryFn`

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, react-query, settings, performance, caching
