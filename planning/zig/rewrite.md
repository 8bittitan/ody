# Ody CLI Rewrite Plan: TypeScript/Bun to Zig

## Overview

Rewrite the Ody CLI (`packages/cli`) as a native Zig application in a new top-level `cli/` directory. The Zig version will produce a single static binary with zero runtime dependencies, feature parity with the current TypeScript implementation, and idiomatic Zig patterns throughout.

## Project Layout

```
cli/
├── build.zig             # Build system configuration
├── build.zig.zon         # Package manifest (zig-clap dependency)
├── src/
│   ├── main.zig          # Entry point, top-level command dispatch
│   ├── cmd/
│   │   ├── init.zig      # `ody init` interactive wizard
│   │   ├── run.zig       # `ody run` agent execution loop
│   │   ├── config.zig    # `ody config` display
│   │   └── plan/
│   │       ├── new.zig   # `ody plan new`
│   │       ├── edit.zig  # `ody plan edit`
│   │       ├── list.zig  # `ody plan list`
│   │       └── compact.zig # `ody plan compact`
│   ├── backend/
│   │   ├── harness.zig   # Harness interface (Zig tagged union or vtable)
│   │   ├── claude.zig    # Claude Code backend
│   │   ├── codex.zig     # Codex backend
│   │   ├── opencode.zig  # OpenCode backend
│   │   └── detect.zig    # Backend availability detection (PATH lookup)
│   ├── builder/
│   │   ├── run_prompt.zig      # Run loop prompt template
│   │   ├── plan_prompt.zig     # Plan creation prompt template
│   │   └── edit_plan_prompt.zig # Plan edit prompt template
│   ├── lib/
│   │   ├── config.zig    # Config loading, parsing, validation
│   │   └── notify.zig    # OS notification (macOS/Linux)
│   ├── util/
│   │   ├── constants.zig # BASE_DIR, ODY_FILE, etc.
│   │   ├── stream.zig    # Child process stdout/stderr draining
│   │   ├── task.zig      # Task file parsing (frontmatter, title, labels, description)
│   │   ├── terminal.zig  # Raw ANSI escape code helpers (colors, spinners, cursor)
│   │   └── prompt.zig    # Interactive stdin prompts (text, select, confirm, autocomplete)
│   └── types.zig         # Shared types (CompletedTask, CommandOptions, etc.)
└── test/
    └── (test files alongside or in test/ directory, using Zig's built-in test framework)
```

## Dependencies

| Dependency   | Purpose                                                     | Source                            |
| ------------ | ----------------------------------------------------------- | --------------------------------- |
| **zig-clap** | CLI argument parsing with subcommands                       | `build.zig.zon` fetch from GitHub |
| **Zig std**  | Everything else: JSON, filesystem, process spawning, memory | Built-in                          |

No other external dependencies. The TUI (colors, spinners, prompts) will be hand-rolled using raw ANSI escape codes.

## Phase 1: Foundation (Infrastructure)

### 1.1 Project Scaffolding

- Create `cli/build.zig` with a single executable target (`ody`)
- Create `cli/build.zig.zon` declaring the `zig-clap` dependency
- Set up the directory structure above
- Configure the build to produce a static, release-safe binary
- Add cross-compilation targets (linux-x86_64, linux-aarch64, macos-x86_64, macos-aarch64)

### 1.2 Constants (`src/util/constants.zig`)

Port all constants:

```zig
pub const BASE_DIR = ".ody";
pub const ODY_FILE = "ody.json";
pub const TASKS_DIR = "tasks";
pub const ALLOWED_BACKENDS = [_][]const u8{ "opencode", "claude", "codex" };
```

Drop `PRD_FILE` (dead code in current implementation).

### 1.3 Config System (`src/lib/config.zig`)

**Struct definition** (replaces Zod schema):

```zig
pub const OdyConfig = struct {
    backend: []const u8,            // required, must be in ALLOWED_BACKENDS
    max_iterations: u32,            // required, >= 0 (0 = unlimited)
    should_commit: bool = false,
    validator_commands: [][]const u8 = &.{},
    model: ?[]const u8 = null,
    skip_permissions: bool = true,
    agent: []const u8 = "build",
    tasks_dir: []const u8 = "tasks",
    notify: NotifySetting = .disabled,
};

pub const NotifySetting = enum { disabled, all, individual };
```

**Functions:**

- `load(allocator) !OdyConfig` -- Load and merge global + local config:
  1. Resolve home dir via `std.posix.getenv("HOME")` with fallback
  2. Try `~/.ody/ody.json`, then `~/.config/ody/ody.json` (global)
  3. Try `.ody/ody.json` (local)
  4. Parse both with `std.json.parseFromSlice`
  5. Merge (local fields override global) using a custom merge function
  6. Validate with `validate()`
- `validate(config) !void` -- Manual validation:
  - `backend` must be in `ALLOWED_BACKENDS`
  - `max_iterations` is already constrained by `u32`
  - `agent` must be non-empty
  - `tasks_dir` must be non-empty
  - Return descriptive error messages on failure
- `writeConfig(allocator, config, path) !void` -- Serialize and write to disk
- Store loaded config in a file-scoped `var` (module-level singleton, same pattern as the TS namespace)

### 1.4 ANSI Terminal Helpers (`src/util/terminal.zig`)

Hand-rolled ANSI escape code utilities:

- **Colors:** `red()`, `green()`, `yellow()`, `cyan()`, `bold()`, `dim()`, `reset()` -- return ANSI escape sequences, write to a `std.io.Writer`
- **Cursor:** `hideCursor()`, `showCursor()`, `clearLine()`, `moveCursorUp(n)`
- **Spinner:** A `Spinner` struct that runs on a separate thread (or uses `std.time` polling):
  - `start(message)` -- begins spinning animation
  - `stop(finalMessage)` -- clears spinner, prints final message
  - Uses braille or line-drawing characters (e.g., `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`)
- **Box/framing:** Simple `intro(title)` and `outro(message)` functions that print styled headers/footers

### 1.5 Interactive Prompts (`src/util/prompt.zig`)

Built on top of `terminal.zig`, using raw mode stdin:

- `text(message, placeholder, validate) !?[]const u8` -- Text input with optional placeholder and validation callback. Returns `null` on cancel (Ctrl+C).
- `confirm(message, default) !?bool` -- Yes/no prompt. Returns `null` on cancel.
- `select(T, message, options: []Option(T)) !?T` -- Arrow-key selection from a list. Each option has a `label` and `value`. Returns `null` on cancel.
- `autocomplete(T, message, options: []Option(T)) !?T` -- Filterable selection (type to narrow). Returns `null` on cancel.

All prompts handle raw terminal mode (disable canonical mode, disable echo) and restore on exit/cancel. Use `std.posix.tcgetattr` / `std.posix.tcsetattr` for terminal mode switching.

## Phase 2: CLI Framework & Command Dispatch

### 2.1 Argument Parsing (`src/main.zig`)

Use `zig-clap` to define the command tree:

```
ody
├── init    [-b backend] [-i maxIterations] [-m model] [-c] [-a agent] [-n notify] [--dry-run]
├── run     [taskFile] [--verbose] [--once] [--dry-run] [-l label] [-i iterations] [--no-notify]
├── config
└── plan
    ├── new     [--dry-run] [--verbose]
    ├── edit    [--dry-run] [--verbose]
    ├── list
    └── compact
```

`main()` function:

1. Parse top-level args with `zig-clap`
2. Load config via `config.load()` (wrapped in error handling -- config may not exist for `init`)
3. Dispatch to the appropriate `cmd/*.zig` handler
4. All commands receive an allocator (use `std.heap.GeneralPurposeAllocator` or arena allocator)

### 2.2 Version Flag

Read version from a comptime-embedded string (set in `build.zig` via `@embedFile` or build options). Replaces reading from `package.json`.

## Phase 3: Backend System

### 3.1 Harness Interface (`src/backend/harness.zig`)

Use a Zig tagged union (or a vtable-based interface) instead of an abstract class:

```zig
pub const CommandOptions = struct {
    model: ?[]const u8 = null,
    agent: ?[]const u8 = null,
};

pub const Backend = union(enum) {
    claude: Claude,
    codex: Codex,
    opencode: Opencode,

    pub fn buildCommand(self: *Backend, allocator: Allocator, prompt: []const u8, opts: CommandOptions) ![]const []const u8 { ... }
    pub fn buildOnceCommand(self: *Backend, allocator: Allocator, prompt: []const u8, opts: CommandOptions) ![]const []const u8 { ... }
    pub fn name(self: Backend) []const u8 { ... }
};

pub fn fromConfig(config: OdyConfig) Backend { ... }
```

The `fromConfig` factory replaces the TypeScript `Backend` class constructor.

### 3.2 Claude Backend (`src/backend/claude.zig`)

Port `buildCommand` and `buildOnceCommand`:

- Build `argv` as `[]const []const u8` using an `ArrayList`
- Conditionally include `--dangerously-skip-permissions` based on config
- Prefix prompt with `@.ody/tasks` path

### 3.3 Codex Backend (`src/backend/codex.zig`)

Same pattern. Conditionally include `--skip-git-repo-check` based on `should_commit`.

### 3.4 OpenCode Backend (`src/backend/opencode.zig`)

Same pattern. Only backend that uses `model` and `agent` from `CommandOptions`.

### 3.5 Backend Detection (`src/backend/detect.zig`)

Replace `Bun.which()` with a function that searches `PATH`:

```zig
pub fn which(name: []const u8) ?[]const u8
```

Split `std.posix.getenv("PATH")` on `:`, check each directory for an executable file using `std.fs.accessAbsolute` with `.executable` mode.

## Phase 4: Prompt Builders

The prompts themselves can live in markdown files that are embedded into the binary at comptime.

### 4.1 Run Prompt (`src/builder/run_prompt.zig`)

Port the two templates (`LOOP_PROMPT` and `SINGLE_TASK_PROMPT`) as comptime string literals with runtime substitution:

- `buildRunPrompt(allocator, options) ![]const u8`
- Use `std.fmt.allocPrint` or manual string replacement for `{TASKS_DIR}`, `{VALIDATION_COMMANDS}`, etc.
- Port the label filter appendage logic

### 4.2 Plan Prompt (`src/builder/plan_prompt.zig`)

Port `PLAN_PROMPT` template with `{TASK_DESCRIPTION}`, `{CURRENT_DATE}`, `{TASKS_DIR}` substitution.

### 4.3 Edit Plan Prompt (`src/builder/edit_plan_prompt.zig`)

Port `EDIT_PLAN_PROMPT` template with `{FILE_PATH}` and `{FILE_CONTENT}` substitution.

## Phase 5: Utility Modules

### 5.1 Stream Processing (`src/util/stream.zig`)

Replace `Stream.toOutput()` with a function that reads from a `std.process.Child`'s stdout/stderr pipes:

```zig
pub const StreamOptions = struct {
    should_print: bool = false,
    on_chunk: ?*const fn (accumulated: []const u8) bool = null,
};

pub fn drainStream(allocator: Allocator, reader: anytype, options: StreamOptions) ![]const u8
```

- Read in chunks using `reader.read()`
- Accumulate into a growable `ArrayList(u8)`
- Optionally print non-empty chunks
- Call `on_chunk` callback; break if it returns `true`

### 5.2 Task File Parsing (`src/util/task.zig`)

Port all functions:

- `parseFrontmatter(content) std.StringHashMap` -- Parse YAML frontmatter between `---` delimiters
- `parseTitle(content) []const u8` -- Extract `# Task: ...` or `# ...` heading
- `parseDescription(content) []const u8` -- Extract `## Description` section, condense to 2-3 sentences
- `parseLabels(content) [][]const u8` -- Extract `**Labels**: ...` values
- `getTaskFilesByLabel(allocator, label) ![][]const u8` -- Scan task files, filter by label match
- `resolveTasksDir() []const u8` -- Return configured tasks dir or default

### 5.3 OS Notifications (`src/lib/notify.zig`)

Port `sendNotification`:

- Use `std.process.Child` to spawn:
  - macOS: `osascript -e 'display notification "..." with title "..."'`
  - Linux: `notify-send <title> <message>`
- Silently swallow errors (best-effort)
- Detect platform at comptime with `@import("builtin").os.tag`

### 5.4 Input Prompt Placeholder (`src/util/prompt.zig`)

Port `getRandomValidatorPlaceholder()` using `std.crypto.random` or `std.Random` to select from the hardcoded list.

## Phase 6: Command Implementations

### 6.1 `ody init` (`src/cmd/init.zig`)

Full interactive wizard:

1. Create `.ody/` directory if missing (`std.fs.makeDirAbsolute`)
2. Detect available backends via `detect.which()`
   - should be `Backend.getAvailableBackends()`
3. Prompt for backend (autocomplete from available)
4. Prompt for model (text input, optional)
5. Prompt for agent profile (text input, default "build")
6. Prompt for validator commands (loop until blank)
7. If Claude backend, prompt for `skip_permissions` (confirm)
8. Prompt for notification preference (select)
9. Validate config via `config.validate()`
10. If `--dry-run`, print config JSON and exit
11. Write config to `.ody/ody.json` via `std.fs.createFileAbsolute` + `std.json.stringify`

### 6.2 `ody run` (`src/cmd/run.zig`)

Main agent execution loop:

**Setup:**

- Resolve notification setting (`--no-notify` flag overrides config)
- Parse `--iterations` override
- Validate `taskFile` positional arg (check `.code-task.md` extension, file existence)
- Validate mutual exclusivity of `taskFile` and `--label`
- If `--label`, call `getTaskFilesByLabel()`
- Build prompt via `run_prompt.buildRunPrompt()`

**`--once` mode:**

> NOTE: Can be skipped for initial rewrite

- Build command via `backend.buildOnceCommand()`
- If `--dry-run`, print JSON representation and exit
- Spawn child process with PTY-like behavior:
  - Use `std.process.Child` with inherited stdin and piped stdout
  - Read stdout in a thread, accumulate text, check for `<woof>COMPLETE</woof>`
  - Write stdout to terminal in real-time
  - On completion marker, send SIGTERM to child
- Wait for exit, send notification if enabled

**Loop mode:**

- Calculate `max_iterations` (override > single-task default of 1 > config value)
- If not verbose, start spinner
- For each iteration:
  - Spawn child process with `stdin=ignore, stdout=pipe, stderr=pipe`
  - Drain stdout and stderr concurrently using two threads (or `std.Thread`)
  - Check for `<woof>COMPLETE</woof>` in stdout accumulator
  - On completion, stop spinner, send notification if `individual`, break
  - Otherwise, send notification if `individual`
- After loop: send notification if `all`
- Print outro message

**Concurrency note:** Zig doesn't have async/await like JS. Use `std.Thread.spawn` to drain stdout and stderr concurrently. Alternatively, use `std.posix.poll` to multiplex reads on both pipes.

### 6.3 `ody config` (`src/cmd/config.zig`)

- Call `config.all()`, serialize to pretty-printed JSON via `std.json.stringify` with `.whitespace = .indent_2`
- If config not loaded, print warning message

### 6.4 `ody plan new` (`src/cmd/plan/new.zig`)

- In a loop:
  - Prompt for task description (text input, validate non-empty)
  - Build prompt via `plan_prompt.buildPlanPrompt()`
  - If `--dry-run`, print prompt
  - Otherwise: ensure `.ody/tasks/` exists, start spinner, spawn backend, drain with completion detection, stop spinner
  - Prompt "Would you like to add another plan?" -- continue or break

### 6.5 `ody plan edit` (`src/cmd/plan/edit.zig`)

- Scan `.code-task.md` files using `std.fs.Dir.iterate()`
- Filter only for tasks that are `"pending"`
- Read each file, parse title
- Show select prompt with task names
- Read selected file content
- Build prompt via `edit_plan_prompt.buildEditPlanPrompt()`
- If `--dry-run`, print and return
- Spawn backend, drain with completion marker, stop spinner

### 6.6 `ody plan list` (`src/cmd/plan/list.zig`)

Should accept a `--status|-s` flag to filter by status, defaults to `"pending"`

- Scan `.code-task.md` files
- Parse frontmatter of each
- Filter for `status == "pending"`
- Print pending task titles with filenames
- If none, print "No pending tasks."

### 6.7 `ody plan compact` (`src/cmd/plan/compact.zig`)

- Scan `.code-task.md` files
- Filter for `status == "completed"` with a `completed` date
- Extract title, description, completion date
- Sort by completion date
- Generate markdown archive
- Create `.ody/history/` directory
- Write archive to `.ody/history/archive-{YYYY-MM-DD}.md`
- Delete original completed task files
- Print summary

## Phase 7: Process Spawning

This is a cross-cutting concern used by `run`, `plan new`, `plan edit`.

### 7.1 Standard Spawn (Loop/Piped Mode)

```zig
pub fn spawnPiped(allocator: Allocator, argv: []const []const u8) !std.process.Child
```

- `stdin`: `.close` (equivalent to `'ignore'`)
- `stdout`: `.pipe`
- `stderr`: `.pipe` (or `.inherit` when not verbose)
- Returns the `Child` for the caller to drain and wait

### 7.2 Interactive Spawn (Once/PTY Mode)

> NOTE: Can be skipped for initial rewrite

For `--once` mode, the current TS code uses Bun's PTY API. In Zig:

- Use `std.posix.openpty` (or `forkpty` via C interop) to create a pseudo-terminal
- Spawn the child with the PTY as its controlling terminal
- Read from the PTY master fd in a loop, write to real stdout, accumulate for completion detection
- On `<woof>COMPLETE</woof>`, send SIGTERM to child

Alternative simpler approach: spawn with inherited stdio and use a wrapper that tees output. The PTY approach is more faithful to the current behavior.

## Phase 8: Testing

Fresh test suite using Zig's built-in `test` keyword:

| Module          | Test Focus                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------ |
| `config.zig`    | Parse valid/invalid JSON, validate field constraints, merge logic, global/local precedence |
| `task.zig`      | Frontmatter parsing, title extraction, description condensation, label filtering           |
| `stream.zig`    | Chunk accumulation, callback stopping, empty streams                                       |
| `terminal.zig`  | ANSI sequence generation correctness                                                       |
| `prompt.zig`    | Validator placeholder selection                                                            |
| `backend/*.zig` | Command array construction for each backend with various config combinations               |
| `builder/*.zig` | Template substitution correctness                                                          |
| `detect.zig`    | PATH searching logic                                                                       |

Run all tests: `zig build test` (configured in `build.zig` with a test step).

## Phase 9: Build & CI

### 9.1 Build Configuration (`build.zig`)

```zig
const exe = b.addExecutable(.{
    .name = "ody",
    .root_source_file = b.path("src/main.zig"),
    .target = target,
    .optimize = optimize,
});
// Add zig-clap as a dependency
// Add test step
// Add install step
```

Build commands:

- `zig build` -- debug build
- `zig build -Doptimize=ReleaseSafe` -- release build
- `zig build test` -- run all tests
- `zig build -Dtarget=x86_64-linux` -- cross-compile

### 9.2 CI Pipeline (`.github/workflows/ci.yml`)

Replace the Bun CI with Zig CI:

- **lint:** `zig fmt --check src/` (Zig's built-in formatter)
- **test:** `zig build test`
- **build:** `zig build -Doptimize=ReleaseSafe` (verify it compiles)
- Use `mlugg/setup-zig` action for Zig installation
- Matrix build for multiple targets if desired

### 9.3 AGENTS.md Update

Rewrite to reflect Zig tooling, commands, conventions, and project structure.

## Phase 10: Migration & Cleanup

### 10.1 Coexistence Period

During development, both `packages/cli` (TS) and `cli/` (Zig) exist. The TS version remains functional until the Zig version reaches full parity.

### 10.2 Parity Verification

Manually verify every command and flag combination:

- `ody init` (all flags, interactive mode, dry-run)
- `ody run` (loop, once, dry-run, verbose, label, iterations, no-notify, taskFile)
- `ody config`
- `ody plan new/edit/list/compact` (all flags)

### 10.3 Final Cleanup

Once Zig version is verified:

- Remove `packages/cli`, `node_modules/`, `bun.lock`
- Move `cli/` into `packages`, replacing the Bun based one
- Update README.md with Zig build instructions
- Update AGENTS.md

## Execution Order Summary

| Phase | Description                                                    | Estimated Complexity             |
| ----- | -------------------------------------------------------------- | -------------------------------- |
| 1     | Foundation (scaffolding, constants, config, terminal, prompts) | High -- most infrastructure work |
| 2     | CLI framework & command dispatch with zig-clap                 | Medium                           |
| 3     | Backend system (harness, 3 backends, detection)                | Medium                           |
| 4     | Prompt builders (3 templates with substitution)                | Low                              |
| 5     | Utility modules (stream, task parsing, notify)                 | Medium                           |
| 6     | Command implementations (init, run, config, plan/\*)           | High -- largest phase            |
| 7     | Process spawning (piped + PTY modes)                           | Medium-High                      |
| 8     | Testing                                                        | Medium                           |
| 9     | Build & CI                                                     | Low                              |
| 10    | Migration & cleanup                                            | Low                              |

Phases 1-3 can proceed somewhat in parallel. Phase 6 depends on 1-5. Phase 7 is woven into Phase 6 but listed separately because the PTY work is non-trivial.
