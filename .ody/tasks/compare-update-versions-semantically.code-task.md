---
status: completed
created: 2026-03-06
started: 2026-03-06
completed: 2026-03-06
---
# Task: Compare CLI Update Versions Semantically Instead of by String Equality

## Description
The CLI update check currently decides whether an update is needed by testing whether the current and latest version strings are different. Replace this with semantic version comparison so newer local builds, prereleases, and equal normalized versions are handled correctly and `ody update` does not offer a downgrade or false-positive update.

## Background
`packages/cli/src/lib/installation.ts` exposes `needsUpdate(latest)` as `CURRENT !== latest`. That is too weak for real release handling:

- a locally newer version still appears to “need update”
- prerelease or dev build formats can be mishandled
- semantically equal versions with formatting differences can produce false positives

Since `Installation.checkLatest()` already normalizes the leading `v` prefix, the next step is to compare versions by ordering rather than inequality.

## Technical Requirements
1. `Installation.needsUpdate()` must return `true` only when the remote release is newer than the current installed version
2. Equal versions must return `false`
3. A locally newer version must return `false` and must not trigger an update offer
4. Leading `v` normalization must continue to work for release tags
5. Add tests covering normal releases, equal versions, and prerelease or local-newer scenarios

## Dependencies
- `packages/cli/src/lib/installation.ts` — current version normalization and update comparison
- `packages/cli/src/cmd/update.ts` — consumes `needsUpdate()` to decide whether to offer installation
- `package.json` version field for the current CLI version

## Implementation Approach
1. Introduce semantic version comparison in `packages/cli/src/lib/installation.ts`
2. Prefer a small, well-contained comparison strategy:
   - use an existing runtime/library facility already present in the repo, or
   - add a minimal dependency-free comparator if introducing a dependency is unnecessary
3. Preserve the current `stripLeadingV()` normalization step before comparison
4. Update `needsUpdate()` to express “remote > current” instead of “remote !== current”
5. Add tests that pin behavior for:
   - `1.2.3` vs `1.2.3`
   - `1.2.3` vs `1.2.4`
   - `1.2.4` local vs `1.2.3` remote
   - prerelease comparisons if supported by the chosen comparator

## Acceptance Criteria

1. **Equal versions do not trigger an update**
   - Given current version `1.2.3` and latest version `1.2.3`
   - When `needsUpdate()` is evaluated
   - Then it returns `false`

2. **Remote newer version triggers an update**
   - Given current version `1.2.3` and latest version `1.2.4`
   - When `needsUpdate()` is evaluated
   - Then it returns `true`

3. **Local newer version does not trigger a downgrade**
   - Given current version `1.2.4` and latest version `1.2.3`
   - When `needsUpdate()` is evaluated
   - Then it returns `false`

4. **Normalized tags still work**
   - Given latest version `v1.2.4`
   - When the update check runs
   - Then the comparison uses the normalized semantic version correctly

## Metadata
- **Complexity**: Low
- **Labels**: cli, update, versioning
