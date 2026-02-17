---
status: completed
created: 2026-02-17
started: 2026-02-17
completed: 2026-02-17
---
# Task: Add Self-Update CLI Command

## Description
Add an `ody update` command that checks for a newer release on GitHub and replaces the running binary in-place. This gives users a single-command upgrade path without needing to re-run the install script or manually download a release.

## Background
The CLI is distributed as a compiled Bun binary via GitHub Releases. Platform-specific binaries (`ody-darwin-arm64`, `ody-darwin-x64`, `ody-linux-x64`, `ody-linux-arm64`) are published to `https://github.com/8bittitan/ody/releases`. The existing `install.sh` script handles initial installation, but there is currently no mechanism for an already-installed binary to update itself. The current version is baked into the binary at compile time via `packages/cli/package.json` and is accessible through `pkg.version` (imported in `packages/cli/src/index.ts`).

## Technical Requirements
1. Create a new command file at `packages/cli/src/cmd/update.ts` exporting `updateCmd`
2. Register the command in `packages/cli/src/index.ts` as a lazy-loaded subcommand: `update: () => import('./cmd/update').then((m) => m.updateCmd)`
3. Use the GitHub Releases API (`https://api.github.com/repos/8bittitan/ody/releases/latest`) to fetch the latest release tag
4. Compare the remote version against the current version (`pkg.version` from `package.json`)
5. Map `process.platform` and `process.arch` to the correct binary artifact name:
   - `darwin` + `arm64` → `ody-darwin-arm64`
   - `darwin` + `x64` → `ody-darwin-x64`
   - `linux` + `x64` → `ody-linux-x64`
   - `linux` + `arm64` → `ody-linux-arm64`
6. Download the new binary using `fetch()` and write it over the current binary path (`process.execPath`) using `Bun.write()`
7. Set the downloaded binary as executable (`chmod +x` via `Bun.spawn` or `fs/promises`)
8. Support a `--check` flag that only reports whether an update is available without downloading
9. Handle edge cases: unsupported platform/arch, network failures, permission errors on the binary path, and the case where the user is already on the latest version
10. Use `@clack/prompts` (`log`, `spinner`, `confirm`, `intro`, `outro`) for all user-facing output consistent with existing commands

## Dependencies
- GitHub Releases must contain published binaries (already in place via `release.yml` workflow)
- `@clack/prompts` (already a dependency)
- `citty` (already a dependency)
- No new external dependencies required — `fetch`, `Bun.write`, and `Bun.spawn` cover all needs

## Implementation Approach
1. **Create the command file** at `packages/cli/src/cmd/update.ts` using `defineCommand` from `citty`. Define `meta` with name `update` and a description. Add a `--check` boolean arg (alias `-c`) that defaults to `false`.
2. **Determine the current version** by importing `pkg` from `../../package.json` and reading `pkg.version`.
3. **Fetch the latest release** from the GitHub API. Parse the JSON response to extract the `tag_name` (e.g., `v0.1.3`). Strip the leading `v` to get the semver string. Use a `spinner` while the network request is in flight.
4. **Compare versions** using simple string comparison or a lightweight semver check. If the versions match, log that the CLI is already up to date and exit early with `outro`.
5. **Handle `--check` mode** — if the flag is set and a newer version exists, log the available version and exit without downloading.
6. **Resolve the platform artifact name** by mapping `process.platform` and `process.arch`. Exit with `log.error` if the combination is unsupported.
7. **Confirm the update** with `confirm()` from `@clack/prompts`, showing the current and target versions.
8. **Download the binary** from `https://github.com/8bittitan/ody/releases/download/<tag>/<artifact>` using `fetch()`. Show a spinner during download. Verify the response is OK.
9. **Write the binary** to `process.execPath` using `Bun.write()`. Then make it executable with `chmod` via `Bun.spawn` or `fs/promises`.
10. **Register the command** in `packages/cli/src/index.ts` by adding the `update` entry to the root command's `subCommands` object.
11. **Wrap all I/O in try/catch** — log actionable error messages for network failures (`log.error` with suggestion to check connectivity) and permission errors (`log.error` with suggestion to use `sudo` or check file ownership).

## Acceptance Criteria

1. **Command is registered and callable**
   - Given the CLI is built and installed
   - When the user runs `ody update`
   - Then the update command executes without errors

2. **Already up to date**
   - Given the installed version matches the latest GitHub release
   - When the user runs `ody update`
   - Then a message is displayed indicating the CLI is already on the latest version and no download occurs

3. **New version available and installed**
   - Given a newer version exists on GitHub Releases
   - When the user runs `ody update` and confirms the prompt
   - Then the correct platform binary is downloaded and written to `process.execPath`, and a success message is displayed with the new version

4. **Check-only mode**
   - Given a newer version exists on GitHub Releases
   - When the user runs `ody update --check`
   - Then the available version is displayed but no download or replacement occurs

5. **User declines update**
   - Given a newer version exists on GitHub Releases
   - When the user runs `ody update` and declines the confirmation prompt
   - Then no download occurs and the command exits gracefully

6. **Unsupported platform handling**
   - Given the CLI is running on an unsupported OS or architecture
   - When the user runs `ody update`
   - Then an error message is displayed indicating the platform is not supported

7. **Network failure handling**
   - Given the GitHub API or binary download URL is unreachable
   - When the user runs `ody update`
   - Then an error message is logged and the existing binary is not modified

8. **Permission error handling**
   - Given the user does not have write permission to the binary path
   - When the update attempts to write the new binary
   - Then an actionable error message is displayed suggesting how to fix permissions

## Metadata
- **Complexity**: Medium
- **Labels**: cli, command, update, self-update, ux
