---
status: completed
created: 2026-02-15
started: 2026-02-14
completed: 2026-02-14
---
# Task: Fix Leading "+" in Created Frontmatter Date

## Description
The `created` frontmatter property in generated task files contains a leading `+` in the date string (e.g., `+2026-02-15` instead of `2026-02-15`). This is caused by a signed integer cast in the date formatting function, which makes Zig's zero-padded format specifier include the sign character.

## Background
When `ody plan new` creates a task file, it calls `currentDateString()` in `cli/src/builder/plan_prompt.zig` to produce the `{CURRENT_DATE}` placeholder value. This function casts the year from `u16` (the native `std.time.epoch.Year` type) to `i32` (a signed integer) on line 140. When Zig's `std.fmt.allocPrint` formats a signed integer with `{d:0>4}`, the zero-fill is sign-aware and prepends a `+` for positive values, producing `+2026` instead of `2026`. The analogous date function in `cli/src/cmd/task/compact.zig` does not have this issue because it keeps the year as its native unsigned type.

## Technical Requirements
1. The `currentDateString()` function in `cli/src/builder/plan_prompt.zig` must produce dates in strict `YYYY-MM-DD` format with no leading `+`.
2. The year variable must be an unsigned integer type to prevent sign-aware formatting.
3. The existing unit tests in the file must continue to pass after the change.

## Dependencies
- `std.time.epoch.EpochDay` and its `calculateYearDay()` method, which returns a `YearAndDay` struct where `.year` is `u16` (`std.time.epoch.Year`).
- `std.fmt.allocPrint` formatting behavior for signed vs. unsigned integers with zero-fill alignment specifiers.

## Implementation Approach
1. Open `cli/src/builder/plan_prompt.zig` and locate the `currentDateString` function (line 134).
2. Change line 140 from `const year: i32 = epoch_day.calculateYearDay().year;` to `const year: u16 = epoch_day.calculateYearDay().year;`. This keeps the year in its native unsigned type and eliminates the `+` prefix from formatted output.
3. Run `zig build test` from the `cli/` directory to verify no regressions.
4. Optionally verify by running `zig build run -- plan new` and inspecting the generated task file's `created:` field.

## Acceptance Criteria

1. **Date format is correct**
   - Given a new task file is created via `ody plan new`
   - When the `created` frontmatter field is inspected
   - Then the date is in `YYYY-MM-DD` format with no leading `+` (e.g., `2026-02-15`)

2. **Existing tests pass**
   - Given the change to `currentDateString()` has been applied
   - When `zig build test` is run from the `cli/` directory
   - Then all tests pass without failure

3. **Consistency with compact.zig**
   - Given both `currentDateString()` in `plan_prompt.zig` and `todayDateStr()` in `compact.zig` format dates
   - When their output is compared
   - Then both produce the same `YYYY-MM-DD` format without sign prefixes

## Metadata
- **Complexity**: Low
- **Labels**: bug, plan-prompt, date-formatting, frontmatter
