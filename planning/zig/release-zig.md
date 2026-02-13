# Release Plan: Zig CLI — GitHub Releases + Install Script

Release strategy for the Zig-based Ody CLI. Replaces the Bun/Changesets
pipeline from `planning/release.md` with a Zig-native approach. No npm, no
Node, no Bun runtime required by end users.

Uses [git-cliff](https://github.com/orhun/git-cliff) to generate changelogs
and release notes from
[conventional commits](https://www.conventionalcommits.org/).

## Overview

```
You trigger "Prepare Release" workflow (pick a version)
        |
        v
git-cliff collects conventional commits since the last tag,
  groups them (Features, Bug Fixes, etc.),
  updates CHANGELOG.md, updates cli/VERSION
        |
        v
Opens a "Release vX.Y.Z" PR with changelog + version bump
        |
        v
You review and merge the PR
        |
        v
Release workflow detects the merge, creates + pushes git tag
        |
        v
Build workflow triggers on tag push:
  - Cross-compiles 4 static binaries from a single runner
  - Generates SHA-256 checksums
  - Creates GitHub Release with binaries + checksums + release notes
        |
        v
Users install via:
  - curl install script (auto-detects OS/arch)
  - Direct download from GitHub Releases
  - Homebrew tap (future)
```

## Prerequisites

- GitHub repository: `8bittitan/ody`
- No additional secrets required (`GITHUB_TOKEN` is provided automatically)
- Zig is used only in CI for building — users never need Zig installed
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/)

## Target Matrix

| Target          | Binary Name         | OS / Architecture   |
| --------------- | ------------------- | ------------------- |
| `x86_64-linux`  | `ody-linux-x86_64`  | Linux x86_64        |
| `aarch64-linux` | `ody-linux-aarch64` | Linux ARM64         |
| `x86_64-macos`  | `ody-macos-x86_64`  | macOS Intel         |
| `aarch64-macos` | `ody-macos-aarch64` | macOS Apple Silicon |

Windows targets (`x86_64-windows`) can be added later if needed.

All binaries are statically linked with no runtime dependencies. Zig's
cross-compilation means every target can be built from a single
`ubuntu-latest` runner.

## Versioning

Version is embedded at compile time via `build.zig` build options. A
`cli/VERSION` file serves as the source of truth. Local dev builds read
from the file; CI builds pass the version explicitly.

### `cli/VERSION`

```
0.1.0
```

Plain text, single line, no `v` prefix. Updated by the prepare-release
workflow.

### `build.zig` Version Embedding

```zig
const version = b.option([]const u8, "version", "Build version string") orelse @embedFile("VERSION");

const options = b.addOptions();
options.addOption([]const u8, "version", version);

exe.root_module.addOptions("build_options", options);
```

In `src/main.zig`:

```zig
const build_options = @import("build_options");

// Used by --version flag
const VERSION = build_options.version;
```

This means:

- Local dev builds embed the version from `cli/VERSION` (e.g., `0.1.0`)
- CI release builds pass `-Dversion=1.0.0` explicitly (stripped from the tag)
- The `VERSION` file is bumped automatically by the prepare-release workflow

## Step 1: Configure git-cliff

Create `cliff.toml` at the repo root. This controls how conventional commits
are parsed, grouped, and rendered into changelog entries.

### `cliff.toml`

```toml
[changelog]
header = "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n"
body = """
{% if version %}\
  ## {{ version }} ({{ timestamp | date(format="%Y-%m-%d") }})
{% else %}\
  ## Unreleased
{% endif %}\

{% for group, commits in commits | group_by(attribute="group") %}
  ### {{ group | upper_first }}
  {% for commit in commits %}
    - {{ commit.message | split(pat="\n") | first | trim }}\
      {% if commit.breaking %} (**BREAKING**){% endif %}\
  {% endfor %}
{% endfor %}\n
"""
trim = true

[git]
conventional_commits = true
filter_unconventional = false
split_commits = false

commit_parsers = [
  { message = "^feat",     group = "Features" },
  { message = "^fix",      group = "Bug Fixes" },
  { message = "^perf",     group = "Performance" },
  { message = "^refactor", group = "Refactoring" },
  { message = "^docs",     group = "Documentation" },
  { message = "^test",     group = "Testing" },
  { message = "^ci",       group = "CI" },
  { message = "^chore",    skip = true },
  { message = "^build",    skip = true },
  { message = "^release:", skip = true },
]

tag_pattern = "v[0-9].*"
```

Key decisions:

- `chore:`, `build:`, and `release:` commits are skipped (noise)
- Breaking changes (commits with `!` or `BREAKING CHANGE` footer) get flagged
- Non-conventional commits are still included (not filtered out), just ungrouped
- The `release:` skip prevents the release PR's merge commit from appearing
  in the next release's changelog

### Example Output

Given these commits since the last tag:

```
feat: add label filtering to run command
feat: add plan compact subcommand
fix: maxIterations 0 treated as 1
fix: stderr pipe deadlock in run loop
refactor: extract stream draining into utility
chore: update gitignore
```

git-cliff produces:

```markdown
## v1.2.0 (2026-02-12)

### Features

- add label filtering to run command
- add plan compact subcommand

### Bug Fixes

- maxIterations 0 treated as 1
- stderr pipe deadlock in run loop

### Refactoring

- extract stream draining into utility
```

The `chore:` commit is skipped.

## Step 2: Create the Prepare Release Workflow

Create `.github/workflows/prepare-release.yml`. This is a manually-dispatched
workflow that generates the changelog from conventional commits, updates the
`VERSION` file, and opens a PR.

```yaml
name: Prepare Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release (e.g. 1.2.0, without v prefix)'
        required: true
        type: string

permissions:
  contents: write
  pull-requests: write

jobs:
  prepare:
    name: Prepare release PR
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Validate version format
        run: |
          VERSION="${{ inputs.version }}"
          if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
            echo "::error::Invalid version format: ${VERSION}"
            exit 1
          fi

      - name: Check tag doesn't already exist
        run: |
          if git rev-parse "v${{ inputs.version }}" >/dev/null 2>&1; then
            echo "::error::Tag v${{ inputs.version }} already exists"
            exit 1
          fi

      - name: Update CHANGELOG.md
        uses: orhun/git-cliff-action@v4
        with:
          config: cliff.toml
          args: --tag v${{ inputs.version }} --unreleased
        env:
          OUTPUT: CHANGELOG.md
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Generate release body
        uses: orhun/git-cliff-action@v4
        id: release-body
        with:
          config: cliff.toml
          args: --tag v${{ inputs.version }} --unreleased --strip header
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Update VERSION file
        run: echo "${{ inputs.version }}" > cli/VERSION

      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v7
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: 'release: v${{ inputs.version }}'
          title: 'Release v${{ inputs.version }}'
          body: |
            ## Release v${{ inputs.version }}

            ${{ steps.release-body.outputs.content }}

            ---

            Merging this PR will trigger tag creation and binary builds.
          branch: release/v${{ inputs.version }}
          delete-branch: true
```

How this works:

- First `git-cliff` call generates the full `CHANGELOG.md` with the new
  version prepended to existing entries
- Second `git-cliff` call generates just the release body (no header) for
  the PR description, via `--strip header`
- The `VERSION` file is updated to the new version
- `peter-evans/create-pull-request` commits the changes and opens a PR on
  a `release/vX.Y.Z` branch

### Triggering a Release

From the GitHub UI:

1. Go to **Actions** > **Prepare Release**
2. Click **Run workflow**
3. Enter the version (e.g., `1.2.0`)
4. Click **Run workflow**
5. Review the resulting PR (changelog, version bump)
6. Merge the PR

Or from the CLI:

```bash
gh workflow run prepare-release.yml -f version=1.2.0
```

## Step 3: Create the Release Workflow

Create `.github/workflows/release.yml`. This has two jobs:

1. **Tag** — Runs when a release PR is merged to `main`. Detects the
   `release: v*` commit message, creates and pushes a git tag.
2. **Build** — Runs when a `v*` tag is pushed. Cross-compiles all targets,
   generates checksums, and creates a GitHub Release with conventional commit
   release notes.

```yaml
name: Release

on:
  push:
    branches:
      - main
    paths:
      - 'cli/VERSION'
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  # --- Job 1: Create git tag from merged release PR ---
  tag:
    name: Create tag
    runs-on: ubuntu-latest
    if: >-
      github.ref == 'refs/heads/main' &&
      startsWith(github.event.head_commit.message, 'release: v')
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Create and push tag
        run: |
          VERSION=$(cat cli/VERSION)
          TAG="v${VERSION}"

          if git rev-parse "$TAG" >/dev/null 2>&1; then
            echo "Tag $TAG already exists, skipping."
            exit 0
          fi

          echo "Creating tag $TAG"
          git tag "$TAG"
          git push origin "$TAG"

  # --- Job 2: Build binaries and create GitHub Release ---
  build:
    name: Build binaries
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Zig
        uses: mlugg/setup-zig@v2
        with:
          version: 0.14.0

      - name: Extract version
        id: version
        run: echo "version=${GITHUB_REF_NAME#v}" >> "$GITHUB_OUTPUT"

      - name: Build all targets
        working-directory: cli
        run: |
          VERSION="${{ steps.version.outputs.version }}"
          mkdir -p dist

          for target in x86_64-linux aarch64-linux x86_64-macos aarch64-macos; do
            echo "Building for ${target}..."

            case "$target" in
              x86_64-linux)   suffix="linux-x86_64" ;;
              aarch64-linux)  suffix="linux-aarch64" ;;
              x86_64-macos)   suffix="macos-x86_64" ;;
              aarch64-macos)  suffix="macos-aarch64" ;;
            esac

            zig build \
              -Doptimize=ReleaseSafe \
              -Dtarget="${target}" \
              -Dversion="${VERSION}"

            cp zig-out/bin/ody "dist/ody-${suffix}"
          done

      - name: Generate checksums
        working-directory: cli/dist
        run: |
          sha256sum ody-* > checksums-sha256.txt
          cat checksums-sha256.txt

      - name: Generate release notes
        uses: orhun/git-cliff-action@v4
        id: release-notes
        with:
          config: cliff.toml
          args: --latest --strip header

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          body: ${{ steps.release-notes.outputs.content }}
          prerelease: ${{ contains(github.ref_name, '-') }}
          files: |
            cli/dist/ody-*
            cli/dist/checksums-sha256.txt
```

### How the Two Jobs Interact

```
merge release PR to main
        |
        v
"tag" job detects "release: v1.2.0" commit message
  → reads cli/VERSION → creates + pushes v1.2.0 tag
        |
        v
tag push triggers the workflow again
        |
        v
"build" job detects refs/tags/v* ref
  → cross-compiles 4 binaries
  → generates checksums
  → git-cliff generates release notes from conventional commits (--latest)
  → creates GitHub Release with everything attached
```

Tags containing a hyphen (e.g., `v1.0.0-rc.1`, `v1.0.0-beta.2`) are
automatically flagged as pre-releases via the `prerelease` condition.

### Why a Single Runner

Zig can cross-compile to any supported target from any host. Building all
four targets on a single `ubuntu-latest` runner is:

- Faster (no runner spin-up overhead per target)
- Simpler (no matrix, no artifact upload/download dance)
- Cheaper (one runner instead of four)

If macOS code-signing is needed later, the macOS targets can be split into a
separate job on `macos-latest`.

## Step 4: Create the Install Script

Create `install.sh` at the repo root. Users install with:

```bash
curl -fsSL https://raw.githubusercontent.com/8bittitan/ody/main/install.sh | sh
```

### `install.sh`

```bash
#!/usr/bin/env sh
set -eu

REPO="8bittitan/ody"
INSTALL_DIR="${ODY_INSTALL_DIR:-$HOME/.local/bin}"
BINARY_NAME="ody"

# --- Platform detection ---

detect_platform() {
  OS=$(uname -s)
  ARCH=$(uname -m)

  case "$OS" in
    Linux)  OS_SUFFIX="linux" ;;
    Darwin) OS_SUFFIX="macos" ;;
    *)      error "Unsupported operating system: $OS" ;;
  esac

  case "$ARCH" in
    x86_64|amd64)  ARCH_SUFFIX="x86_64" ;;
    arm64|aarch64)  ARCH_SUFFIX="aarch64" ;;
    *)              error "Unsupported architecture: $ARCH" ;;
  esac

  echo "${OS_SUFFIX}-${ARCH_SUFFIX}"
}

# --- Helpers ---

error() {
  printf "\033[0;31merror:\033[0m %s\n" "$1" >&2
  exit 1
}

info() {
  printf "\033[0;36m%s\033[0m\n" "$1"
}

success() {
  printf "\033[0;32m%s\033[0m\n" "$1"
}

# --- Version resolution ---

resolve_version() {
  if [ -n "${ODY_VERSION:-}" ]; then
    echo "$ODY_VERSION"
    return
  fi

  TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' | head -1 | cut -d'"' -f4)

  if [ -z "$TAG" ]; then
    error "Could not determine latest release. Check https://github.com/${REPO}/releases"
  fi

  echo "$TAG"
}

# --- Checksum verification ---

verify_checksum() {
  BINARY_PATH="$1"
  EXPECTED_CHECKSUM="$2"

  if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL=$(sha256sum "$BINARY_PATH" | cut -d' ' -f1)
  elif command -v shasum >/dev/null 2>&1; then
    ACTUAL=$(shasum -a 256 "$BINARY_PATH" | cut -d' ' -f1)
  else
    info "Warning: no sha256sum or shasum found, skipping checksum verification"
    return 0
  fi

  if [ "$ACTUAL" != "$EXPECTED" ]; then
    error "Checksum mismatch!\n  Expected: ${EXPECTED}\n  Actual:   ${ACTUAL}"
  fi
}

# --- Main ---

main() {
  PLATFORM=$(detect_platform)
  ARTIFACT="${BINARY_NAME}-${PLATFORM}"
  VERSION=$(resolve_version)

  info "Platform:  ${PLATFORM}"
  info "Version:   ${VERSION}"
  info "Install:   ${INSTALL_DIR}/${BINARY_NAME}"
  echo ""

  BASE_URL="https://github.com/${REPO}/releases/download/${VERSION}"

  # Download checksum file
  CHECKSUM_FILE=$(mktemp)
  if curl -fsSL -o "$CHECKSUM_FILE" "${BASE_URL}/checksums-sha256.txt" 2>/dev/null; then
    EXPECTED_CHECKSUM=$(grep "$ARTIFACT" "$CHECKSUM_FILE" | cut -d' ' -f1)
  else
    EXPECTED_CHECKSUM=""
    info "Warning: could not download checksums, skipping verification"
  fi
  rm -f "$CHECKSUM_FILE"

  # Download binary
  DOWNLOAD_URL="${BASE_URL}/${ARTIFACT}"
  info "Downloading ${DOWNLOAD_URL}..."

  mkdir -p "$INSTALL_DIR"
  TEMP_FILE=$(mktemp)

  HTTP_CODE=$(curl -fsSL -w "%{http_code}" -o "$TEMP_FILE" "$DOWNLOAD_URL" 2>/dev/null) || true

  if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "302" ]; then
    rm -f "$TEMP_FILE"
    error "Download failed (HTTP ${HTTP_CODE}). Check that ${VERSION} exists at:\n  https://github.com/${REPO}/releases"
  fi

  # Verify checksum
  if [ -n "$EXPECTED_CHECKSUM" ]; then
    verify_checksum "$TEMP_FILE" "$EXPECTED_CHECKSUM"
    info "Checksum verified."
  fi

  # Install
  mv "$TEMP_FILE" "${INSTALL_DIR}/${BINARY_NAME}"
  chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

  echo ""
  success "Installed ${BINARY_NAME} ${VERSION} to ${INSTALL_DIR}/${BINARY_NAME}"

  # Check PATH
  case ":$PATH:" in
    *":${INSTALL_DIR}:"*) ;;
    *)
      echo ""
      info "Add to your PATH (if not already):"
      echo ""
      echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
      echo ""
      info "Add this line to your ~/.bashrc, ~/.zshrc, or ~/.profile to persist."
      ;;
  esac

  # Verify installation
  if command -v "$BINARY_NAME" >/dev/null 2>&1; then
    echo ""
    success "Run 'ody --help' to get started."
  fi
}

main
```

### Install Script Features

| Feature               | Details                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| Platform detection    | `uname -s` + `uname -m`, supports Linux + macOS, x86_64 + ARM64         |
| Version pinning       | Set `ODY_VERSION=v1.2.3` to install a specific version                  |
| Custom install dir    | Set `ODY_INSTALL_DIR=/usr/local/bin` to override default `~/.local/bin` |
| Checksum verification | Downloads `checksums-sha256.txt` and verifies SHA-256 before installing |
| PATH guidance         | Warns if install directory is not in `$PATH`                            |
| Graceful fallbacks    | Skips checksum verification if `sha256sum`/`shasum` are unavailable     |
| Idempotent            | Safe to run multiple times; overwrites existing binary                  |

### Usage Examples

```bash
# Install latest version
curl -fsSL https://raw.githubusercontent.com/8bittitan/ody/main/install.sh | sh

# Install specific version
curl -fsSL https://raw.githubusercontent.com/8bittitan/ody/main/install.sh | ODY_VERSION=v1.0.0 sh

# Install to custom directory
curl -fsSL https://raw.githubusercontent.com/8bittitan/ody/main/install.sh | ODY_INSTALL_DIR=/usr/local/bin sh
```

## Step 5: Uninstall Script (Optional)

Create `uninstall.sh` at the repo root:

```bash
#!/usr/bin/env sh
set -eu

INSTALL_DIR="${ODY_INSTALL_DIR:-$HOME/.local/bin}"
BINARY_NAME="ody"
TARGET="${INSTALL_DIR}/${BINARY_NAME}"

if [ -f "$TARGET" ]; then
  rm "$TARGET"
  printf "\033[0;32mRemoved %s\033[0m\n" "$TARGET"
else
  printf "\033[0;33m%s not found at %s\033[0m\n" "$BINARY_NAME" "$TARGET"
fi
```

## Day-to-Day Workflow

### Making Changes

No release ceremony during development. Use conventional commit messages:

```bash
git add .
git commit -m "feat: add new feature"
git push

git commit -m "fix: resolve config loading edge case"
git push
```

CI runs lint (`zig fmt --check`), tests (`zig build test`), and build
verification on every push/PR.

### Conventional Commit Quick Reference

| Prefix      | Purpose                 | Appears in changelog      |
| ----------- | ----------------------- | ------------------------- |
| `feat:`     | New feature             | Yes (Features)            |
| `fix:`      | Bug fix                 | Yes (Bug Fixes)           |
| `perf:`     | Performance improvement | Yes (Performance)         |
| `refactor:` | Code restructuring      | Yes (Refactoring)         |
| `docs:`     | Documentation           | Yes (Documentation)       |
| `test:`     | Test changes            | Yes (Testing)             |
| `ci:`       | CI/CD changes           | Yes (CI)                  |
| `chore:`    | Maintenance             | No (skipped)              |
| `build:`    | Build system            | No (skipped)              |
| `feat!:`    | Breaking feature        | Yes, flagged **BREAKING** |

### Releasing

```bash
# 1. Trigger the Prepare Release workflow
gh workflow run prepare-release.yml -f version=1.2.0

# Or use the GitHub Actions UI:
#   Actions > Prepare Release > Run workflow > enter version > Run

# 2. Review the resulting "Release v1.2.0" PR:
#    - Changelog entries are grouped by conventional commit type
#    - VERSION file is updated
#    - CHANGELOG.md is prepended with the new section

# 3. Merge the PR

# 4. The release workflow creates and pushes a git tag (v1.2.0)

# 5. The build job cross-compiles 4 binaries, generates checksums,
#    and creates a GitHub Release with conventional commit release notes

# 6. Users install/update via:
curl -fsSL https://raw.githubusercontent.com/8bittitan/ody/main/install.sh | sh
```

### How Users Install

```bash
# Install script (downloads correct binary for OS/arch, verifies checksum)
curl -fsSL https://raw.githubusercontent.com/8bittitan/ody/main/install.sh | sh

# Or download directly from GitHub Releases
# https://github.com/8bittitan/ody/releases
```

## Files Created

| File                                    | Purpose                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `cliff.toml`                            | git-cliff configuration (commit parsing, grouping, template)               |
| `cli/VERSION`                           | Plain-text version file, source of truth, read by `build.zig`              |
| `CHANGELOG.md`                          | Auto-maintained changelog, updated by prepare-release workflow             |
| `.github/workflows/prepare-release.yml` | Dispatch workflow: generate changelog + open release PR                    |
| `.github/workflows/release.yml`         | Tag on merge + build binaries + create GitHub Release                      |
| `install.sh`                            | User-facing install script with platform detection + checksum verification |
| `uninstall.sh`                          | User-facing uninstall script (optional)                                    |

## Files Modified

| File                       | Change                                                           |
| -------------------------- | ---------------------------------------------------------------- |
| `cli/build.zig`            | Add `-Dversion` build option, default to `@embedFile("VERSION")` |
| `.github/workflows/ci.yml` | Replace Bun CI with Zig CI (covered in rewrite.md Phase 9)       |

## Monorepo Scalability

git-cliff has first-class monorepo support. If the repo later contains
multiple packages (e.g., a desktop app, another binary), each can have its
own changelog scoped by path and tag prefix.

### Path-Based Scoping

Scope changelogs to specific directories with `--include-path`:

```bash
# Only commits touching cli/
git-cliff --include-path "cli/**"

# Only commits touching desktop/
git-cliff --include-path "desktop/**"
```

A `feat: add dark mode` commit that only touches `desktop/` files won't
appear in the CLI's changelog.

### Per-Package Tag Prefixes

Each package can be versioned independently with its own tag pattern:

```toml
# cli/cliff.toml
[git]
tag_pattern = "cli/v[0-9].*"
```

```toml
# desktop/cliff.toml
[git]
tag_pattern = "desktop/v[0-9].*"
```

Tags would look like `cli/v1.2.0`, `desktop/v0.3.0`. Each package's
changelog only sees its own version history.

### Multi-Package Structure

```
ody/
├── cliff.toml              # Shared base config (commit parsers, template)
├── cli/
│   ├── cliff.toml          # CLI overrides (tag_pattern, include_path)
│   ├── VERSION
│   ├── CHANGELOG.md
│   └── build.zig
├── desktop/
│   ├── cliff.toml          # Desktop overrides
│   ├── VERSION
│   ├── CHANGELOG.md
│   └── ...
```

Each prepare-release workflow passes the appropriate config and path:

```bash
# CLI release
git-cliff --config cli/cliff.toml --include-path "cli/**" --tag cli/v1.2.0

# Desktop release
git-cliff --config desktop/cliff.toml --include-path "desktop/**" --tag desktop/v0.3.0
```

### Migration Path

The single-package config works as-is today. If you later add another
package:

1. Move `cliff.toml` to `cli/cliff.toml` (or keep a shared base with
   per-package overrides)
2. Add `--include-path "cli/**"` to the workflow
3. Optionally switch to prefixed tags (`cli/v1.0.0` instead of `v1.0.0`)

None of that breaks existing releases — git-cliff can still read old `v*`
tags.

## Future Considerations

### Homebrew Tap

Create a `homebrew-ody` repository with a formula that downloads the correct
binary from GitHub Releases:

```ruby
class Ody < Formula
  desc "Agentic orchestrator CLI"
  homepage "https://github.com/8bittitan/ody"
  version "1.0.0"

  on_macos do
    on_arm do
      url "https://github.com/8bittitan/ody/releases/download/v1.0.0/ody-macos-aarch64"
      sha256 "..."
    end
    on_intel do
      url "https://github.com/8bittitan/ody/releases/download/v1.0.0/ody-macos-x86_64"
      sha256 "..."
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/8bittitan/ody/releases/download/v1.0.0/ody-linux-aarch64"
      sha256 "..."
    end
    on_intel do
      url "https://github.com/8bittitan/ody/releases/download/v1.0.0/ody-linux-x86_64"
      sha256 "..."
    end
  end

  def install
    bin.install "ody-*" => "ody"
  end
end
```

This can be automated with a workflow that updates the formula on each
release.

### macOS Code Signing + Notarization

If users report Gatekeeper warnings on macOS, a separate job on
`macos-latest` can sign and notarize the macOS binaries using an Apple
Developer certificate. This would require adding `APPLE_CERTIFICATE`,
`APPLE_ID`, and `APPLE_TEAM_ID` secrets.

### Windows Support

Add `x86_64-windows` to the build targets. The install script would need a
PowerShell equivalent (`install.ps1`), or users can download the `.exe`
directly from GitHub Releases.
