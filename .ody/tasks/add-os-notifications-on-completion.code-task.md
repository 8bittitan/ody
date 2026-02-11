---
status: completed
created: 2026-02-10
started: 2026-02-10
completed: 2026-02-10
---
# Task: Add OS Notifications on Agent Loop Completion

## Description
Add cross-platform OS notification support to the `ody run` command so users are alerted when an agent loop finishes. Long-running agent loops can take significant time, and users may context-switch away from the terminal. A native OS notification brings their attention back when work is done. The feature should be configurable via `.ody/ody.json` and overridable via a CLI flag.

## Background
The `ody run` command executes an agent loop that spawns backend processes iteratively until a `<woof>COMPLETE</woof>` marker is detected or the max iteration count is reached. Currently, completion is only signaled via terminal output (`outro('Agent loop complete')` and spinner messages). There is no mechanism to notify the user outside the terminal. The CLI runs on Bun, which provides a `$` shell helper from `bun` that handles argument escaping via template literal interpolation. macOS supports notifications via `osascript` and Linux supports them via `notify-send`, both callable as shell commands.

## Technical Requirements
1. Create a new module `packages/cli/src/lib/notify.ts` exporting an async `sendNotification(title: string, message: string)` function
2. Use Bun's `$` shell helper (from `bun`) to invoke `osascript` on macOS (`process.platform === 'darwin'`) and `notify-send` on Linux (`process.platform === 'linux'`)
3. The function must be fire-and-forget — wrap in try/catch and silently swallow errors so a missing `notify-send` or failed `osascript` never crashes the CLI
4. Add a `notify` field to the Zod config schema in `packages/cli/src/lib/config.ts` accepting `boolean | 'all' | 'individual'`, defaulting to `false`, and optional
5. Config values: `false` disables notifications; `true` is an alias for `'all'`; `'all'` notifies when the entire run loop finishes; `'individual'` notifies after each iteration completes
6. Add a `--no-notify` boolean flag to the `run` command args that overrides the config value to `false` when set
7. In the `run` command loop mode: send a notification after each iteration if notify is `'individual'`; send a notification after the loop exits if notify is `'all'`
8. In the `run` command single-shot mode (`--once`): send a notification on completion if notify is `'all'` or `'individual'`
9. Only send notifications on successful completion (not on errors)
10. Add a prompt to the `ody init` wizard for configuring the `notify` setting, placed after the existing prompts and before the config is saved
11. Add a `--notify` string arg to the `init` command for non-interactive configuration

## Dependencies
- `packages/cli/src/lib/config.ts` — Zod config schema and `Config` namespace; add `notify` field
- `packages/cli/src/cmd/run.ts` — Agent loop and single-shot execution; integrate notification calls
- `packages/cli/src/cmd/init.ts` — Init wizard; add notify prompt and CLI arg
- Bun's `$` shell helper from `bun` — used for executing shell notification commands
- `osascript` (macOS system binary) — for macOS notifications
- `notify-send` (Linux `libnotify` package) — for Linux notifications

## Implementation Approach
1. **Create `packages/cli/src/lib/notify.ts`** — Export `sendNotification(title: string, message: string): Promise<void>`. Use `process.platform` to branch: on `'darwin'`, run `await $\`osascript -e ${...}\``; on `'linux'`, run `await $\`notify-send ${title} ${message}\``. Wrap the entire body in try/catch with an empty catch block. Import `$` from `bun`.
2. **Update config schema in `packages/cli/src/lib/config.ts`** — Add `notify: z.union([z.boolean(), z.enum(['all', 'individual'])]).default(false).optional()` to the `configSchema` object.
3. **Update `packages/cli/src/cmd/run.ts`** — Import `sendNotification` from `../lib/notify`. Add a `'no-notify'` boolean arg (default `false`). At the start of the `run` function, resolve the effective notify setting: if `args['no-notify']` is true, use `false`; otherwise read `Config.get('notify')` and normalize `true` to `'all'`. In the loop body after `await proc.exited`, if notify is `'individual'` and the iteration completed without error, call `await sendNotification('ody', 'Iteration N complete')`. After the loop's `outro` call, if notify is `'all'`, call `await sendNotification('ody', 'Agent loop complete')`. In single-shot mode, before `outro('Finished')`, if notify is `'all'` or `'individual'`, call `await sendNotification('ody', 'Finished')`.
4. **Update `packages/cli/src/cmd/init.ts`** — Add a `notify` string arg (required false). After the `skipPermissions` prompt block and before building `configToSave`, add a `select` prompt asking the user to choose a notification preference with options mapping to `false`, `'all'`, and `'individual'`. If the `--notify` arg was provided, skip the prompt and use the arg value. Assign the result to `configInput.notify`.
5. **Verify** — Run `bun run build` from the project root to confirm the build succeeds. Run `bun lint` and `bun fmt` to ensure code passes lint and formatting checks.

## Acceptance Criteria

1. **macOS notification fires**
   - Given the user is on macOS and `notify` is set to `'all'` in config
   - When the agent loop completes successfully
   - Then a native macOS notification appears with title "ody" and message "Agent loop complete"

2. **Linux notification fires**
   - Given the user is on Linux with `notify-send` installed and `notify` is set to `'all'` in config
   - When the agent loop completes successfully
   - Then a desktop notification appears with title "ody" and message "Agent loop complete"

3. **Individual mode notifies per iteration**
   - Given `notify` is set to `'individual'` in config
   - When an iteration of the agent loop completes
   - Then a notification is sent with the iteration number

4. **Boolean true treated as 'all'**
   - Given `notify` is set to `true` in `.ody/ody.json`
   - When the agent loop completes
   - Then the behavior is identical to `notify: 'all'`

5. **Disabled by default**
   - Given no `notify` field in `.ody/ody.json`
   - When the agent loop completes
   - Then no notification is sent

6. **--no-notify overrides config**
   - Given `notify` is set to `'all'` in config
   - When the user runs `ody run --no-notify`
   - Then no notification is sent

7. **Single-shot mode notifies**
   - Given `notify` is `'all'` or `'individual'`
   - When `ody run --once` completes successfully
   - Then a notification is sent

8. **Notification failure is silent**
   - Given `osascript` or `notify-send` is not available or fails
   - When a notification is attempted
   - Then no error is logged and the CLI continues normally

9. **Init wizard prompts for notify**
   - Given the user runs `ody init`
   - When they reach the notification prompt
   - Then they can select between disabled, all, or individual

10. **Build succeeds**
    - Given all changes are applied
    - When `bun run build` is executed
    - Then the build completes without errors

## Metadata
- **Complexity**: Medium
- **Labels**: cli, config, notifications, run
