---
status: completed
created: 2026-02-15
started: 2026-02-15
completed: 2026-02-15
---
# Task: Add Package Metadata to `packages/cli/package.json`

## Description
Add missing metadata fields to `packages/cli/package.json` required for the release pipeline. The file currently lacks `description`, `license`, `author`, and `repository` fields. The `version` field should also be bumped from `0.0.1` to `0.1.0` to establish the initial release baseline.

## Background
The release plan (`planning/release.md`, Step 1) requires these fields for changelog generation, GitHub Release metadata, and future npm publishing readiness. Changesets reads `version` from `package.json` to determine the current version and compute the next one.

## Technical Requirements
1. Set `version` to `"0.1.0"` (up from `0.0.1`)
2. Add `"description": "Agentic orchestrator CLI"`
3. Add `"license": "MIT"`
4. Add `"author": "8bittitan"`
5. Add a `repository` object:
   ```json
   {
     "type": "git",
     "url": "https://github.com/8bittitan/ody.git",
     "directory": "packages/cli"
   }
   ```
6. Preserve all existing fields (`bin`, `files`, `type`, `module`, `scripts`, `dependencies`, `keywords`) unchanged

## Dependencies
- `packages/cli/package.json` -- the file to modify

## Implementation Approach
1. Open `packages/cli/package.json`
2. Add the new fields after `version` and before `keywords`
3. Bump `version` from `"0.0.1"` to `"0.1.0"`
4. Verify the JSON is valid and the field order is sensible (name, version, description, license, author, repository, keywords, ...)

## Acceptance Criteria

1. **Version is 0.1.0**
   - `jq -r .version packages/cli/package.json` outputs `0.1.0`

2. **Description field present**
   - `jq -r .description packages/cli/package.json` outputs `Agentic orchestrator CLI`

3. **License field present**
   - `jq -r .license packages/cli/package.json` outputs `MIT`

4. **Author field present**
   - `jq -r .author packages/cli/package.json` outputs `8bittitan`

5. **Repository field present and correct**
   - `jq .repository packages/cli/package.json` outputs the expected object with `type`, `url`, and `directory`

6. **Existing fields unchanged**
   - `bin`, `files`, `type`, `module`, `scripts`, `dependencies`, and `keywords` remain identical to their current values

7. **Valid JSON**
   - `jq . packages/cli/package.json` succeeds without errors

## Metadata
- **Complexity**: Low
- **Labels**: release, package-json, metadata
