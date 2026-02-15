---
status: completed
created: 2026-02-15
started: 2026-02-15
completed: 2026-02-15
---
# Task: Generate Configuration Schema in Release Pipeline

## Description
Update the release pipeline to generate the JSON Schema for the `.ody/ody.json` configuration file and include it as a release artifact. The schema generation script already exists at `packages/cli/scripts/schema.ts` and outputs to `packages/cli/dist/configuration_schema.json`. This task integrates that script into the `binaries.yml` workflow so each release ships with the schema alongside the platform binaries.

## Background
The CLI has a Zod-based configuration schema (`Config.Schema` in `packages/cli/src/lib/config.ts`) and a script at `packages/cli/scripts/schema.ts` that converts it to a JSON Schema file using `z.toJSONSchema()`. The script writes to `./dist/configuration_schema.json` (relative to `packages/cli`). Currently this script is only runnable locally via `bun run gen:schema` from the `packages/cli` directory. The release pipeline (`binaries.yml`) builds cross-platform binaries and uploads them as artifacts that are then bundled into a GitHub Release by `softprops/action-gh-release`. The schema file needs to be generated and included in this release so users and tooling can reference the official schema for their `.ody/ody.json` configuration files.

## Technical Requirements
1. Add a step to the `binaries.yml` workflow that runs the schema generation script (`bun run gen:schema`) from the `packages/cli` working directory
2. The schema generation step must run only once (not per matrix job) — it should be placed in a dedicated job or in the existing `release` job before the GitHub Release step
3. The generated `configuration_schema.json` must be uploaded as an artifact and included in the GitHub Release files alongside the binaries
4. The schema generation step must run after `bun install` so dependencies (Zod, config module) are available
5. The output file must retain the name `configuration_schema.json` in the release assets

## Dependencies
- `packages/cli/scripts/schema.ts` — the existing schema generation script (already implemented)
- `packages/cli/src/lib/config.ts` — provides `Config.Schema` used by the script
- `.github/workflows/binaries.yml` — the workflow to be modified
- Zod v4's `z.toJSONSchema()` — used by the script to convert the schema

## Implementation Approach
1. Read the current `binaries.yml` workflow to understand the existing job structure (two jobs: `build` matrix and `release`)
2. Add a new job `schema` (parallel to `build`) that checks out the repo, sets up Bun, installs dependencies, runs `bun run gen:schema` from `packages/cli`, and uploads `configuration_schema.json` as an artifact
3. Update the `release` job's `needs` array to include both `build` and `schema` so it waits for all artifacts
4. The `release` job already downloads all artifacts with `merge-multiple: true` and globs `artifacts/*`, so the schema file will automatically be included in the GitHub Release without additional file path changes
5. Verify the workflow YAML is valid and that artifact names don't collide with the binary artifact names

## Acceptance Criteria

1. **Schema job exists in binaries workflow**
   - Given the `binaries.yml` workflow is triggered by a `v*` tag push
   - When the workflow runs
   - Then a `schema` job executes that generates `configuration_schema.json`

2. **Schema generation runs successfully**
   - Given the `schema` job checks out the repo and installs dependencies
   - When `bun run gen:schema` is executed in the `packages/cli` working directory
   - Then `packages/cli/dist/configuration_schema.json` is produced without errors

3. **Schema is uploaded as an artifact**
   - Given the schema file is generated
   - When the `schema` job completes
   - Then `configuration_schema.json` is available as a downloadable artifact

4. **Release job depends on schema and build**
   - Given the `release` job has `needs: [build, schema]`
   - When both the `build` and `schema` jobs succeed
   - Then the `release` job proceeds to create the GitHub Release

5. **Schema is included in GitHub Release assets**
   - Given the `release` job downloads all artifacts with `merge-multiple: true`
   - When `softprops/action-gh-release` runs with `files: artifacts/*`
   - Then `configuration_schema.json` appears in the release assets alongside the platform binaries

6. **No changes to the schema script**
   - Given the existing `packages/cli/scripts/schema.ts` works correctly
   - When the workflow is updated
   - Then the script itself is not modified

## Metadata
- **Complexity**: Low
- **Labels**: release, github-actions, schema, configuration
