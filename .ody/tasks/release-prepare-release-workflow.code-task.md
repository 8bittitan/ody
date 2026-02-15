---
status: pending
created: 2026-02-15
started: null
completed: null
---
# Task: Create the Prepare Release GitHub Actions Workflow

## Description
Create `.github/workflows/prepare-release.yml`, a manually-dispatched GitHub Actions workflow that creates a temporary changeset, runs `changeset version` to bump `package.json` and generate a `CHANGELOG.md` entry, and opens a release PR via `peter-evans/create-pull-request`.

## Background
The release plan (`planning/release.md`, Step 3) specifies a dispatch-based release flow. Instead of developers running `bunx changeset` per PR, a maintainer triggers this workflow from the GitHub Actions UI (or `gh workflow run`) when they want to cut a release. The workflow creates a temporary changeset file inline, consumes it with `changeset version`, and opens a PR with the version bump and changelog update.

## Technical Requirements
1. Create `.github/workflows/prepare-release.yml`
2. Trigger: `workflow_dispatch` with two inputs:
   - `bump` (required, choice): `patch`, `minor`, or `major`
   - `summary` (optional, string): release summary for the changelog
3. Permissions: `contents: write`, `pull-requests: write`
4. Job `prepare` on `ubuntu-latest` with these steps:
   - Checkout with `actions/checkout@v4` (fetch-depth: 0)
   - Setup Bun with `oven-sh/setup-bun@v2` using `bun-version-file: .tool-versions`
   - `bun install`
   - Capture current version from `packages/cli/package.json` via `jq`
   - Create a temporary changeset file at `.changeset/release-bump.md` with the chosen bump type and summary
   - Run `bunx changeset version` to consume the changeset and bump the version
   - Capture new version from `packages/cli/package.json` via `jq`
   - Open a PR with `peter-evans/create-pull-request@v7`:
     - Commit message: `release: v<new_version>`
     - Title: `Release v<new_version>`
     - Body: includes bump type, old version, summary, and auto-generation notice
     - Branch: `release/v<new_version>`
     - `delete-branch: true`

## Dependencies
- `.github/workflows/` directory -- must exist (create if needed)
- Depends on: `release-initialize-changesets` (changesets must be configured first)

## Implementation Approach
1. Ensure `.github/workflows/` directory exists
2. Create the workflow file with the exact YAML content specified in the release plan
3. Ensure the changeset file creation uses a heredoc that properly handles the YAML frontmatter format changesets expects
4. Verify the commit message format matches what the Release workflow will look for (`release: v`)

## Acceptance Criteria

1. **Workflow file exists**
   - `.github/workflows/prepare-release.yml` exists and is valid YAML

2. **Trigger is workflow_dispatch**
   - The `on` key includes `workflow_dispatch` with `bump` (choice) and `summary` (string) inputs

3. **Permissions are correct**
   - `contents: write` and `pull-requests: write` are set

4. **Bun setup uses .tool-versions**
   - The `oven-sh/setup-bun@v2` step uses `bun-version-file: .tool-versions`

5. **Changeset is created inline**
   - The workflow creates `.changeset/release-bump.md` with the correct frontmatter referencing `@ody/cli` and the selected bump type

6. **PR is created with correct format**
   - Commit message starts with `release: v` (required by the Release workflow)
   - Branch name follows the `release/v<version>` pattern
   - `delete-branch` is `true`

7. **Default summary fallback**
   - When no summary is provided, the changeset uses a default like `"Release (patch bump)"`

## Metadata
- **Complexity**: Medium
- **Labels**: release, github-actions, workflow
