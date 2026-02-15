# Project script runner for the Zig CLI (cli/)
# Run `just` with no arguments to see all available recipes.

set working-directory := "cli"

# List all available recipes
default:
    @just --list --justfile {{justfile()}}

# Build the CLI (debug)
build:
    zig build

# Build the CLI (release)
build-release:
    zig build -Doptimize=ReleaseSafe

# Run all unit tests
test:
    zig build test

# Auto-format all source files
fmt:
    zig fmt src/

# Check formatting without modifying files (CI-style)
fmt-check:
    zig fmt --check src/
