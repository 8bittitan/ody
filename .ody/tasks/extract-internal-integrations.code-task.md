---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Extract @internal/integrations Package

## Description
Extract Jira and GitHub API clients plus shared HTTP retry utilities from `@ody/cli` into a new `@internal/integrations` workspace package. These modules already use standard `fetch` and are compatible with both Bun and Node.js runtimes, requiring no API changes.

## Background
`@internal/integrations` provides Jira ticket fetching/parsing, GitHub issue fetching/parsing, and a shared HTTP utility with retry logic (exponential backoff, timeout, jitter). Currently these live in `packages/cli/src/lib/jira.ts`, `packages/cli/src/lib/github.ts`, and `packages/cli/src/lib/http.ts`. All three use standard web APIs (`fetch`, `AbortController`, `setTimeout`) that work in both Bun and Node.js, so no runtime refactoring is needed.

## Technical Requirements
1. Create `internal/integrations/` directory with `package.json`, `tsconfig.json`, and `src/index.ts` barrel export
2. Move files from `packages/cli/src/lib/` to `internal/integrations/src/`:
   - `jira.ts` -- no changes needed
   - `github.ts` -- no changes needed
   - `http.ts` -- no changes needed
3. Package depends on `@internal/auth` (for credential types/access)
4. `package.json`: `name: "@internal/integrations"`, `version: "0.0.1"`, `private: true`, `type: "module"`
5. Export the `Jira`, `GitHub`, and `Http` namespaces plus their associated types

## Dependencies
- `extract-internal-auth` task must be completed first

## Implementation Approach
1. Create `internal/integrations/` directory structure:
   ```
   internal/integrations/
     package.json
     tsconfig.json
     src/
       index.ts
       jira.ts
       github.ts
       http.ts
   ```
2. Write `package.json` with `@internal/auth` as workspace dependency
3. Write `tsconfig.json` extending root config
4. Copy `jira.ts`, `github.ts`, `http.ts` from CLI without modification (already Node-compatible)
5. Update any import paths that referenced CLI-internal paths to use `@internal/auth` for credential types
6. Create barrel export:
   - `Jira`, `JiraTicket`, `JiraParsedInput` types
   - `GitHub`, `GitHubIssue`, `ParsedIssueInput` types
   - `Http`
7. Run `bun install` and verify workspace resolution

## Acceptance Criteria

1. **Package Structure**
   - Given the `internal/integrations/` directory
   - When inspecting its contents
   - Then it contains all integration source files and configuration

2. **No Bun APIs**
   - Given the `internal/integrations/src/` files
   - When searching for `Bun.` references
   - Then none are found

3. **Jira API Surface Preserved**
   - Given the `Jira` export
   - When checking its members
   - Then it has `parseInput`, `fetchTicket`, and `formatAsDescription`

4. **GitHub API Surface Preserved**
   - Given the `GitHub` export
   - When checking its members
   - Then it has `parseInput`, `fetchIssue`, and `formatAsDescription`

5. **HTTP Retry Works**
   - Given `Http.fetchWithRetry`
   - When called with default options
   - Then it supports timeout (5s default), retry on 408/429/5xx, and exponential backoff

## Metadata
- **Complexity**: Low
- **Labels**: extraction, internal-packages, integrations
