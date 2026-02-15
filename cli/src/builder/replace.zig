/// Shared placeholder replacement utility for prompt builders.
///
/// Provides a simple find-and-replace function that allocates a new
/// string with the first occurrence of a placeholder substituted.
const std = @import("std");

/// Replace the first occurrence of `placeholder` in `template` with
/// `value`. Returns a newly allocated slice. If `placeholder` is not
/// found, returns a duplicate of `template`.
///
/// The caller owns the returned slice and must free it via `allocator`.
pub fn replacePlaceholder(
    allocator: std.mem.Allocator,
    template: []const u8,
    placeholder: []const u8,
    value: []const u8,
) ![]const u8 {
    const idx = std.mem.indexOf(u8, template, placeholder) orelse {
        return try allocator.dupe(u8, template);
    };

    const new_len = template.len - placeholder.len + value.len;
    const buf = try allocator.alloc(u8, new_len);

    // Copy: [prefix][value][suffix]
    @memcpy(buf[0..idx], template[0..idx]);
    @memcpy(buf[idx..][0..value.len], value);
    const suffix_start = idx + placeholder.len;
    const suffix_len = template.len - suffix_start;
    @memcpy(buf[idx + value.len ..][0..suffix_len], template[suffix_start..]);

    return buf;
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test "replacePlaceholder basic substitution" {
    const allocator = std.testing.allocator;
    const result = try replacePlaceholder(allocator, "Hello {NAME}!", "{NAME}", "World");
    defer allocator.free(result);
    try std.testing.expectEqualStrings("Hello World!", result);
}

test "replacePlaceholder no match returns duplicate" {
    const allocator = std.testing.allocator;
    const result = try replacePlaceholder(allocator, "no placeholder here", "{MISSING}", "value");
    defer allocator.free(result);
    try std.testing.expectEqualStrings("no placeholder here", result);
}

test "replacePlaceholder replaces only first occurrence" {
    const allocator = std.testing.allocator;
    const result = try replacePlaceholder(allocator, "{X} and {X}", "{X}", "A");
    defer allocator.free(result);
    try std.testing.expectEqualStrings("A and {X}", result);
}

test "replacePlaceholder empty value" {
    const allocator = std.testing.allocator;
    const result = try replacePlaceholder(allocator, "before{EMPTY}after", "{EMPTY}", "");
    defer allocator.free(result);
    try std.testing.expectEqualStrings("beforeafter", result);
}

test "replacePlaceholder value longer than placeholder" {
    const allocator = std.testing.allocator;
    const result = try replacePlaceholder(allocator, "{A}", "{A}", "much longer replacement");
    defer allocator.free(result);
    try std.testing.expectEqualStrings("much longer replacement", result);
}
