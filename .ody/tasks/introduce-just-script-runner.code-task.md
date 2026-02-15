---
status: completed
created: 2026-02-14
started: 2026-02-14
completed: 2026-02-14
---
# Task: Introduce Just as Project Script Runner

## Description
Add [just](https://github.com/casey/just) as a command runner at the repository root to provide ergonomic, discoverable aliases for common development workflows. The `justfile` will wrap Zig build commands so developers can run `just build`, `just test`, etc. from the project root instead of remembering to `cd cli/` and type full `zig build` invocations with flags.

## Background
The Zig CLI lives under `cli/` and all build/test commands must be run from that subdirectory (e.g., `cd cli && zig build`, `cd cli && zig build test`). This adds friction for developers who are working from the project root. `just` is a lightweight, cross-platform command runner (similar to `make` but without the build-system baggage) that reads a `justfile` at the repository root and executes recipes. It has no runtime dependencies beyond its own binary and is available via most package managers (`brew install just`, `cargo install just`, etc.). Adding a `justfile` at the root will make common tasks self-documenting and accessible from the top-level directory.

## Technical Requirements
1. Create a `justfile` at the repository root (`/justfile`)
2. Include a `build` recipe that runs `zig build` in the `cli/` directory (debug build by default)
3. Include a `test` recipe that runs `zig build test` in the `cli/` directory
4. Include a `build-release` recipe that runs `zig build -Doptimize=ReleaseSafe` in the `cli/` directory
5. Include a `fmt` recipe that runs `zig fmt src/` in the `cli/` directory for formatting
6. Include a `fmt-check` recipe that runs `zig fmt --check src/` in the `cli/` directory for CI-style format verification
7. Include a `run` recipe that builds and runs the CLI, forwarding any additional arguments
8. Set a sensible default recipe (e.g., `just --list` or `just build`)
9. Ensure all recipes use the correct working directory (`cli/`) so they work when invoked from the project root

## Dependencies
- `just` must be installed on the developer's machine (not vendored into the repo)
- Zig 0.15.0+ must be available in PATH (existing requirement)
- The `cli/build.zig` build configuration (already exists and defines `build`, `test`, `run`, and `cross` steps)

## Implementation Approach
1. Create a `justfile` at the project root using `just`'s syntax
2. Set the working directory for Zig recipes to `cli/` using a variable or per-recipe `cd` — prefer the `[working-directory]` recipe attribute if supported, otherwise use a module-level `set working-directory` or shell `cd` commands
3. Define the default recipe to list all available recipes (`just --list`) so new developers can discover commands
4. Define the `build` recipe: run `zig build` for a debug build
5. Define the `build-release` recipe: run `zig build -Doptimize=ReleaseSafe`
6. Define the `test` recipe: run `zig build test`
7. Define the `run` recipe with variadic arguments: run `zig build run` and forward args via `-- {{args}}`
8. Define `fmt` and `fmt-check` recipes for formatting
9. Add brief comments in the `justfile` documenting each recipe's purpose
10. Verify all recipes work correctly from the project root by running each one

## Acceptance Criteria

1. **Justfile Exists at Root**
   - Given the repository root directory
   - When listing files
   - Then a `justfile` is present at the top level

2. **Build Recipe Works**
   - Given `just` is installed and the `justfile` is at the root
   - When running `just build` from the project root
   - Then Zig compiles the CLI and produces `cli/zig-out/bin/ody` without errors

3. **Test Recipe Works**
   - Given `just` is installed and the `justfile` is at the root
   - When running `just test` from the project root
   - Then all Zig unit tests in the CLI source tree are executed and pass

4. **Run Recipe Forwards Arguments**
   - Given `just` is installed and the `justfile` is at the root
   - When running `just run -- --help` from the project root
   - Then the CLI is built, executed, and the `--help` output is displayed

5. **Default Recipe Lists Commands**
   - Given `just` is installed and the `justfile` is at the root
   - When running `just` with no arguments from the project root
   - Then all available recipes are listed with descriptions

6. **Format Recipes Work**
   - Given `just` is installed and the `justfile` is at the root
   - When running `just fmt-check` from the project root
   - Then `zig fmt --check src/` runs against the CLI source and reports any formatting issues

## Metadata
- **Complexity**: Low
- **Labels**: tooling, developer-experience, just
