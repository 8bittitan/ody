---
status: completed
created: 2026-02-15
started: 2026-02-15
completed: 2026-02-15
---
# Task: Add Installation Instructions to README

## Description
Add a dedicated "Installation" section to the README that covers all the ways a user can install `ody`. Currently the README has a "Quick start" section focused on running from source and a "Build" section for compiling a binary, but there is no clear section explaining how end-users can install `ody` as a tool. The install script (`install.sh`), pre-built GitHub Release binaries, and from-source installation should all be documented.

## Background
The project recently completed its release pipeline: GitHub Actions workflows build cross-platform binaries (macOS ARM64/x64, Linux x64/ARM64) on version tag pushes, publish them as GitHub Releases, and an `install.sh` script allows one-line installation via `curl`. The README does not yet surface any of this to users. The "Quick start" section assumes a developer cloning the repo, not an end-user installing a tool. A proper "Installation" section is the standard way to communicate how to get the software.

## Technical Requirements
1. Add an "Installation" section to `README.md` placed immediately after the "Requirements" section and before "Quick start"
2. Document the install script method: `curl -fsSL https://raw.githubusercontent.com/8bittitan/ody/main/install.sh | sh`
3. Document the `ODY_INSTALL_DIR` environment variable for customizing the install location (default: `$HOME/.local/bin`)
4. Document manual binary download from GitHub Releases with a link to `https://github.com/8bittitan/ody/releases`
5. List the available binary targets: `ody-darwin-arm64`, `ody-darwin-x64`, `ody-linux-x64`, `ody-linux-arm64`
6. Document the from-source installation method (clone, `bun install`, `bun run build`)
7. Keep the existing "Quick start" section intact but update it to reference the installation section if appropriate
8. Maintain the existing README style: concise descriptions, code blocks for commands, consistent heading levels

## Dependencies
- `install.sh` at the repo root (already exists and is complete)
- GitHub Releases publishing binaries via `.github/workflows/binaries.yml` (already configured)
- Repository URL: `https://github.com/8bittitan/ody`

## Implementation Approach
1. Read the current `README.md` to understand the full structure and heading hierarchy
2. Create the new "Installation" section as an `## Installation` heading placed between "## Requirements" and "## Quick start"
3. Organize the section into three subsections or clearly delineated methods:
   - **Install script (recommended)**: Show the `curl` one-liner, mention it auto-detects OS/arch, note the `ODY_INSTALL_DIR` override
   - **Download a release binary**: Link to the GitHub Releases page, list the four binary names, show `chmod +x` and moving to a `$PATH` directory
   - **Build from source**: Brief instructions to clone the repo, install deps with `bun install`, and compile with `bun run build` (link to the existing "Build" section or inline the steps)
4. Review the "Quick start" section to ensure it still makes sense in context -- it currently assumes a cloned repo, so it can remain as a developer-focused workflow section
5. Run `bun fmt` to ensure formatting is consistent
6. Verify the markdown renders correctly and all links are valid

## Acceptance Criteria

1. **Installation section exists**
   - Given the README is opened
   - When the user scrolls through it
   - Then there is an `## Installation` section between "Requirements" and "Quick start"

2. **Install script method is documented**
   - Given the user reads the Installation section
   - When they look for the quickest install method
   - Then they find the `curl -fsSL https://raw.githubusercontent.com/8bittitan/ody/main/install.sh | sh` command in a code block

3. **Custom install directory is documented**
   - Given the user wants to install to a non-default location
   - When they read the install script subsection
   - Then they see how to set `ODY_INSTALL_DIR` before running the script

4. **Manual binary download is documented**
   - Given the user prefers manual installation
   - When they read the Installation section
   - Then they find a link to the GitHub Releases page and the four binary target names

5. **From-source build is documented**
   - Given the user wants to build from source
   - When they read the Installation section
   - Then they find instructions to clone, `bun install`, and `bun run build`

6. **Existing sections are preserved**
   - Given the README had existing content
   - When the Installation section is added
   - Then all other sections (Requirements, Quick start, Build, How it works, CLI commands, Configuration, etc.) remain intact and unbroken

7. **Markdown is well-formed**
   - Given the updated README
   - When it is rendered on GitHub
   - Then all headings, code blocks, links, and tables render correctly

## Metadata
- **Complexity**: Low
- **Labels**: documentation, readme, installation, user-facing
