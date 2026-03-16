---
status: completed
created: 2026-03-15
started: 2026-03-16
completed: 2026-03-16
---
# Task: Standardize desktop query keys for shared cache behavior

## Description
Normalize desktop React Query key usage so all cached desktop data uses shared helper factories instead of ad hoc inline arrays, improving cache predictability and reducing accidental refetches.

## Background
The desktop app already defines centralized query keys in `packages/desktop/src/renderer/lib/queryKeys.ts`, and hooks such as `packages/desktop/src/renderer/hooks/useConfig.ts`, `packages/desktop/src/renderer/hooks/useProjects.ts`, and `packages/desktop/src/renderer/hooks/useTasks.ts` use them consistently. However, `packages/desktop/src/renderer/components/SettingsModal.tsx` defines its own inline keys like `['config']`, `['soundEnabled']`, and `['backends', config]`.

Using object-dependent or inconsistent keys makes cache behavior harder to reason about, especially when invalidating related data from mutations. A shared key strategy is a small but important best-practice cleanup for correctness and performance.

## Technical Requirements
1. Ensure desktop React Query usage relies on shared key factories wherever practical.
2. Avoid unstable keys that depend on full object identity when a primitive key would suffice.
3. Make invalidation paths easier to understand and safer to maintain.
4. Preserve current data-loading behavior while improving cache consistency.

## Dependencies
- `packages/desktop/src/renderer/lib/queryKeys.ts` is the canonical place for shared query keys.
- `packages/desktop/src/renderer/components/SettingsModal.tsx` is the clearest existing example of inconsistent key usage.
- Config and project hooks already provide patterns to follow.

## Implementation Approach
1. Audit desktop React Query usage for inline keys that should move into `queryKeys`.
2. Extend `queryKeys` with any missing settings-, notification-, or backend-related factories.
3. Refactor affected hooks and components to consume those helpers.
4. Remove object-shaped keys where a project path, backend name, or modal-open state would make the cache entry more stable.
5. Verify existing invalidation and refetch behavior still works after the refactor.

## Scope Notes
- This task is about cache hygiene and predictability, not changing what data the app fetches.
- It overlaps with the settings-loading improvement, but should focus specifically on key consistency across the desktop renderer.

## Acceptance Criteria

1. **Shared query keys are used consistently**
   - Given desktop components and hooks use React Query
   - When they define query keys
   - Then those keys come from shared helper factories except in cases where an inline key is clearly justified

2. **Unstable object keys are removed**
   - Given data currently keys off rich objects or one-off arrays
   - When the refactor is complete
   - Then the relevant queries key off stable primitives or helper-built tuples instead

3. **Invalidation remains correct**
   - Given config or related desktop mutations run
   - When they invalidate cached queries
   - Then the expected cached data still refetches correctly using the standardized key helpers

## Metadata
- **Complexity**: Low
- **Labels**: desktop, react-query, caching, maintainability, performance
