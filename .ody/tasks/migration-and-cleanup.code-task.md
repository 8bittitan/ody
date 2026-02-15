---
status: skip
created: 2026-02-13
started: null
completed: null
---
# Task: Migration and Final Cleanup

## Description
Perform the final migration from the TypeScript/Bun implementation to the Zig rewrite by verifying full feature parity, removing the old TypeScript codebase, reorganizing the directory structure, and updating all documentation.

## Background
During the rewrite, both `packages/cli` (TypeScript) and `cli/` (Zig) coexist. Once the Zig version has full feature parity and has been verified, the TypeScript version should be removed. The Zig `cli/` directory should be moved to replace `packages/cli`, and all documentation (README.md, AGENTS.md) should be updated to reflect Zig build instructions and the new project structure.

## Technical Requirements
### Parity Verification
1. Manually verify every command and flag combination:
   - `ody init` (all flags: -b, -i, -m, -c, -a, -n, --dry-run, interactive mode)
   - `ody run` (loop mode, --once, --dry-run, --verbose, --label, --iterations, --no-notify, taskFile positional)
   - `ody config` (display output)
   - `ody plan new` (--dry-run, --verbose, interactive loop)
   - `ody plan edit` (--dry-run, --verbose, task selection)
   - `ody plan list` (--status flag with all statuses)
   - `ody plan compact` (archive generation, file deletion)
2. Verify all edge cases: missing config, empty task dir, no available backends, cancellation
3. Verify notification delivery on macOS and Linux

### Cleanup
1. Remove `packages/cli/` directory (TypeScript implementation)
2. Remove `node_modules/` and `bun.lock` if no other packages remain
3. Move `cli/` to replace the removed `packages/cli` (or promote to top-level)
4. Update root `package.json` workspace configuration (or remove if no longer needed)
5. Update `README.md` with Zig build/install instructions
6. Update `AGENTS.md` (if not already done in CI task)
7. Remove or update root `tsconfig.json`, `.oxfmtrc.json`, `.oxlintrc.json` if no longer applicable
8. Clean up any other TypeScript-specific configuration files

## Dependencies
- All previous phases (1-9) must be completed
- Full test suite must be passing
- CI pipeline must be green

## Implementation Approach
1. **Parity testing**: Create a checklist of every command + flag combination
2. Run each combination with the Zig binary and compare behavior to the TypeScript version
3. Document any intentional behavioral differences
4. **Cleanup phase**:
   - `rm -rf packages/cli`
   - `rm -rf node_modules bun.lock`
   - Move `cli/` to the appropriate location
   - Update workspace configuration
5. **Documentation update**:
   - Rewrite README.md install section: `zig build -Doptimize=ReleaseSafe` instead of `bun install && bun run build`
   - Update any references to Bun/TypeScript in documentation
6. **Final verification**: Build from clean checkout, run tests, verify binary works

## Acceptance Criteria

1. **Full Command Parity**
   - Given the Zig binary
   - When testing every command and flag combination
   - Then behavior matches the TypeScript version (or documented differences exist)

2. **TypeScript Code Removed**
   - Given the cleanup is complete
   - When listing repository contents
   - Then no TypeScript source files, `node_modules/`, or `bun.lock` remain

3. **Build from Clean Checkout**
   - Given a fresh clone of the repository
   - When following the README build instructions
   - Then the Zig binary compiles and all tests pass

4. **Documentation Updated**
   - Given the README.md and AGENTS.md
   - When reading them
   - Then they accurately describe the Zig-based project

5. **CI Pipeline Green**
   - Given the final state of the repository
   - When CI runs
   - Then lint, test, and build jobs all pass

## Metadata
- **Complexity**: Medium
- **Labels**: zig-rewrite, phase-10, migration, cleanup
