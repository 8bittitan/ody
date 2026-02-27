# Migrate Desktop View Handling to @tanstack/react-router

## Current State

All view switching lives in `Layout.tsx` as a single `useState<ViewId>('tasks')` with a long ternary chain rendering 9 views. Supporting state (`selectedTaskPath`, `configEditorPath`, `labelFilter`, `statusFilter`) lives in the Zustand `ViewSlice`. Navigation is triggered from sidebar clicks, cross-component callback props, Electron IPC menu actions, and custom DOM events.

### ViewId type (defined in Sidebar.tsx)

```ts
type ViewId =
  | 'tasks'
  | 'run'
  | 'plan'
  | 'import'
  | 'config'
  | 'config-editor'
  | 'auth'
  | 'archive'
  | 'editor';
```

### Navigation triggers today

1. **Sidebar button clicks** — calls `onViewSelect(id)` which maps to `setActiveView`.
2. **Cross-component callback props** — e.g. `TaskBoard.onOpenEditor(taskPath)` sets Zustand state then `setActiveView('editor')`.
3. **Electron IPC menu actions** — main process sends `app:menuAction`, Layout maps `view:tasks` etc. to `setActiveView`.
4. **Custom DOM events** — `window.dispatchEvent(new CustomEvent('ody:view-run'))`.

### Zustand slices

| Slice                                                                               | Affected?                               |
| ----------------------------------------------------------------------------------- | --------------------------------------- |
| `ViewSlice` — `labelFilter`, `statusFilter`, `selectedTaskPath`, `configEditorPath` | **Removed** (migrates to search params) |
| `AgentSlice` — agent run state                                                      | Unaffected                              |
| `UISlice` — `sidebarCollapsed`                                                      | Unaffected                              |
| `AppSlice` — `isFullscreen`                                                         | Unaffected                              |

---

## Target Architecture

Replace `useState`-based view switching with @tanstack/react-router using **hash history** and **file-based routing**.

### Decisions

- **History strategy**: Hash history (`createHashHistory`). Works with Electron's `file://` protocol, URLs are visible/debuggable (e.g. `file:///path/to/index.html#/tasks`).
- **Route definition style**: File-based routing via `@tanstack/router-plugin` Vite plugin. Generates `routeTree.gen.ts` from `src/renderer/routes/`.

---

## Route Structure

```
src/renderer/routes/
├── __root.tsx          # Root layout (header, sidebar, footer, <Outlet />)
├── index.tsx           # / — redirect to /tasks
├── tasks.tsx           # /tasks — TaskBoard (search: label?, status?)
├── run.tsx             # /run — AgentRunner
├── plan.tsx            # /plan — PlanCreator + GenerationOutput
├── import.tsx          # /import — TaskImport
├── config.tsx          # /config — ConfigPanel
├── config-editor.tsx   # /config-editor — ConfigEditor (search: { path: string })
├── auth.tsx            # /auth — AuthPanel
├── archive.tsx         # /archive — ArchiveViewer
└── editor.tsx          # /editor — TaskEditor (search: { taskPath: string })
```

---

## Implementation Steps

### 1. Install dependencies

```sh
bun add @tanstack/react-router @tanstack/react-router-with-query
bun add -d @tanstack/router-plugin @tanstack/router-devtools
```

- `@tanstack/react-router` — core router.
- `@tanstack/react-router-with-query` — integrates TanStack Query loaders with router (pairs with existing `@tanstack/react-query`).
- `@tanstack/router-plugin` — Vite plugin for file-based route generation.
- `@tanstack/router-devtools` — dev-only devtools panel.

### 2. Add the Vite plugin

In `vite.renderer.config.ts`:

```ts
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/renderer/routes',
      generatedRouteTree: './src/renderer/routeTree.gen.ts',
    }),
    tailwindcss(),
    react({ babel: { plugins: ['babel-plugin-react-compiler'] } }),
  ],
  // ...existing config
});
```

### 3. Create the router instance

New file `src/renderer/router.ts`:

```ts
import { createHashHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

const hashHistory = createHashHistory();

export const router = createRouter({
  routeTree,
  history: hashHistory,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

### 4. Create the root route (`routes/__root.tsx`)

Extracts the outer shell from `Layout.tsx` — title bar, sidebar, `<Outlet />`, footer, modals:

```tsx
import { createRootRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { Sidebar } from '@/components/Sidebar';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Derive activeView from pathname for sidebar highlight
  // e.g. '/tasks' -> 'tasks', '/config-editor' -> 'config-editor'

  // Electron IPC menu action listener lives here:
  // useEffect(() => {
  //   window.ody.onMenuAction((action) => {
  //     if (action === 'view:tasks') navigate({ to: '/tasks' })
  //     ...
  //   })
  // }, [])

  return (
    <div>
      <header>{/* title bar */}</header>
      <Sidebar
        activeView={pathname.slice(1) as ViewId}
        onViewSelect={(id) => navigate({ to: `/${id}` })}
      />
      <main>
        <Outlet />
      </main>
      <footer>{/* status bar */}</footer>
      <InitWizard />
      <SettingsModal />
    </div>
  );
}
```

### 5. Create route files for each view

**Index redirect:**

```tsx
// routes/index.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/tasks' });
  },
});
```

**Simple routes** (run, plan, import, config, auth, archive):

```tsx
// routes/run.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AgentRunner } from '@/components/AgentRunner';

export const Route = createFileRoute('/run')({
  component: AgentRunner,
});
```

**Tasks route with filter search params:**

```tsx
// routes/tasks.tsx
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod/v4';
import { TaskBoard } from '@/components/TaskBoard';

const tasksSearchSchema = z.object({
  label: z.string().optional(),
  status: z.string().optional(),
});

export const Route = createFileRoute('/tasks')({
  validateSearch: tasksSearchSchema,
  component: TasksWrapper,
});

function TasksWrapper() {
  const { label, status } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <TaskBoard
      labelFilter={label}
      statusFilter={status}
      onOpenPlan={() => navigate({ to: '/plan' })}
      onOpenArchive={() => navigate({ to: '/archive' })}
      onOpenEditor={(taskPath) => navigate({ to: '/editor', search: { taskPath } })}
    />
  );
}
```

**Editor route with required search param:**

```tsx
// routes/editor.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod/v4';
import { TaskEditor } from '@/components/TaskEditor';

const editorSearchSchema = z.object({
  taskPath: z.string(),
});

export const Route = createFileRoute('/editor')({
  validateSearch: editorSearchSchema,
  component: EditorWrapper,
});

function EditorWrapper() {
  const { taskPath } = Route.useSearch();
  const navigate = useNavigate();
  return <TaskEditor taskPath={taskPath} onBack={() => navigate({ to: '/tasks' })} />;
}
```

**Config editor route with required search param:**

```tsx
// routes/config-editor.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod/v4';
import { ConfigEditor } from '@/components/ConfigEditor';

const configEditorSearchSchema = z.object({
  path: z.string(),
});

export const Route = createFileRoute('/config-editor')({
  validateSearch: configEditorSearchSchema,
  component: ConfigEditorWrapper,
});

function ConfigEditorWrapper() {
  const { path } = Route.useSearch();
  const navigate = useNavigate();
  return <ConfigEditor configPath={path} onBack={() => navigate({ to: '/config' })} />;
}
```

### 6. Update the entry point (`App.tsx`)

Replace `<Layout />` with `<RouterProvider>`:

```tsx
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

### 7. Migrate navigation triggers

| Current                                                     | Migration                                                 |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| `setActiveView('tasks')` in callbacks                       | `navigate({ to: '/tasks' })`                              |
| `setActiveView('editor')` + `setSelectedTaskPath(p)`        | `navigate({ to: '/editor', search: { taskPath: p } })`    |
| `setActiveView('config-editor')` + `setConfigEditorPath(p)` | `navigate({ to: '/config-editor', search: { path: p } })` |
| Sidebar `onViewSelect(id)`                                  | `<Link to="/${id}" />` or `navigate({ to: ... })`         |
| Electron IPC `app:menuAction` listener                      | Keep in `__root.tsx`, call `router.navigate(...)`         |
| `onBack` callbacks                                          | `navigate({ to: '/tasks' })` or `router.history.back()`   |
| Filter changes in TaskBoard                                 | `navigate({ search: (prev) => ({ ...prev, label }) })`    |

### 8. Update Sidebar to use `<Link>`

Replace callback-based highlighting with TanStack Router's `<Link>`:

```tsx
import { Link } from '@tanstack/react-router';

// In sidebar nav items:
<Link
  to={`/${item.id}`}
  activeProps={{ className: 'bg-accent text-accent-foreground' }}
  inactiveProps={{ className: 'text-muted-foreground' }}
>
  <item.Icon />
  {item.label}
</Link>;
```

Or use `useMatchRoute()` for more complex matching logic.

### 9. Remove Zustand ViewSlice

- Delete `src/renderer/store/slices/viewSlice.ts`.
- Remove `ViewSlice` from the combined `AppStore` type in `store/index.ts`.
- All state that was in `ViewSlice` (`selectedTaskPath`, `configEditorPath`, `labelFilter`, `statusFilter`) now lives in route search params.

### 10. Add devtools (dev-only)

In `__root.tsx`:

```tsx
import { TanStackRouterDevtools } from '@tanstack/router-devtools';

function RootLayout() {
  return (
    <>
      {/* ...layout... */}
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </>
  );
}
```

---

## File Impact Summary

| File                                     | Action                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `package.json`                           | Add 4 dependencies                                                               |
| `vite.renderer.config.ts`                | Add TanStack Router Vite plugin                                                  |
| `src/renderer/router.ts`                 | **New** — router instance with hash history                                      |
| `src/renderer/routes/__root.tsx`         | **New** — root layout (extracted from Layout.tsx)                                |
| `src/renderer/routes/index.tsx`          | **New** — redirect `/` to `/tasks`                                               |
| `src/renderer/routes/tasks.tsx`          | **New** — tasks route with filter search params                                  |
| `src/renderer/routes/run.tsx`            | **New** — run route                                                              |
| `src/renderer/routes/plan.tsx`           | **New** — plan route                                                             |
| `src/renderer/routes/import.tsx`         | **New** — import route                                                           |
| `src/renderer/routes/config.tsx`         | **New** — config route                                                           |
| `src/renderer/routes/config-editor.tsx`  | **New** — config editor route with path search param                             |
| `src/renderer/routes/auth.tsx`           | **New** — auth route                                                             |
| `src/renderer/routes/archive.tsx`        | **New** — archive route                                                          |
| `src/renderer/routes/editor.tsx`         | **New** — task editor route with taskPath search param                           |
| `src/renderer/routeTree.gen.ts`          | **Generated** — by Vite plugin (commit or gitignore)                             |
| `src/renderer/App.tsx`                   | **Modified** — wrap with `RouterProvider` instead of `Layout`                    |
| `src/renderer/components/Layout.tsx`     | **Deleted** — logic moves to `__root.tsx`                                        |
| `src/renderer/components/Sidebar.tsx`    | **Modified** — use `<Link>` with `activeProps`                                   |
| `src/renderer/store/slices/viewSlice.ts` | **Deleted** — state moves to search params                                       |
| `src/renderer/store/index.ts`            | **Modified** — remove `ViewSlice` from combined store                            |
| Various view components                  | **Minor** — replace `onBack`/`onOpen*` callback props with `useNavigate()` calls |

---

## Risks & Considerations

- **Electron menu IPC**: The listener currently calls `setActiveView`. Needs to import and call `router.navigate()` instead. The router is a module-level singleton so this is straightforward.
- **Hash history + Electron**: Hash-based URLs work with `file://` protocol. URLs will look like `file:///path/to/index.html#/tasks`.
- **Search param serialization**: TanStack Router handles encoding of special characters in search params (e.g. `/` in `taskPath` values) automatically.
- **No SSR concerns**: Pure client-side Electron app, no SSR complications.
- **Generated route tree**: The Vite plugin generates `routeTree.gen.ts` on file changes. Decide whether to commit or gitignore this file.
- **`config-editor` and `editor` routes**: These are "hidden" views not in the sidebar — reachable only via programmatic navigation from other views. This still works fine with router; they just won't have sidebar `<Link>` entries.
- **Keyboard shortcuts**: Menu accelerators (`Cmd+N` for plan, `Cmd+,` for config) trigger via IPC and will continue to work through the menu action listener in `__root.tsx`.
