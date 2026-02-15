const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Version embedded at comptime via build options
    const version = "0.1.0";
    const options = b.addOptions();
    options.addOption([]const u8, "version", version);

    // Resolve zig-clap dependency
    const clap_dep = b.dependency("clap", .{
        .target = target,
        .optimize = optimize,
    });
    const clap_mod = clap_dep.module("clap");

    // Main executable
    const exe = b.addExecutable(.{
        .name = "ody",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "clap", .module = clap_mod },
                .{ .name = "build_options", .module = options.createModule() },
            },
        }),
    });
    b.installArtifact(exe);

    // Run step
    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }
    const run_step = b.step("run", "Run the ody CLI");
    run_step.dependOn(&run_cmd.step);

    // Unit tests
    const main_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "clap", .module = clap_mod },
                .{ .name = "build_options", .module = options.createModule() },
            },
        }),
    });
    const run_main_tests = b.addRunArtifact(main_tests);

    const test_step = b.step("test", "Run all unit tests");
    test_step.dependOn(&run_main_tests.step);

    // Cross-compilation convenience targets
    const cross_step = b.step("cross", "Build cross-compilation targets");
    const cross_targets: []const std.Target.Query = &.{
        .{ .cpu_arch = .x86_64, .os_tag = .linux },
        .{ .cpu_arch = .aarch64, .os_tag = .linux },
        .{ .cpu_arch = .x86_64, .os_tag = .macos },
        .{ .cpu_arch = .aarch64, .os_tag = .macos },
    };

    for (cross_targets) |ct| {
        const cross_exe = b.addExecutable(.{
            .name = "ody",
            .root_module = b.createModule(.{
                .root_source_file = b.path("src/main.zig"),
                .target = b.resolveTargetQuery(ct),
                .optimize = .ReleaseSafe,
                .imports = &.{
                    .{ .name = "clap", .module = clap_mod },
                    .{ .name = "build_options", .module = options.createModule() },
                },
            }),
        });
        const install_cross = b.addInstallArtifact(cross_exe, .{
            .dest_dir = .{
                .override = .{
                    .custom = b.fmt("{s}-{s}", .{
                        @tagName(ct.cpu_arch.?),
                        @tagName(ct.os_tag.?),
                    }),
                },
            },
        });
        cross_step.dependOn(&install_cross.step);
    }
}
