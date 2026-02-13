---
status: pending
created: 2026-02-13
started: null
completed: null
---
# Task: Project Scaffolding and Build System

## Description
Create the foundational Zig project structure for the Ody CLI rewrite. This includes the `cli/` top-level directory, `build.zig` configuration, `build.zig.zon` package manifest with the zig-clap dependency, and the full directory tree for all source modules. This is the first task that must be completed before any other Zig work can begin.

## Background
The Ody CLI is being rewritten from TypeScript/Bun to Zig to produce a single static binary with zero runtime dependencies. The project will live in a new top-level `cli/` directory alongside the existing `packages/cli` TypeScript implementation during the coexistence period. The only external dependency is `zig-clap` for argument parsing; everything else uses Zig's standard library.

## Technical Requirements
1. Create `cli/build.zig` with a single executable target named `ody`, root source file `src/main.zig`
2. Create `cli/build.zig.zon` declaring the `zig-clap` dependency fetched from GitHub
3. Configure the build to produce a static, release-safe binary with `ReleaseSafe` optimization
4. Add cross-compilation targets: linux-x86_64, linux-aarch64, macos-x86_64, macos-aarch64
5. Add a test step (`zig build test`) that runs all tests in the source tree
6. Create a minimal `src/main.zig` that compiles and prints a placeholder message
7. Set up the full directory tree: `src/cmd/`, `src/cmd/plan/`, `src/backend/`, `src/builder/`, `src/lib/`, `src/util/`, `test/`
8. Embed a version string at comptime via build options (replacing `package.json` version reading)

## Dependencies
- Zig compiler (0.13+ recommended) must be installed on the development machine
- `zig-clap` GitHub repository must be accessible for dependency fetching

## Implementation Approach
1. Create the `cli/` directory at the repository root
2. Write `build.zig.zon` with the project name `ody`, version, and `zig-clap` dependency pointing to its GitHub release tarball
3. Write `build.zig` with executable target, zig-clap module import, test step, install step, and cross-compilation support
4. Create all subdirectories under `src/` matching the planned layout: `cmd/`, `cmd/plan/`, `backend/`, `builder/`, `lib/`, `util/`
5. Create a minimal `src/main.zig` that imports zig-clap (to verify dependency resolution) and prints `"ody (zig) vX.Y.Z"`
6. Create placeholder `.zig` files in each directory (empty or with a `// TODO` comment) to establish the file structure
7. Verify the project compiles with `zig build` and tests run with `zig build test`

## Acceptance Criteria

1. **Build Compiles**
   - Given the `cli/` directory with `build.zig` and `build.zig.zon`
   - When running `zig build` from the `cli/` directory
   - Then the build succeeds and produces a `zig-out/bin/ody` executable

2. **Dependency Resolution**
   - Given `build.zig.zon` declares the `zig-clap` dependency
   - When running `zig build`
   - Then zig-clap is fetched and linked without errors

3. **Cross-Compilation**
   - Given the build configuration with cross-compilation targets
   - When running `zig build -Dtarget=x86_64-linux`
   - Then a Linux x86_64 binary is produced without errors

4. **Test Step**
   - Given the build configuration with a test step
   - When running `zig build test`
   - Then all tests in the source tree are discovered and executed

5. **Directory Structure**
   - Given the `cli/src/` directory
   - When listing all subdirectories
   - Then `cmd/`, `cmd/plan/`, `backend/`, `builder/`, `lib/`, `util/` all exist

## Metadata
- **Complexity**: Medium
- **Labels**: zig-rewrite, phase-1, infrastructure, build-system
