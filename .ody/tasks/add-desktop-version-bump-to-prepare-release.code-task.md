---
status: completed
created: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---
# Task: Add Desktop Version Bump Input to Prepare Release Workflow

## Description
Extend `.github/workflows/prepare-release.yml` to accept an optional `desktop_bump` input so that release PRs can carry desktop version updates alongside CLI version bumps. When `desktop_bump` is not `none`, the generated changeset should include `@ody/desktop` with the specified bump level.

## Background
Currently, `prepare-release.yml` only bumps `@ody/cli` when creating a release PR. To support desktop releases, the workflow needs to optionally include `@ody/desktop` in the changeset so that `changeset version` bumps the desktop `package.json` version. Even though `@ody/desktop` is `private: true`, versioning is still useful for desktop release tags and release metadata. The PR body should also reflect when a desktop bump is included.

## Technical Requirements
1. Add a new `workflow_dispatch` input: `desktop_bump` with type `choice`, options `none`, `patch`, `minor`, `major`, default `none`.
2. Modify the changeset creation step to conditionally include `'@ody/desktop': <bump>` in the frontmatter when `desktop_bump != 'none'`.
3. Update the "Get new version" step to also read the desktop version from `packages/desktop/package.json` when a desktop bump was applied.
4. Update the PR body template to include desktop version information when `desktop_bump != 'none'`.
5. Ensure `@ody/desktop` is recognized by changesets — verify or add a `.changeset/config.json` entry if needed (changesets may need the package to not be in an `ignore` list).

## Dependencies
- Requires `packages/desktop/package.json` to have a `version` field (currently `0.0.1` — confirmed).
- Should be completed before the desktop tag creation task, since that task reads the desktop version from `package.json`.
- Independent of `release.yml` changes — can be done in parallel with change detection and CLI refactor tasks.

## Implementation Approach
1. Open `.github/workflows/prepare-release.yml`.
2. Add the `desktop_bump` input under `workflow_dispatch.inputs`, after the existing `bump` input.
3. In the "Create changeset" step, modify the heredoc to conditionally add the desktop line:
   - Use a bash conditional: if `${{ inputs.desktop_bump }}` is not `none`, append `'@ody/desktop': ${{ inputs.desktop_bump }}` to the changeset frontmatter.
   - Example approach: build the changeset content in a variable, conditionally adding the desktop line.
4. Add a step to read the new desktop version after `bunx changeset version` runs (only when `desktop_bump != 'none'`).
5. Update the PR title and body to mention desktop version when applicable (e.g., "Release v1.2.3 + Desktop v0.1.0").
6. Verify that the changeset config (`.changeset/config.json`) does not exclude `@ody/desktop` from versioning.

## Acceptance Criteria

1. **Desktop bump input available**
   - Given a user triggers the Prepare Release workflow
   - When they view the workflow dispatch form
   - Then a `desktop_bump` dropdown is visible with options: `none`, `patch`, `minor`, `major`

2. **Changeset includes desktop when bumped**
   - Given `desktop_bump` is set to `minor`
   - When the changeset is generated
   - Then the changeset frontmatter includes `'@ody/desktop': minor` alongside the CLI bump

3. **Changeset excludes desktop when none**
   - Given `desktop_bump` is `none` (default)
   - When the changeset is generated
   - Then the changeset frontmatter only includes `'@ody/cli': <bump>` with no desktop entry

4. **Desktop version is bumped in package.json**
   - Given `desktop_bump` is `patch` and the current desktop version is `0.0.1`
   - When `bunx changeset version` runs
   - Then `packages/desktop/package.json` version becomes `0.0.2`

5. **PR body reflects desktop bump**
   - Given both CLI and desktop bumps are applied
   - When the release PR is created
   - Then the PR body mentions both CLI and desktop version numbers

## Metadata
- **Complexity**: Medium
- **Labels**: ci, release, desktop, prepare-release
