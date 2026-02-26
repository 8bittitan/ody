---
status: completed
created: 2026-02-25
started: 2026-02-25
completed: 2026-02-25
---
# Task: Migrate Sidebar to Use TanStack Router Links

## Description
Update `Sidebar.tsx` to use TanStack Router's `<Link>` component with `activeProps`/`inactiveProps` instead of callback-based `onClick` handlers and the `activeView` prop for highlighting. This eliminates the need for the parent to pass `activeView` and `onViewSelect` — the sidebar becomes self-aware of routing state.

## Background
Currently the `Sidebar` component receives `activeView: ViewId` and `onViewSelect: (viewId: ViewId) => void` as props. Each navigation button calls `onViewSelect(id)` and checks `id === activeView` for active styling. With TanStack Router, `<Link to="/tasks">` automatically applies `activeProps` when the current route matches, and clicking the link navigates via the router. The sidebar also has a collapsed mode with icon-only buttons and tooltips — this needs to work with `<Link>` as well.

## Technical Requirements
1. Modify `packages/desktop/src/renderer/components/Sidebar.tsx`.
2. Import `Link` from `@tanstack/react-router`.
3. Replace the `<button>` elements in the view navigation with `<Link>` components.
4. Use `activeProps` and `inactiveProps` to apply the active/inactive CSS classes:
   - Active: `'border-primary/35 bg-accent-bg text-primary'`
   - Inactive: `'border-transparent hover:border-edge hover:bg-accent-bg/50'`
5. Remove the `activeView` and `onViewSelect` props from `SidebarProps` (they're no longer needed).
6. Update the `__root.tsx` / parent to stop passing these props.
7. For collapsed mode, the `<Link>` must render as an element compatible with the `<Tooltip>` component wrapper — ensure `<Link>` accepts the necessary className and aria-label.
8. The `ViewId` type export should remain (it's used elsewhere) or be migrated to a shared types file.

## Dependencies
- **create-root-route-layout** — the root layout must be updated to stop passing `activeView` and `onViewSelect` to Sidebar.
- **create-simple-view-routes** — all route files must exist so `<Link>` targets are valid.

## Implementation Approach
1. Open `packages/desktop/src/renderer/components/Sidebar.tsx`.
2. Add import: `import { Link } from '@tanstack/react-router';`
3. Update the `SidebarProps` type to remove `activeView` and `onViewSelect`.
4. Replace the navigation button rendering in the `VIEW_ITEMS.map()`:

   **Expanded mode** — replace:
   ```tsx
   <button onClick={() => onViewSelect(id)} className={isActive ? ... : ...}>
   ```
   with:
   ```tsx
   <Link
     to={`/${id}`}
     className="text-mid hover:text-light flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors"
     activeProps={{ className: 'border-primary/35 bg-accent-bg text-primary' }}
     inactiveProps={{ className: 'border-transparent hover:border-edge hover:bg-accent-bg/50' }}
   >
     <Icon className="size-3.5" />
     <span>{label}</span>
   </Link>
   ```

   **Collapsed mode** — replace the button with a `<Link>` inside the `<Tooltip>`:
   ```tsx
   <Tooltip content={label}>
     <Link
       to={`/${id}`}
       className="text-mid hover:text-light flex w-full items-center justify-center rounded-md border p-2 transition-colors"
       activeProps={{ className: 'border-primary/35 bg-accent-bg text-primary' }}
       inactiveProps={{ className: 'border-transparent hover:border-edge hover:bg-accent-bg/50' }}
       aria-label={label}
     >
       <Icon className="size-3.5" />
     </Link>
   </Tooltip>
   ```

5. Remove the `isActive` variable since active state is now handled by the `<Link>` component.
6. Update `__root.tsx` to remove `activeView={activeView}` and `onViewSelect={...}` from the `<Sidebar>` props.
7. Keep the `ViewId` type export — if it's needed elsewhere, consider moving it to `@/types/` or keeping it in Sidebar.

## Acceptance Criteria

1. **Links navigate correctly**
   - Given the sidebar is rendered
   - When the user clicks the "Config" link
   - Then the URL changes to `#/config` and the config view renders

2. **Active styling applied**
   - Given the current route is `/tasks`
   - When the sidebar renders
   - Then the "Tasks" link has `border-primary/35 bg-accent-bg text-primary` styling

3. **Inactive styling applied**
   - Given the current route is `/tasks`
   - When the sidebar renders
   - Then all other links have `border-transparent hover:border-edge hover:bg-accent-bg/50` styling

4. **Collapsed mode works**
   - Given the sidebar is collapsed
   - When the user clicks an icon link
   - Then navigation works and the tooltip still displays

5. **No activeView prop needed**
   - Given the updated Sidebar component
   - When I inspect its props
   - Then `activeView` and `onViewSelect` are no longer in the interface

## Metadata
- **Complexity**: Medium
- **Labels**: routing, sidebar, desktop
