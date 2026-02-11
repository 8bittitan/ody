---
status: completed
created: 2026-02-10
started: 2026-02-10
completed: 2026-02-10
---
# Task: Add --iterations Flag to Run Command

## Description
Add a `--iterations` flag (with alias `-i`) to the `run` command that allows the user to override the `maxIterations` config value at invocation time. This lets users control how many loop iterations the agent performs without modifying the persisted config in `.ody/ody.json`.

## Background
The `run` command currently reads `maxIterations` from the loaded config (`Config.get('maxIterations')`) to determine how many times the agent loop iterates. There is no way to override this value from the command line for a single run. Users who want to quickly test with a different iteration count must edit `.ody/ody.json` each time. A CLI flag provides a convenient, non-destructive override that takes precedence over the config file value when supplied.

## Technical Requirements
1. Add a new `--iterations` argument to the `run` command's `args` definition in `packages/cli/src/cmd/run.ts` using the `citty` `defineCommand` API.
2. The flag must accept a numeric value (type `string` parsed to integer, since `citty` args are strings) and have the alias `-i`.
3. When provided, the flag value must override `config.maxIterations` for the loop bound. When omitted, behaviour must remain unchanged (config value used as-is).
4. The flag value must be validated as a non-negative integer. Invalid values (negative numbers, non-numeric strings) should produce a clear error message and exit.
5. The flag should have no effect when `--once` is used, since `--once` bypasses the loop entirely.

## Dependencies
- `packages/cli/src/cmd/run.ts` — the run command where the arg is added and the loop is driven
- `packages/cli/src/lib/config.ts` — the config schema that defines `maxIterations` (no changes needed, but important context for understanding the default)
- `citty` — the CLI framework used for argument definitions (`defineCommand`, `args`)

## Implementation Approach
1. **Add the argument definition** — In `packages/cli/src/cmd/run.ts`, add an `iterations` entry to the `args` object with `type: 'string'`, `alias: 'i'`, `required: false`, and a description such as `"Override the number of loop iterations (0 for unlimited)"`.
2. **Parse and validate the flag** — Inside the `run` function, after loading config, check if `args.iterations` was provided. If so, parse it with `parseInt` and validate that the result is a non-negative integer. If validation fails, log an error via `log.error` and call `process.exit(1)`.
3. **Apply the override** — Replace the current `const maxIterations = config.maxIterations` with a resolution that prefers the CLI flag value when present: `const maxIterations = args.iterations !== undefined ? parsedValue : config.maxIterations`.
4. **Format and lint** — Run `bunx oxfmt -w packages/cli/src/cmd/run.ts` and `bunx oxlint packages/cli/src/cmd/run.ts` to ensure the change conforms to project standards.
5. **Build verification** — Run `bun run build` from the repo root to confirm the binary compiles cleanly with the new flag.

## Acceptance Criteria

1. **Flag is recognized by the CLI**
   - Given the CLI is built
   - When the user runs `ody run --iterations 5` or `ody run -i 5`
   - Then the agent loop runs for exactly 5 iterations (unless the completion marker is seen earlier)

2. **Flag overrides config value**
   - Given `maxIterations` is set to `10` in `.ody/ody.json`
   - When the user runs `ody run --iterations 3`
   - Then the loop runs for 3 iterations, not 10

3. **Unlimited iterations with zero**
   - Given any config value for `maxIterations`
   - When the user runs `ody run -i 0`
   - Then the loop runs indefinitely until the completion marker is detected

4. **Default behaviour preserved**
   - Given `maxIterations` is set to `10` in `.ody/ody.json`
   - When the user runs `ody run` without the `--iterations` flag
   - Then the loop runs for 10 iterations as before

5. **Invalid input rejected**
   - Given the CLI is built
   - When the user runs `ody run --iterations -1` or `ody run --iterations abc`
   - Then an error message is logged and the process exits with code 1

6. **No effect in once mode**
   - Given the CLI is built
   - When the user runs `ody run --once --iterations 5`
   - Then the `--iterations` flag is ignored and a single interactive run executes

## Metadata
- **Complexity**: Low
- **Labels**: cli, run-command, args, enhancement
