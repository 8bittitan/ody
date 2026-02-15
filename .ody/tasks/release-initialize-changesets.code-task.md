---
status: completed
created: 2026-02-15
started: 2026-02-15
completed: 2026-02-15
---
# Task: Initialize Changesets for Version Management

## Description
Install the `@changesets/cli` package as a root workspace dev dependency and initialize the `.changeset/` directory with a project-specific configuration. Changesets is used as a versioning engine only -- no per-change changeset files are created during development.

## Background
The release plan (`planning/release.md`, Step 2) uses Changesets to bump `package.json` versions and generate `CHANGELOG.md` entries. The Prepare Release GitHub Action creates a temporary changeset and immediately consumes it with `changeset version`, so the `.changeset/` directory only needs the base config.

## Technical Requirements
1. Install `@changesets/cli` as a root workspace dev dependency: `bun add -D -w @changesets/cli`
2. Run `bunx changeset init` to scaffold the `.changeset/` directory (creates `config.json` and `README.md`)
3. Edit `.changeset/config.json` to match the following configuration:
   ```json
   {
     "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
     "changelog": "@changesets/cli/changelog",
     "commit": false,
     "fixed": [],
     "linked": [],
     "access": "restricted",
     "baseBranch": "main",
     "updateInternalDependencies": "patch",
     "ignore": []
   }
   ```
4. Verify that `access` is `"restricted"` (not publishing to npm yet)
5. Verify that `commit` is `false` (the GitHub Action handles committing)

## Dependencies
- Root `package.json` -- will be modified to add the dev dependency
- `bun.lock` -- will be updated by `bun install`
- Depends on: none (can run independently)

## Implementation Approach
1. Run `bun add -D -w @changesets/cli` from the repo root
2. Run `bunx changeset init` to create `.changeset/config.json` and `.changeset/README.md`
3. Overwrite `.changeset/config.json` with the exact configuration specified above
4. Verify the config is valid JSON

## Acceptance Criteria

1. **Dev dependency installed**
   - `jq '.devDependencies["@changesets/cli"]' package.json` returns a version string

2. **Changeset directory exists**
   - `.changeset/config.json` exists
   - `.changeset/README.md` exists

3. **Config matches specification**
   - `access` is `"restricted"`
   - `commit` is `false`
   - `baseBranch` is `"main"`
   - `changelog` is `"@changesets/cli/changelog"`

4. **No leftover changeset files**
   - No `.changeset/*.md` files exist other than `README.md`

5. **`bun install` succeeds**
   - Running `bun install` from the root completes without errors

## Metadata
- **Complexity**: Low
- **Labels**: release, changesets, setup
