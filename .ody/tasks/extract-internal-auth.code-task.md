---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Extract @internal/auth Package

## Description
Extract the credential store logic for Jira and GitHub authentication from `@ody/cli` into a new `@internal/auth` workspace package. This is a leaf package with no internal dependencies, managing named profiles stored in `$XDG_DATA_HOME/ody/auth.json`.

## Background
`@internal/auth` manages credential storage for Jira (email + API token) and GitHub (personal access token) integrations, organized by named profiles. It currently lives in `packages/cli/src/lib/auth.ts`. The extraction requires replacing Bun-specific file I/O (`Bun.write`, `Bun.file`) with Node.js equivalents (`node:fs/promises`) and replacing `Bun.spawn` chmod with `node:fs.chmod`.

## Technical Requirements
1. Create `internal/auth/` directory with `package.json`, `tsconfig.json`, and `src/index.ts` barrel export
2. Move `packages/cli/src/lib/auth.ts` to `internal/auth/src/auth.ts` with these refactors:
   - Replace `Bun.write()` with `fs.writeFile()` from `node:fs/promises`
   - Replace `Bun.file().text()` with `fs.readFile()` from `node:fs/promises`
   - Replace `Bun.spawn` for chmod with `fs.chmod()` from `node:fs/promises`
3. No Bun-specific APIs in any file
4. No internal workspace dependencies
5. `package.json`: `name: "@internal/auth"`, `version: "0.0.1"`, `private: true`, `type: "module"`, `main: "./src/index.ts"`, `types: "./src/index.ts"`, empty dependencies
6. Preserve the full `Auth` namespace: `resolveAuthPath()`, `load()`, `save(store)`, `getJira(profile?)`, `setJira(profile, credentials)`, `getGitHub(profile?)`, `setGitHub(profile, credentials)`
7. Export types: `JiraCredentials`, `GitHubCredentials`, `AuthStore`

## Dependencies
- `update-workspace-structure` task must be completed first

## Implementation Approach
1. Create `internal/auth/` directory structure:
   ```
   internal/auth/
     package.json
     tsconfig.json
     src/
       index.ts
       auth.ts
   ```
2. Write `package.json` with no dependencies (pure Node.js APIs only)
3. Write `tsconfig.json` extending root config
4. Copy `auth.ts` from CLI and refactor all Bun APIs:
   - `Bun.file(path).text()` -> `await readFile(path, 'utf-8')`
   - `Bun.write(path, JSON.stringify(store, null, 2))` -> `await writeFile(path, JSON.stringify(store, null, 2), 'utf-8')`
   - Bun.spawn chmod -> `await chmod(path, 0o600)`
   - Ensure `mkdir` uses `{ recursive: true }` from `node:fs/promises`
5. Create barrel export exporting `Auth` namespace and credential types
6. Run `bun install` to verify workspace resolution

## Acceptance Criteria

1. **Package Structure**
   - Given the `internal/auth/` directory
   - When inspecting its contents
   - Then it contains `package.json`, `tsconfig.json`, and `src/` with `index.ts` and `auth.ts`

2. **No Bun APIs**
   - Given the `internal/auth/src/` files
   - When searching for `Bun.` references
   - Then none are found

3. **Full API Surface**
   - Given the barrel export
   - When checking exported members
   - Then it exports `Auth`, `JiraCredentials`, `GitHubCredentials`, and `AuthStore`

4. **File Security**
   - Given the `Auth.save()` implementation
   - When it writes `auth.json`
   - Then it sets file permissions to `0o600`

5. **Workspace Resolution**
   - Given the updated monorepo
   - When running `bun install`
   - Then `@internal/auth` resolves as a workspace package

## Metadata
- **Complexity**: Low
- **Labels**: extraction, internal-packages, auth
