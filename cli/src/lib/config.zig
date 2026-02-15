/// Configuration loading, validation, merging, and persistence.
///
/// Replaces the Zod-based config system in the TypeScript implementation
/// (`packages/cli/src/lib/config.ts`) with manual struct parsing using
/// `std.json.parseFromSlice`.
///
/// Usage:
///   try config.load(allocator);    // call once at startup
///   const cfg = config.all();      // access the loaded config
///   const backend = config.get(.backend);
const std = @import("std");
const constants = @import("../util/constants.zig");
const types = @import("../types.zig");

const OdyConfig = types.OdyConfig;
const NotifySetting = types.NotifySetting;

// -------------------------------------------------------------------------
// Internal JSON-compatible struct (camelCase field names match the JSON file)
// -------------------------------------------------------------------------

/// Raw JSON representation used for `std.json.parseFromSlice`. Field names
/// intentionally use camelCase to match the on-disk format.
pub const JsonConfig = struct {
    backend: ?[]const u8 = null,
    maxIterations: ?u32 = null,
    shouldCommit: ?bool = null,
    validatorCommands: ?[]const []const u8 = null,
    model: ?[]const u8 = null,
    skipPermissions: ?bool = null,
    agent: ?[]const u8 = null,
    tasksDir: ?[]const u8 = null,
    notify: ?std.json.Value = null,
};

// -------------------------------------------------------------------------
// Module-level singleton
// -------------------------------------------------------------------------

var loaded_config: ?OdyConfig = null;

/// Arena that owns all memory referenced by the loaded config values.
/// Allocated on first `load()`, freed on `deinit()`.
var config_arena: ?std.heap.ArenaAllocator = null;

// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

pub const LoadError = error{
    InvalidBackend,
    EmptyAgent,
    EmptyTasksDir,
};

pub const ConfigError = LoadError ||
    std.json.ParseFromValueError ||
    std.fs.File.OpenError ||
    std.fs.File.ReadError ||
    std.mem.Allocator.Error ||
    error{StreamTooLong};

/// Load configuration from disk. Resolves global config first, then local
/// config, and merges them (local fields take precedence). Validates the
/// merged result. Calling `load` more than once is a no-op.
pub fn load(parent_allocator: std.mem.Allocator) ConfigError!void {
    if (loaded_config != null) return;

    var arena = std.heap.ArenaAllocator.init(parent_allocator);
    errdefer arena.deinit();
    const allocator = arena.allocator();

    const global_json = loadGlobalConfig(allocator) catch null;
    const local_json = loadLocalConfig(allocator) catch null;

    if (global_json == null and local_json == null) {
        // No config found anywhere – leave loaded_config as null.
        // Callers that tolerate missing config (e.g. `ody init`) should
        // check via `isLoaded()`.
        arena.deinit();
        return;
    }

    const merged = mergeJsonConfigs(global_json, local_json);
    const cfg = convertToOdyConfig(merged);

    try validate(cfg);

    loaded_config = cfg;
    config_arena = arena;
}

/// Return `true` if a valid config has been loaded.
pub fn isLoaded() bool {
    return loaded_config != null;
}

/// Return the full loaded configuration. Caller must have called `load`
/// first; returns `null` if no config was found on disk.
pub fn all() ?OdyConfig {
    return loaded_config;
}

/// Field selector for `get()`.
pub const Field = enum {
    backend,
    max_iterations,
    should_commit,
    validator_commands,
    model,
    skip_permissions,
    agent,
    tasks_dir,
    notify,
};

/// Access an individual config field. Returns `null` when config has not
/// been loaded.
pub fn get(field: Field) ?FieldType(field) {
    const cfg = loaded_config orelse return null;
    return switch (field) {
        .backend => cfg.backend,
        .max_iterations => cfg.max_iterations,
        .should_commit => cfg.should_commit,
        .validator_commands => cfg.validator_commands,
        .model => cfg.model,
        .skip_permissions => cfg.skip_permissions,
        .agent => cfg.agent,
        .tasks_dir => cfg.tasks_dir,
        .notify => cfg.notify,
    };
}

/// Resolve the return type for a given `Field` value.
fn FieldType(comptime field: Field) type {
    return switch (field) {
        .backend => []const u8,
        .max_iterations => u32,
        .should_commit => bool,
        .validator_commands => []const []const u8,
        .model => ?[]const u8,
        .skip_permissions => bool,
        .agent => []const u8,
        .tasks_dir => []const u8,
        .notify => NotifySetting,
    };
}

/// Validate a config struct. Returns `LoadError` on invalid values.
pub fn validate(cfg: OdyConfig) LoadError!void {
    if (!constants.isAllowedBackend(cfg.backend)) {
        return error.InvalidBackend;
    }
    if (cfg.agent.len == 0) {
        return error.EmptyAgent;
    }
    if (cfg.tasks_dir.len == 0) {
        return error.EmptyTasksDir;
    }
}

/// Serialize an `OdyConfig` to JSON and write it to `path`. Uses the
/// camelCase field names expected by the TypeScript tooling.
pub fn writeConfig(allocator: std.mem.Allocator, cfg: OdyConfig, path: []const u8) !void {
    const json_cfg = convertToJsonConfig(cfg);
    const json_bytes = try std.json.Stringify.valueAlloc(allocator, json_cfg, .{
        .whitespace = .indent_2,
    });
    defer allocator.free(json_bytes);

    // Append a trailing newline for POSIX friendliness.
    const with_newline = try std.mem.concat(allocator, u8, &.{ json_bytes, "\n" });
    defer allocator.free(with_newline);

    // Write using std.fs. We need to handle both absolute and relative paths.
    const file = if (std.fs.path.isAbsolute(path))
        try std.fs.openFileAbsolute(path, .{ .mode = .write_only })
    else
        try std.fs.cwd().createFile(path, .{});
    defer file.close();
    try file.writeAll(with_newline);
}

/// Free all memory owned by the config module. After calling this,
/// `all()` and `get()` will return `null` until `load()` is called again.
pub fn deinit() void {
    if (config_arena) |*arena| {
        arena.deinit();
        config_arena = null;
    }
    loaded_config = null;
}

/// Reset module state (intended for tests).
pub fn reset() void {
    deinit();
}

// -------------------------------------------------------------------------
// Internal helpers
// -------------------------------------------------------------------------

/// Try to load the global config file. Resolution order:
///   1. `~/.ody/ody.json`
///   2. `~/.config/ody/ody.json`
fn loadGlobalConfig(allocator: std.mem.Allocator) !?JsonConfig {
    const home = std.posix.getenv("HOME") orelse return null;

    // Try ~/.ody/ody.json
    const primary = try std.fs.path.join(allocator, &.{ home, constants.BASE_DIR, constants.ODY_FILE });
    if (loadJsonConfigFile(allocator, primary)) |cfg| return cfg else |_| {}

    // Try ~/.config/ody/ody.json
    const xdg = try std.fs.path.join(allocator, &.{ home, ".config", "ody", constants.ODY_FILE });
    if (loadJsonConfigFile(allocator, xdg)) |cfg| return cfg else |_| {}

    return null;
}

/// Load the local (project-level) config file at `.ody/ody.json`.
fn loadLocalConfig(allocator: std.mem.Allocator) !?JsonConfig {
    const local_path = constants.BASE_DIR ++ "/" ++ constants.ODY_FILE;
    return loadJsonConfigFile(allocator, local_path) catch null;
}

/// Read a JSON file at `path` and parse it into a `JsonConfig`. Returns
/// an error if the file does not exist or cannot be parsed.
fn loadJsonConfigFile(allocator: std.mem.Allocator, path: []const u8) !JsonConfig {
    const file = if (std.fs.path.isAbsolute(path))
        try std.fs.openFileAbsolute(path, .{})
    else
        try std.fs.cwd().openFile(path, .{});
    defer file.close();

    const content = try file.readToEndAlloc(allocator, 1024 * 1024);

    const parsed = try std.json.parseFromSlice(JsonConfig, allocator, content, .{
        .allocate = .alloc_always,
        .ignore_unknown_fields = true,
    });

    return parsed.value;
}

/// Merge two optional `JsonConfig` values. Non-null fields from `local`
/// override the corresponding fields from `global`.
fn mergeJsonConfigs(global: ?JsonConfig, local: ?JsonConfig) JsonConfig {
    const base = global orelse JsonConfig{};
    const over = local orelse return base;

    return JsonConfig{
        .backend = over.backend orelse base.backend,
        .maxIterations = over.maxIterations orelse base.maxIterations,
        .shouldCommit = over.shouldCommit orelse base.shouldCommit,
        .validatorCommands = over.validatorCommands orelse base.validatorCommands,
        .model = over.model orelse base.model,
        .skipPermissions = over.skipPermissions orelse base.skipPermissions,
        .agent = over.agent orelse base.agent,
        .tasksDir = over.tasksDir orelse base.tasksDir,
        .notify = over.notify orelse base.notify,
    };
}

/// Convert an internal `JsonConfig` to the public `OdyConfig` type,
/// applying default values for missing fields.
fn convertToOdyConfig(json: JsonConfig) OdyConfig {
    return OdyConfig{
        .backend = json.backend orelse "opencode",
        .max_iterations = json.maxIterations orelse 5,
        .should_commit = json.shouldCommit orelse false,
        .validator_commands = json.validatorCommands orelse &.{},
        .model = json.model,
        .skip_permissions = json.skipPermissions orelse true,
        .agent = json.agent orelse constants.DEFAULT_AGENT,
        .tasks_dir = json.tasksDir orelse constants.TASKS_DIR,
        .notify = parseNotifySetting(json.notify),
    };
}

/// Convert a public `OdyConfig` back to the JSON-facing struct for
/// serialization.
pub fn convertToJsonConfig(cfg: OdyConfig) JsonConfig {
    return JsonConfig{
        .backend = cfg.backend,
        .maxIterations = cfg.max_iterations,
        .shouldCommit = cfg.should_commit,
        .validatorCommands = cfg.validator_commands,
        .model = cfg.model,
        .skipPermissions = cfg.skip_permissions,
        .agent = cfg.agent,
        .tasksDir = cfg.tasks_dir,
        .notify = serializeNotifySetting(cfg.notify),
    };
}

/// Interpret the polymorphic `notify` JSON value (boolean or string) as a
/// `NotifySetting` enum.
fn parseNotifySetting(val: ?std.json.Value) NotifySetting {
    const v = val orelse return .disabled;
    switch (v) {
        .bool => |b| return if (b) .all else .disabled,
        .string => |s| {
            if (std.mem.eql(u8, s, "all")) return .all;
            if (std.mem.eql(u8, s, "individual")) return .individual;
            return .disabled;
        },
        else => return .disabled,
    }
}

/// Convert a `NotifySetting` back to a `std.json.Value` for serialization.
fn serializeNotifySetting(setting: NotifySetting) ?std.json.Value {
    return switch (setting) {
        .disabled => .{ .bool = false },
        .all => .{ .string = "all" },
        .individual => .{ .string = "individual" },
    };
}

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

test "convertToOdyConfig applies defaults" {
    const json = JsonConfig{};
    const cfg = convertToOdyConfig(json);
    try std.testing.expectEqualStrings("opencode", cfg.backend);
    try std.testing.expectEqual(@as(u32, 5), cfg.max_iterations);
    try std.testing.expect(!cfg.should_commit);
    try std.testing.expect(cfg.skip_permissions);
    try std.testing.expectEqualStrings(constants.DEFAULT_AGENT, cfg.agent);
    try std.testing.expectEqualStrings(constants.TASKS_DIR, cfg.tasks_dir);
    try std.testing.expectEqual(NotifySetting.disabled, cfg.notify);
    try std.testing.expect(cfg.model == null);
}

test "convertToOdyConfig preserves explicit values" {
    const json = JsonConfig{
        .backend = "claude",
        .maxIterations = 10,
        .shouldCommit = true,
        .model = "gpt-4",
        .agent = "deploy",
        .tasksDir = "my-tasks",
    };
    const cfg = convertToOdyConfig(json);
    try std.testing.expectEqualStrings("claude", cfg.backend);
    try std.testing.expectEqual(@as(u32, 10), cfg.max_iterations);
    try std.testing.expect(cfg.should_commit);
    try std.testing.expectEqualStrings("gpt-4", cfg.model.?);
    try std.testing.expectEqualStrings("deploy", cfg.agent);
    try std.testing.expectEqualStrings("my-tasks", cfg.tasks_dir);
}

test "mergeJsonConfigs local overrides global" {
    const global = JsonConfig{
        .backend = "claude",
        .maxIterations = 3,
        .shouldCommit = true,
    };
    const local = JsonConfig{
        .backend = "opencode",
        // maxIterations left as null → inherits from global
    };
    const merged = mergeJsonConfigs(global, local);
    try std.testing.expectEqualStrings("opencode", merged.backend.?);
    try std.testing.expectEqual(@as(u32, 3), merged.maxIterations.?);
    try std.testing.expect(merged.shouldCommit.?);
}

test "mergeJsonConfigs global only" {
    const global = JsonConfig{ .backend = "codex" };
    const merged = mergeJsonConfigs(global, null);
    try std.testing.expectEqualStrings("codex", merged.backend.?);
}

test "mergeJsonConfigs local only" {
    const local = JsonConfig{ .backend = "claude" };
    const merged = mergeJsonConfigs(null, local);
    try std.testing.expectEqualStrings("claude", merged.backend.?);
}

test "parseNotifySetting bool false" {
    try std.testing.expectEqual(NotifySetting.disabled, parseNotifySetting(.{ .bool = false }));
}

test "parseNotifySetting bool true" {
    try std.testing.expectEqual(NotifySetting.all, parseNotifySetting(.{ .bool = true }));
}

test "parseNotifySetting string all" {
    try std.testing.expectEqual(NotifySetting.all, parseNotifySetting(.{ .string = "all" }));
}

test "parseNotifySetting string individual" {
    try std.testing.expectEqual(NotifySetting.individual, parseNotifySetting(.{ .string = "individual" }));
}

test "parseNotifySetting null" {
    try std.testing.expectEqual(NotifySetting.disabled, parseNotifySetting(null));
}

test "validate rejects invalid backend" {
    var cfg = OdyConfig{ .backend = "invalid" };
    try std.testing.expectError(error.InvalidBackend, validate(cfg));

    cfg.backend = "claude";
    try validate(cfg);
}

test "validate rejects empty agent" {
    var cfg = OdyConfig{ .backend = "claude" };
    cfg.agent = "";
    try std.testing.expectError(error.EmptyAgent, validate(cfg));
}

test "validate rejects empty tasks_dir" {
    var cfg = OdyConfig{ .backend = "claude" };
    cfg.tasks_dir = "";
    try std.testing.expectError(error.EmptyTasksDir, validate(cfg));
}

test "validate accepts valid config" {
    const cfg = OdyConfig{ .backend = "opencode" };
    try validate(cfg);
}

test "roundtrip JsonConfig conversion" {
    const original = OdyConfig{
        .backend = "claude",
        .max_iterations = 7,
        .should_commit = true,
        .model = "gpt-4",
        .skip_permissions = false,
        .agent = "deploy",
        .tasks_dir = "my-tasks",
        .notify = .individual,
    };
    const json = convertToJsonConfig(original);
    const back = convertToOdyConfig(json);
    try std.testing.expectEqualStrings(original.backend, back.backend);
    try std.testing.expectEqual(original.max_iterations, back.max_iterations);
    try std.testing.expect(original.should_commit == back.should_commit);
    try std.testing.expectEqualStrings(original.model.?, back.model.?);
    try std.testing.expect(original.skip_permissions == back.skip_permissions);
    try std.testing.expectEqualStrings(original.agent, back.agent);
    try std.testing.expectEqualStrings(original.tasks_dir, back.tasks_dir);
    try std.testing.expectEqual(original.notify, back.notify);
}

test "serializeNotifySetting roundtrip" {
    try std.testing.expectEqual(
        NotifySetting.disabled,
        parseNotifySetting(serializeNotifySetting(.disabled)),
    );
    try std.testing.expectEqual(
        NotifySetting.all,
        parseNotifySetting(serializeNotifySetting(.all)),
    );
    try std.testing.expectEqual(
        NotifySetting.individual,
        parseNotifySetting(serializeNotifySetting(.individual)),
    );
}

test "parse actual JSON string" {
    const json_str =
        \\{"backend":"opencode","maxIterations":0,"shouldCommit":false,"validatorCommands":[],"model":"anthropic/claude-opus-4-6"}
    ;
    const parsed = try std.json.parseFromSlice(JsonConfig, std.testing.allocator, json_str, .{
        .allocate = .alloc_always,
        .ignore_unknown_fields = true,
    });
    defer parsed.deinit();

    const cfg = convertToOdyConfig(parsed.value);
    try std.testing.expectEqualStrings("opencode", cfg.backend);
    try std.testing.expectEqual(@as(u32, 0), cfg.max_iterations);
    try std.testing.expect(!cfg.should_commit);
    try std.testing.expectEqualStrings("anthropic/claude-opus-4-6", cfg.model.?);
}

test "parse JSON with notify boolean" {
    const json_str =
        \\{"backend":"claude","notify":false}
    ;
    const parsed = try std.json.parseFromSlice(JsonConfig, std.testing.allocator, json_str, .{
        .allocate = .alloc_always,
        .ignore_unknown_fields = true,
    });
    defer parsed.deinit();

    const cfg = convertToOdyConfig(parsed.value);
    try std.testing.expectEqual(NotifySetting.disabled, cfg.notify);
}

test "parse JSON with notify string" {
    const json_str =
        \\{"backend":"claude","notify":"individual"}
    ;
    const parsed = try std.json.parseFromSlice(JsonConfig, std.testing.allocator, json_str, .{
        .allocate = .alloc_always,
        .ignore_unknown_fields = true,
    });
    defer parsed.deinit();

    const cfg = convertToOdyConfig(parsed.value);
    try std.testing.expectEqual(NotifySetting.individual, cfg.notify);
}

test "singleton is initially empty" {
    // Ensure clean state.
    reset();
    try std.testing.expect(all() == null);
    try std.testing.expect(!isLoaded());
}
