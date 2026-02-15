---
status: completed
created: 2026-02-13
started: 2026-02-13
completed: 2026-02-13
---
# Task: Task File Parsing Utility

## Description
Implement the task file parsing utility in `src/util/task.zig` for parsing `.code-task.md` files including YAML frontmatter extraction, title parsing, description extraction, label parsing, and file scanning with label-based filtering.

## Background
The TypeScript implementation has utility functions for parsing task files that contain YAML frontmatter (status, dates), markdown headings (task titles), description sections, and metadata labels. These utilities are used by `ody run` (to find tasks by label), `ody plan list` (to list tasks by status), `ody plan edit` (to select pending tasks), and `ody plan compact` (to archive completed tasks). The Zig version needs to replicate all this parsing logic using string manipulation and filesystem scanning.

## Technical Requirements
1. `parseFrontmatter(content: []const u8) !std.StringHashMap([]const u8)` - Parse YAML frontmatter between `---` delimiters into key-value pairs
2. `parseTitle(content: []const u8) ?[]const u8` - Extract the task title from `# Task: ...` or `# ...` heading
3. `parseDescription(content: []const u8) ?[]const u8` - Extract the `## Description` section content, condensed to 2-3 sentences
4. `parseLabels(content: []const u8) ![][]const u8` - Extract comma-separated values from the `**Labels**: ...` metadata line
5. `getTaskFilesByLabel(allocator, label: []const u8) ![][]const u8` - Scan task files in the configured tasks directory, filter by label match
6. `resolveTasksDir() []const u8` - Return the configured tasks directory path or the default
7. All parsing should handle missing/malformed sections gracefully (return null or empty)
8. File scanning uses `std.fs.Dir.iterate()` or `std.fs.Dir.openIterableDir()` to find `.code-task.md` files

## Dependencies
- Config module (`src/lib/config.zig`) for `tasks_dir` config value
- Constants module (`src/util/constants.zig`) for `BASE_DIR`, `TASKS_DIR`
- Zig standard library (`std.fs`, `std.mem`, `std.StringHashMap`)

## Implementation Approach
1. Implement `parseFrontmatter()`:
   - Find the first `---\n` and second `---\n` delimiters
   - Extract the content between them
   - Split by newlines, then split each line on `:` to get key-value pairs
   - Trim whitespace from keys and values
   - Store in a `std.StringHashMap([]const u8)`
2. Implement `parseTitle()`:
   - Search for a line starting with `# Task: ` or `# `
   - Return the text after the prefix
3. Implement `parseDescription()`:
   - Find `## Description` heading
   - Collect text until the next `## ` heading
   - Trim and condense to 2-3 sentences
4. Implement `parseLabels()`:
   - Find `**Labels**:` in the content
   - Extract the text after the colon
   - Split by `,` and trim each label
5. Implement `getTaskFilesByLabel()`:
   - Resolve the tasks directory path
   - Iterate over files matching `*.code-task.md`
   - Read each file, parse labels, check if the target label is present
   - Collect matching file paths
6. Implement `resolveTasksDir()` using config with fallback to the default constant

## Acceptance Criteria

1. **Frontmatter Parsing**
   - Given content with `---\nstatus: pending\ncreated: 2026-01-01\n---`
   - When parsing frontmatter
   - Then a map with `status -> "pending"` and `created -> "2026-01-01"` is returned

2. **Title Extraction**
   - Given content with `# Task: Add Email Validation`
   - When parsing the title
   - Then `"Add Email Validation"` is returned

3. **Label Parsing**
   - Given content with `**Labels**: auth, backend, validation`
   - When parsing labels
   - Then `["auth", "backend", "validation"]` is returned

4. **Label Filtering**
   - Given task files with various labels
   - When calling `getTaskFilesByLabel(allocator, "auth")`
   - Then only files containing the "auth" label are returned

5. **Graceful Missing Sections**
   - Given a malformed task file without a `## Description` section
   - When parsing the description
   - Then `null` is returned without error

## Metadata
- **Complexity**: Medium
- **Labels**: zig-rewrite, phase-5, utility, parsing
