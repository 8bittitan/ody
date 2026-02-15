/// Prompt builder barrel module.
///
/// Re-exports all prompt builder sub-modules for convenient access.
/// Usage: `const builder = @import("builder/prompt.zig");`
pub const run_prompt = @import("run_prompt.zig");
pub const plan_prompt = @import("plan_prompt.zig");
pub const edit_plan_prompt = @import("edit_plan_prompt.zig");
pub const replace = @import("replace.zig");

// Pull in tests from all sub-modules.
comptime {
    _ = run_prompt;
    _ = plan_prompt;
    _ = edit_plan_prompt;
    _ = replace;
}
