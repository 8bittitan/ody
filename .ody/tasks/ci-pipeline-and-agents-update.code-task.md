---
status: completed
created: 2026-02-13
started: 2026-02-13
completed: 2026-02-13
---
# Task: CI Pipeline and AGENTS.md Update

## Description
Create a GitHub Actions CI pipeline for the Zig rewrite that runs linting, testing, and build verification. Also update `AGENTS.md` to reflect the new Zig tooling, commands, conventions, and project structure.

## Background
The current CI pipeline is built around Bun/TypeScript tooling. The Zig rewrite needs its own CI configuration using the `mlugg/setup-zig` GitHub Action for Zig installation. Zig has a built-in formatter (`zig fmt`) that replaces oxfmt, and the test runner is `zig build test`. The `AGENTS.md` file provides guidance for AI coding agents and needs to be rewritten to reflect the Zig project structure, commands, and conventions.

## Technical Requirements
### CI Pipeline (`.github/workflows/ci.yml`)
1. **Lint job**: Run `zig fmt --check src/` to verify formatting
2. **Test job**: Run `zig build test` to execute all unit tests
3. **Build job**: Run `zig build -Doptimize=ReleaseSafe` to verify the project compiles
4. Use `mlugg/setup-zig@v1` action for Zig installation
5. Trigger on push to main and pull requests
6. Optional: matrix build for multiple targets (linux-x86_64, macos-aarch64)

### AGENTS.md Update
1. Update repo summary to describe Zig project structure
2. Update runtime from Bun to Zig
3. Update all commands (build, lint, format, test)
4. Update code style conventions for Zig idioms
5. Update file layout description to match new `cli/src/` structure
6. Remove references to TypeScript, Bun, npm packages, citty, Zod, etc.
7. Add Zig-specific conventions: error handling with `!`, comptime, allocator patterns, tagged unions

## Dependencies
- Zig project must be functional (builds and tests pass)
- GitHub Actions must have access to `mlugg/setup-zig` action

## Implementation Approach
### CI Pipeline
1. Create `.github/workflows/zig-ci.yml` (or replace existing CI file)
2. Define three jobs: lint, test, build
3. Each job:
   - Checks out the repo
   - Sets up Zig via `mlugg/setup-zig@v1`
   - Runs the respective command from the `cli/` directory
4. Optionally add a matrix strategy for cross-compilation verification

### AGENTS.md
1. Rewrite the file section by section:
   - Repo summary: Zig monorepo with `cli/` directory
   - Commands: `zig build`, `zig build test`, `zig fmt`
   - Code style: Zig naming conventions, error handling, memory management
   - File structure: Map to new `cli/src/` layout
2. Remove all TypeScript/Bun/Node.js references
3. Add Zig-specific guidance for AI agents

## Acceptance Criteria

1. **CI Lint Passes**
   - Given properly formatted Zig source files
   - When the CI lint job runs
   - Then `zig fmt --check src/` exits with code 0

2. **CI Tests Pass**
   - Given a passing test suite
   - When the CI test job runs
   - Then `zig build test` completes successfully

3. **CI Build Succeeds**
   - Given a valid Zig project
   - When the CI build job runs
   - Then `zig build -Doptimize=ReleaseSafe` produces a binary

4. **AGENTS.md Reflects Zig**
   - Given the updated AGENTS.md
   - When an AI agent reads it
   - Then it correctly understands the Zig project structure, commands, and conventions

5. **No TypeScript References**
   - Given the updated AGENTS.md
   - When reviewing its contents
   - Then no references to TypeScript, Bun, npm, citty, or Zod remain

## Metadata
- **Complexity**: Low
- **Labels**: zig-rewrite, phase-9, ci, documentation
