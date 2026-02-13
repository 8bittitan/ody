# Plan: Add Fumadocs Documentation Site (`packages/docs`)

## Overview

Add a new workspace package at `packages/docs` containing a Fumadocs + Next.js documentation site. It will live alongside `packages/cli` in the existing Bun workspaces monorepo and document the CLI's installation, configuration, and commands.

## Key Decisions

- **Next.js in monorepo**: Next.js + React dependencies are scoped to `packages/docs` only.
- **Setup method**: Manual setup for tighter control over the output and cleaner integration with the existing monorepo conventions.
- **Base path**: `/` (root) -- the site is dedicated entirely to documentation. Fumadocs content lives under the `/docs` route segment internally, but the site itself serves documentation from the root.

---

## 1. Create the `packages/docs` Workspace Package

**New file:** `packages/docs/package.json`

- Name: `@ody/docs`
- Type: `module`
- Scripts: `dev`, `build`, `start` (standard Next.js scripts)
- Dependencies:
  - `next`, `react`, `react-dom`
  - `fumadocs-core`, `fumadocs-mdx`, `fumadocs-ui`
  - `@types/mdx`, `@types/react`, `@types/react-dom`

Since the root `package.json` already has `"workspaces": ["packages/*"]`, the new package will be picked up automatically by `bun install`.

## 2. Next.js + Fumadocs Configuration Files

| File                               | Purpose                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `packages/docs/next.config.mjs`    | Next.js config wrapped with `createMDX` from `fumadocs-mdx/next`                                   |
| `packages/docs/tsconfig.json`      | Extends root `tsconfig.json`, adds `fumadocs-mdx:collections/*` path alias pointing to `.source/*` |
| `packages/docs/source.config.ts`   | Defines the MDX docs collection (`content/docs` directory)                                         |
| `packages/docs/postcss.config.mjs` | PostCSS config for Tailwind CSS (required by Fumadocs UI)                                          |
| `packages/docs/tailwind.config.ts` | Tailwind config with Fumadocs UI preset                                                            |

## 3. App Directory Structure (Next.js App Router)

```
packages/docs/
  app/
    layout.tsx           # Root layout with RootProvider, global nav
    global.css           # Tailwind + Fumadocs UI styles
    page.tsx             # Landing/home page (redirects to /docs or shows intro)
    docs/
      layout.tsx         # DocsLayout with sidebar
      [[...slug]]/
        page.tsx         # Catch-all page rendering MDX content
  lib/
    source.ts            # Fumadocs source loader wiring
```

The landing page at `app/page.tsx` serves as the docs home. All documentation lives under the `/docs` route segment internally (Fumadocs convention), but the site is dedicated entirely to documentation.

## 4. Documentation Content (MDX Files)

```
packages/docs/content/docs/
  index.mdx                # Introduction / overview
  meta.json                # Sidebar ordering
  installation.mdx         # How to install ody
  configuration.mdx        # .ody/ody.json, .ody/prompt.md, Config options
  commands/
    meta.json              # Sidebar ordering for commands section
    index.mdx              # Commands overview
    init.mdx               # ody init -- flags, interactive prompts, behavior
    run.mdx                # ody run -- flags, loop vs once mode, completion marker
    config.mdx             # ody config -- displays current config
    plan/
      meta.json
      index.mdx            # ody plan -- parent command overview
      new.mdx              # ody plan new
      list.mdx             # ody plan list
      edit.mdx             # ody plan edit
      compact.mdx          # ody plan compact
```

Each MDX page will include:

- **Title and description** in frontmatter
- **Synopsis** (command signature)
- **Options/flags** table with types, defaults, and descriptions
- **Behavior** explanation drawn from the actual source code
- **Examples** where appropriate

## 5. Root-Level Adjustments

- **`bun install`** -- run after creating `packages/docs/package.json` to install new dependencies.
- **Root `package.json`** -- no changes needed (workspaces glob already covers `packages/*`).
- Add `packages/docs/.gitignore` for `.next/`, `.source/`, `node_modules/`.

## 6. Development Workflow

- `bun run --filter @ody/docs dev` -- starts the docs dev server.
- `bun run --filter @ody/docs build` -- builds the static docs site.
- Optionally add `docs:dev` and `docs:build` scripts to the root `package.json` for convenience.

## 7. Files to Create (Summary)

| #      | File                                           | Lines (est.) |
| ------ | ---------------------------------------------- | ------------ |
| 1      | `packages/docs/package.json`                   | ~25          |
| 2      | `packages/docs/next.config.mjs`                | ~10          |
| 3      | `packages/docs/tsconfig.json`                  | ~15          |
| 4      | `packages/docs/source.config.ts`               | ~10          |
| 5      | `packages/docs/postcss.config.mjs`             | ~5           |
| 6      | `packages/docs/tailwind.config.ts`             | ~10          |
| 7      | `packages/docs/.gitignore`                     | ~5           |
| 8      | `packages/docs/app/layout.tsx`                 | ~25          |
| 9      | `packages/docs/app/global.css`                 | ~10          |
| 10     | `packages/docs/app/page.tsx`                   | ~15          |
| 11     | `packages/docs/app/docs/layout.tsx`            | ~20          |
| 12     | `packages/docs/app/docs/[[...slug]]/page.tsx`  | ~30          |
| 13     | `packages/docs/lib/source.ts`                  | ~10          |
| 14--25 | MDX content files + meta.json files (12 files) | ~20--60 each |

**Total: ~25 new files**

## 8. Out of Scope (Future Additions)

- Search functionality (Fumadocs supports it but not critical for v1)
- API reference / auto-generated docs from source
- Deployment configuration (Vercel, etc.)
- Custom branding / theme beyond Fumadocs defaults
