---
status: pending
created: 2026-02-15
started: null
completed: null
---
# Task: Create User-Facing Install Script

## Description
Create `install.sh` at the repo root that allows users to install the correct platform binary with a single `curl` command. The script detects the OS and architecture, fetches the latest release from the GitHub API, and downloads the appropriate binary.

## Background
The release plan (`planning/release.md`, Step 6) specifies an optional but user-friendly install script. Once GitHub Releases are publishing binaries, users can install with:
```bash
curl -fsSL https://raw.githubusercontent.com/8bittitan/ody/main/install.sh | sh
```

## Technical Requirements
1. Create `install.sh` at the repo root
2. Use POSIX `sh` (not bash) for maximum portability (`#!/usr/bin/env sh`)
3. Use `set -eu` for strict error handling
4. Platform detection:
   - OS: `uname -s` mapped to `linux` or `darwin` (error on unsupported)
   - Architecture: `uname -m` mapped to `x64` (for `x86_64`/`amd64`) or `arm64` (for `arm64`/`aarch64`)
5. Fetch latest release tag from `https://api.github.com/repos/8bittitan/ody/releases/latest`
6. Download binary from `https://github.com/8bittitan/ody/releases/download/<tag>/ody-<platform>-<arch>`
7. Install to `$ODY_INSTALL_DIR` (default: `$HOME/.local/bin`)
8. Make binary executable with `chmod +x`
9. Print PATH warning if the install directory is not in `$PATH`

## Dependencies
- Depends on: `release-binaries-workflow` (binaries must be published to GitHub Releases)

## Implementation Approach
1. Create the script with the exact content specified in the release plan
2. The `detect_platform` function handles OS and architecture mapping
3. The `main` function orchestrates: detect platform, fetch latest tag, download binary, set permissions
4. PATH check uses a `case` statement on `":$PATH:"` for POSIX compatibility
5. All network requests use `curl -fsSL` for silent-but-fail-on-error behavior

## Acceptance Criteria

1. **Script exists and is executable-ready**
   - `install.sh` exists at the repo root
   - Starts with `#!/usr/bin/env sh`
   - Uses `set -eu`

2. **Platform detection covers all targets**
   - Correctly maps `Darwin` to `darwin` and `Linux` to `linux`
   - Correctly maps `x86_64`/`amd64` to `x64` and `arm64`/`aarch64` to `arm64`
   - Exits with an error message for unsupported OS or architecture

3. **Configurable install directory**
   - Defaults to `$HOME/.local/bin`
   - Respects `$ODY_INSTALL_DIR` environment variable if set

4. **Binary is downloaded from correct URL**
   - URL follows the pattern `https://github.com/8bittitan/ody/releases/download/<tag>/ody-<platform>-<arch>`

5. **Binary is made executable**
   - `chmod +x` is called on the downloaded binary

6. **PATH warning is displayed when needed**
   - If the install directory is not in `$PATH`, the script prints instructions to add it

7. **Error handling**
   - If the latest release tag cannot be determined, the script exits with an error message
   - If the download fails, `curl -fsSL` causes a non-zero exit

## Metadata
- **Complexity**: Low
- **Labels**: release, install, user-facing, script
