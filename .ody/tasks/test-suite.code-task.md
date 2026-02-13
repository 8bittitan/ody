---
status: pending
created: 2026-02-13
started: null
completed: null
---
# Task: Test Suite

## Description
Create a comprehensive test suite for the Zig rewrite using Zig's built-in `test` keyword and `zig build test` runner. Cover all core modules: config parsing/validation, task file parsing, stream processing, ANSI terminal output, backend command building, prompt template substitution, and PATH detection.

## Background
The TypeScript implementation has no test suite. The Zig rewrite is an opportunity to establish proper test coverage from the start. Zig has excellent built-in testing support with the `test` keyword, `std.testing` assertions, and integration with the build system's test step. Tests can be co-located with source files or placed in a dedicated `test/` directory.

## Technical Requirements
1. Configure `build.zig` with a test step that discovers and runs all tests
2. **Config tests** (`config.zig`):
   - Parse valid JSON into `OdyConfig`
   - Parse invalid JSON (missing required fields, invalid backend)
   - Validate field constraints (backend in allowed list, non-empty agent/tasks_dir)
   - Merge logic (local overrides global)
   - Global/local config file precedence
3. **Task parsing tests** (`task.zig`):
   - Frontmatter parsing from valid content
   - Title extraction with `# Task: ` and `# ` prefixes
   - Description extraction and condensation
   - Label parsing from metadata section
   - Graceful handling of missing sections
4. **Stream tests** (`stream.zig`):
   - Chunk accumulation from multiple reads
   - Callback stopping behavior
   - Empty stream handling
   - Completion marker detection
5. **Terminal tests** (`terminal.zig`):
   - ANSI escape sequence generation correctness
   - Color code output for each style function
6. **Backend tests** (`backend/*.zig`):
   - Command array construction for Claude with/without skip_permissions
   - Command array construction for Codex with/without should_commit
   - Command array construction for OpenCode with model/agent options
7. **Prompt builder tests** (`builder/*.zig`):
   - Template substitution for all placeholders
   - Date formatting
8. **Detection tests** (`detect.zig`):
   - PATH searching logic with mock paths

## Dependencies
- All source modules must be implemented (tests should be added alongside or after implementation)
- Zig standard library (`std.testing`)

## Implementation Approach
1. Add a test step in `build.zig`:
   ```zig
   const test_step = b.step("test", "Run unit tests");
   const unit_tests = b.addTest(.{ .root_source_file = b.path("src/main.zig") });
   test_step.dependOn(&b.addRunArtifact(unit_tests).step);
   ```
2. Add `test` blocks in each source file for unit tests
3. Use `std.testing.expect`, `std.testing.expectEqual`, `std.testing.expectEqualStrings` for assertions
4. For tests requiring file I/O, use `std.testing.tmpDir()` for temporary test directories
5. For config tests, create in-memory JSON strings and parse them
6. For stream tests, create mock readers using `std.io.fixedBufferStream`
7. For backend tests, construct configs and verify the output command arrays
8. Organize integration tests (if any) in the `test/` directory
9. Ensure all tests pass with `zig build test`

## Acceptance Criteria

1. **Test Step Works**
   - Given the build configuration
   - When running `zig build test`
   - Then all tests are discovered and executed

2. **Config Module Coverage**
   - Given the config test suite
   - When running tests
   - Then parsing, validation, and merge logic are all covered

3. **Task Parsing Coverage**
   - Given the task parsing test suite
   - When running tests
   - Then frontmatter, title, description, and label parsing are covered

4. **All Tests Pass**
   - Given the complete test suite
   - When running `zig build test`
   - Then all tests pass with zero failures

5. **Edge Cases Handled**
   - Given tests for edge cases (empty input, missing sections, invalid data)
   - When running tests
   - Then graceful error handling is verified

## Metadata
- **Complexity**: Medium
- **Labels**: zig-rewrite, phase-8, testing
