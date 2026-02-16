---
status: completed
created: 2026-02-15
started: 2026-02-15
completed: 2026-02-15
---
# Task: Create the `packages/docs` Workspace Package

## Description
Bootstrap the `packages/docs` directory as a new workspace package in the Bun monorepo. This is the foundational task that establishes the package identity, declares all required dependencies (Next.js, React, Fumadocs), and adds a `.gitignore` for build artifacts. All subsequent docs tasks depend on this package existing and its dependencies being installed.

## Background
The ody monorepo uses Bun workspaces with a `"workspaces": ["packages/*"]` glob in the root `package.json`. Adding a new `packages/docs/package.json` is sufficient for Bun to discover it -- no root config changes are needed. The docs site uses Next.js with Fumadocs for MDX-based documentation, plus Tailwind CSS for styling via the Fumadocs UI preset.

## Technical Requirements
1. Create `packages/docs/package.json` with name `@ody/docs`, `"type": "module"`, and standard Next.js scripts (`dev`, `build`, `start`).
2. Declare runtime dependencies: `next`, `react`, `react-dom`, `fumadocs-core`, `fumadocs-mdx`, `fumadocs-ui`.
3. Declare dev dependencies: `@types/mdx`, `@types/react`, `@types/react-dom`, `typescript`, `tailwindcss`, `postcss`, `autoprefixer`.
4. Create `packages/docs/.gitignore` ignoring `.next/`, `.source/`, and `node_modules/`.
5. Run `bun install` from the repo root to resolve and install all new dependencies.

## Dependencies
- None -- this is the first task in the docs setup sequence.

## Implementation Approach
1. Create the `packages/docs/` directory.
2. Write `packages/docs/package.json` with the following structure:
   - `name`: `@ody/docs`
   - `version`: `0.0.0` (private package, no publish)
   - `private`: `true`
   - `type`: `module`
   - `scripts.dev`: `next dev`
   - `scripts.build`: `next build`
   - `scripts.start`: `next start`
   - Dependencies and devDependencies as listed in Technical Requirements.
3. Write `packages/docs/.gitignore` with entries for `.next/`, `.source/`, and `node_modules/`.
4. Run `bun install` at the repo root to install all new dependencies and link the workspace.
5. Verify `node_modules` inside `packages/docs` is linked correctly (e.g., `next` is resolvable).

## Acceptance Criteria

1. **Package file exists and is valid JSON**
   - Given the monorepo root
   - When `cat packages/docs/package.json` is run
   - Then valid JSON is printed with `name` equal to `@ody/docs` and all required dependencies present

2. **Bun recognizes the workspace**
   - Given `bun install` has been run
   - When `bun pm ls` is executed from the root
   - Then `@ody/docs` appears in the workspace listing

3. **Gitignore is in place**
   - Given `packages/docs/.gitignore` exists
   - When its contents are read
   - Then it contains `.next/`, `.source/`, and `node_modules/`

4. **Dependencies resolve**
   - Given `bun install` succeeded
   - When `bun run --filter @ody/docs build` is attempted (expected to fail since Next.js config doesn't exist yet)
   - Then the failure is due to missing config/pages, not missing dependencies

## Metadata
- **Complexity**: Low
- **Labels**: docs, setup, workspace, package.json
