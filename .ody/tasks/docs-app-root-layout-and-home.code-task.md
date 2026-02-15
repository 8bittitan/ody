---
status: pending
created: 2026-02-15
started: null
completed: null
---
# Task: Create App Root Layout, Global Styles, and Home Page

## Description
Set up the Next.js App Router entry points: the root layout (`app/layout.tsx`) with Fumadocs `RootProvider`, a global CSS file (`app/global.css`) importing Tailwind and Fumadocs UI styles, and the home page (`app/page.tsx`) that serves as the landing page for the documentation site.

## Background
Fumadocs UI requires a `RootProvider` wrapping the entire application to provide theme context and other UI functionality. The root layout is the standard Next.js App Router entry that defines the HTML shell. The global CSS file imports Tailwind CSS directives and Fumadocs UI's stylesheet. The home page at `/` can either show an introduction or redirect to the docs section.

## Technical Requirements
1. `packages/docs/app/layout.tsx` -- Root layout component with `<html>`, `<body>`, Fumadocs `RootProvider`, and metadata export (title, description).
2. `packages/docs/app/global.css` -- Imports Tailwind CSS base/components/utilities and `fumadocs-ui/style.css`.
3. `packages/docs/app/page.tsx` -- Landing page component. Should redirect to `/docs` or display an introductory hero section that links into the docs.

## Dependencies
- Task `docs-nextjs-fumadocs-config` must be completed first (Next.js and Tailwind configs in place).

## Implementation Approach
1. Create `packages/docs/app/global.css`:
   ```css
   @import 'fumadocs-ui/style.css';
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```
2. Create `packages/docs/app/layout.tsx`:
   - Import `RootProvider` from `fumadocs-ui/provider`.
   - Import `./global.css`.
   - Export `metadata` with `title` set to `"ody docs"` and `description` set to `"Documentation for the ody CLI"`.
   - Render `<html lang="en">` > `<body>` > `<RootProvider>` > `{children}`.
   - Use `import type { ReactNode } from 'react'` for the children prop type.
3. Create `packages/docs/app/page.tsx`:
   - Implement a simple redirect to `/docs` using `redirect` from `next/navigation`, or a minimal landing page with a link to `/docs`.
   - A redirect is the simplest approach since the site is dedicated entirely to documentation.

## Acceptance Criteria

1. **Root layout renders without errors**
   - Given the app directory exists with `layout.tsx`
   - When `next dev` is started
   - Then the root layout renders with RootProvider wrapping children

2. **Global styles are loaded**
   - Given `global.css` is imported in the root layout
   - When the page loads in a browser
   - Then Tailwind utility classes and Fumadocs UI styles are applied

3. **Home page redirects or links to docs**
   - Given the home page at `/` is loaded
   - When a user visits the root URL
   - Then they are redirected to `/docs` or see a clear link to the documentation

## Metadata
- **Complexity**: Low
- **Labels**: docs, app-router, layout, styling
