---
status: completed
created: 2026-02-13
started: 2026-02-13
completed: 2026-02-13
---
# Task: Plan List and Plan Compact Command Implementations

## Description
Implement the `ody plan list` command in `src/cmd/plan/list.zig` for listing task files filtered by status, and the `ody plan compact` command in `src/cmd/plan/compact.zig` for archiving completed tasks into a markdown history file and removing the original task files.

## Background
The TypeScript `ody plan list` command scans `.code-task.md` files, parses their frontmatter to extract status, and lists tasks matching a given status filter (defaulting to "pending"). The `ody plan compact` command finds completed tasks, extracts their metadata, generates a markdown archive sorted by completion date, writes it to `.ody/history/`, and deletes the original completed files. These two commands are related read/cleanup operations on task files.

## Technical Requirements
### Plan List
1. Accept `--status|-s` flag to filter by status (default: `"pending"`)
2. Scan `.code-task.md` files in the configured tasks directory
3. Parse frontmatter of each file to extract `status`
4. Filter files matching the requested status
5. For matching files, parse and display the task title and filename
6. If no matching tasks, print "No [status] tasks." (e.g., "No pending tasks.")
7. Print a count summary (e.g., "Found 3 pending tasks")

### Plan Compact
1. Scan `.code-task.md` files in the configured tasks directory
2. Filter for files with `status: completed` and a non-null `completed` date in frontmatter
3. For each completed task: extract title, description (condensed), and completion date
4. Sort the collected tasks by completion date (ascending)
5. Generate a markdown archive document with all completed task summaries
6. Create `.ody/history/` directory if it doesn't exist
7. Write archive to `.ody/history/archive-{YYYY-MM-DD}.md` (using today's date)
8. Delete the original completed task files from the tasks directory
9. Print a summary: number of tasks archived and archive file path

## Dependencies
- Task file parsing module (`src/util/task.zig`) for frontmatter, title, description parsing
- Config module (`src/lib/config.zig`) for `tasks_dir`
- Constants module (`src/util/constants.zig`) for `BASE_DIR`
- Terminal helpers (`src/util/terminal.zig`) for styled output
- Zig standard library (`std.fs`, `std.mem`, `std.sort`, `std.time`)

## Implementation Approach
### Plan List
1. Define handler: `pub fn run(allocator, args, config) !void`
2. Get status filter from `--status` arg (default "pending")
3. Open and iterate the tasks directory
4. For each `.code-task.md` file: read content, parse frontmatter, check status match
5. Collect and display matching task titles with filenames
6. Print count or "No tasks" message

### Plan Compact
1. Define handler: `pub fn run(allocator, config) !void`
2. Open and iterate the tasks directory
3. For each `.code-task.md` file: read content, parse frontmatter
4. Filter for `status == "completed"` with a `completed` date value
5. Extract title, description, completion date into a `CompletedTask` struct
6. Sort by completion date using `std.sort.sort`
7. Build markdown archive string with header, date, and task summaries
8. Create `.ody/history/` with `makePath()`
9. Write archive file
10. Delete each archived task file with `std.fs.deleteFileAbsolute()`
11. Print summary

## Acceptance Criteria

1. **List Pending Tasks**
   - Given 3 pending and 2 completed task files
   - When running `ody plan list`
   - Then only the 3 pending tasks are listed with titles

2. **List by Status**
   - Given `ody plan list --status completed`
   - When filtering
   - Then only completed tasks are displayed

3. **No Matching Tasks**
   - Given no in-progress tasks exist
   - When running `ody plan list --status in_progress`
   - Then "No in_progress tasks." is printed

4. **Compact Archives Tasks**
   - Given 2 completed task files
   - When running `ody plan compact`
   - Then an archive file is created in `.ody/history/` containing both task summaries

5. **Compact Deletes Originals**
   - Given completed task files were archived
   - When compact finishes
   - Then the original `.code-task.md` files for completed tasks are deleted

6. **Archive Sorted by Date**
   - Given tasks completed on different dates
   - When the archive is generated
   - Then tasks are listed in chronological order by completion date

## Metadata
- **Complexity**: Medium
- **Labels**: zig-rewrite, phase-6, command, plan
