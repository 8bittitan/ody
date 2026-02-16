---
status: completed
created: 2026-02-15
started: 2026-02-15
completed: 2026-02-15
---
# Task: Create Docs Layout, Catch-All Page, and Source Loader

## Description
Implement the Fumadocs documentation routing layer: the `docs/layout.tsx` with sidebar navigation, the `docs/[[...slug]]/page.tsx` catch-all route that renders MDX content, and the `lib/source.ts` module that wires up the Fumadocs source loader from the generated collection data.

## Background
Fumadocs uses a source loader pattern where `source.config.ts` defines collections, and at build time Fumadocs generates `.source/` files. The `lib/source.ts` file creates a `source` object from these generated files, which is then used by the docs layout (for sidebar/navigation tree) and the catch-all page (for resolving slugs to MDX content). The `DocsLayout` component from `fumadocs-ui` provides the sidebar and navigation chrome. The catch-all `[[...slug]]` route handles all documentation pages, including the index.

## Technical Requirements
1. `packages/docs/lib/source.ts` -- Creates and exports a `source` object using `loader()` from `fumadocs-core/source` wired to the generated docs collection from `fumadocs-mdx:collections`.
2. `packages/docs/app/docs/layout.tsx` -- Uses `DocsLayout` from `fumadocs-ui/layouts/docs` with the source's page tree for sidebar navigation.
3. `packages/docs/app/docs/[[...slug]]/page.tsx` -- Catch-all page that resolves the slug via the source loader, renders MDX content with Fumadocs `DocsPage` and `DocsBody` components, and exports `generateStaticParams` for static generation. Returns `notFound()` for unresolvable slugs.

## Dependencies
- Task `docs-app-root-layout-and-home` must be completed first (root layout in place).
- Task `docs-nextjs-fumadocs-config` must be completed first (source.config.ts and tsconfig paths defined).

## Implementation Approach
1. Create `packages/docs/lib/source.ts`:
   ```ts
   import { docs } from 'fumadocs-mdx:collections';
   import { loader } from 'fumadocs-core/source';

   export const source = loader({
     baseUrl: '/docs',
     source: docs.toFumadocsSource(),
   });
   ```
2. Create `packages/docs/app/docs/layout.tsx`:
   - Import `DocsLayout` from `fumadocs-ui/layouts/docs`.
   - Import `source` from `@/lib/source` (or relative path `../../lib/source`).
   - Export default layout component that renders `<DocsLayout tree={source.pageTree}>`.
   - Pass `{children}` inside `DocsLayout`.
3. Create `packages/docs/app/docs/[[...slug]]/page.tsx`:
   - Import `source` from the source loader.
   - Import `DocsPage`, `DocsBody` from `fumadocs-ui/page`.
   - Import `notFound` from `next/navigation`.
   - Define `generateStaticParams` that returns `source.generateParams()`.
   - Define the page component that:
     a. Extracts `slug` from params (as `string[]`).
     b. Calls `source.getPage(slug)` to resolve the page.
     c. Returns `notFound()` if the page doesn't exist.
     d. Gets the MDX `body` component from the page data.
     e. Renders `<DocsPage>` > `<DocsBody>` > `<body />`.
   - Export `generateMetadata` for dynamic page titles and descriptions from frontmatter.

## Acceptance Criteria

1. **Source loader exports correctly**
   - Given `lib/source.ts` exists
   - When imported by other modules
   - Then it exports a `source` object with `pageTree`, `getPage`, `generateParams`, and `getPages` methods

2. **Docs layout renders sidebar**
   - Given MDX content exists in `content/docs/`
   - When the docs layout is rendered
   - Then a sidebar with navigation links derived from the page tree is visible

3. **Catch-all page renders MDX content**
   - Given a valid slug matching an MDX file
   - When the page at `/docs/[slug]` is loaded
   - Then the corresponding MDX content is rendered inside the DocsPage/DocsBody components

4. **Unknown slugs return 404**
   - Given an invalid slug with no matching MDX file
   - When the page is loaded
   - Then Next.js returns a 404 response

5. **Static params are generated**
   - Given `generateStaticParams` is exported
   - When `next build` runs
   - Then all MDX pages are pre-rendered as static pages

## Metadata
- **Complexity**: Medium
- **Labels**: docs, app-router, fumadocs, routing, mdx
