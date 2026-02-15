---
status: pending
created: 2026-02-15
started: null
completed: null
---
# Task: Create the Release (Tag) GitHub Actions Workflow

## Description
Create `.github/workflows/release.yml`, a workflow that triggers on pushes to `main` when `packages/cli/package.json` changes and creates a git tag if the commit is a release commit. The tag push then triggers the Binaries workflow.

## Background
The release plan (`planning/release.md`, Step 4) specifies this as the bridge between the Prepare Release PR merge and the binary build. When a release PR is merged into `main`, this workflow detects the `release: v` commit message prefix, reads the version from `package.json`, creates a lightweight git tag (e.g., `v0.1.1`), and pushes it. The tag push is what triggers the Binaries workflow.

## Technical Requirements
1. Create `.github/workflows/release.yml`
2. Trigger: `push` to `main` branch, filtered to `paths: ['packages/cli/package.json']`
3. Permissions: `contents: write`
4. Job `tag` on `ubuntu-latest` with:
   - `if` condition: `startsWith(github.event.head_commit.message, 'release: v')`
   - Checkout with `actions/checkout@v4`
   - A step that:
     - Reads the version from `packages/cli/package.json` using `jq`
     - Constructs the tag name as `v<version>`
     - Checks if the tag already exists (skip if it does)
     - Creates a lightweight tag and pushes it to `origin`

## Dependencies
- `.github/workflows/` directory -- must exist
- Depends on: `release-prepare-release-workflow` (the commit message format `release: v` must match)

## Implementation Approach
1. Create the workflow file with the exact YAML content specified in the release plan
2. The `if` condition on the job ensures only release commits trigger tagging
3. The idempotency check (`git rev-parse "$TAG"`) prevents duplicate tags
4. Use `jq -r .version` to read the version cleanly

## Acceptance Criteria

1. **Workflow file exists**
   - `.github/workflows/release.yml` exists and is valid YAML

2. **Trigger is push to main with path filter**
   - Triggers on `push` to `main` branch
   - Filtered to `packages/cli/package.json` path changes only

3. **Job condition matches release commits**
   - The `if` condition checks for `release: v` prefix in the head commit message

4. **Tag creation is idempotent**
   - If the tag already exists, the workflow exits cleanly without error

5. **Tag format matches convention**
   - Tags are created as `v<version>` (e.g., `v0.1.1`)

6. **Tag is pushed to origin**
   - `git push origin "$TAG"` is called after tag creation

## Metadata
- **Complexity**: Low
- **Labels**: release, github-actions, workflow, tagging
