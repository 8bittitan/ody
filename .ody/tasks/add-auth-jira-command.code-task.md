---
status: completed
created: 2026-02-18
started: 2026-02-18
completed: 2026-02-18
---
# Task: Add Auth Jira Command

## Description
Add an `ody auth jira` command that interactively prompts the user for their Jira email and API token, then stores them as a named profile in the global auth store at `~/.local/share/ody/auth.json`. This provides a dedicated, user-friendly way to configure Jira credentials without manually editing JSON files. The command supports a `--profile` flag for managing multiple credential sets across different Jira instances or accounts.

## Background
The Ody CLI stores Jira credentials in a user-global auth file (`~/.local/share/ody/auth.json`) separate from project config to avoid accidentally committing secrets. The auth store supports named profiles (e.g., `"default"`, `"work"`, `"freelance"`) so that different projects can reference different credentials via the `jira.profile` setting in `.ody/ody.json`. Users need a CLI command to create and update these profiles rather than hand-editing the auth file. The command follows the nested subcommand pattern already used by `ody task list` and `ody task edit`, creating an extensible `ody auth` parent command that can later support other providers (GitHub, Linear, etc.).

## Technical Requirements
1. Create `packages/cli/src/cmd/auth/index.ts` exporting `authCmd` — a parent command with no `run()` of its own, only `subCommands` (matching the `cmd/task/index.ts` pattern)
2. Create `packages/cli/src/cmd/auth/jira.ts` exporting `jiraAuthCmd` — a leaf command that handles the interactive credential flow
3. Register the `auth` parent command in `packages/cli/src/index.ts` as a lazy-loaded subcommand: `auth: () => import('./cmd/auth').then((m) => m.authCmd)`
4. The `jira` subcommand must accept a `--profile` string argument that defaults to `"default"`
5. The command must prompt for two inputs using `@clack/prompts`:
   - Email address via `text()` — with validation that the value is non-empty
   - API token via `password()` — with masked input and non-empty validation
6. If the user cancels either prompt (presses Ctrl+C), the command must exit gracefully using `isCancel` and `outro`
7. After collecting inputs, the command must call `Auth.setJira(profile, { email, apiToken })` to persist the credentials
8. The command must display a success message showing the auth file path (via `Auth.resolveAuthPath()`) and the profile name
9. Use `log` from `@clack/prompts` for all messaging, `intro` for the opening banner, and `outro` for the closing message

## Dependencies
- `packages/cli/src/lib/auth.ts` — the `Auth` namespace for `setJira()` and `resolveAuthPath()` (must be implemented first)
- `@clack/prompts` (already a dependency) — for `text`, `password`, `intro`, `outro`, `log`, `isCancel`
- `citty` (already a dependency) — for `defineCommand`
- No new npm dependencies required

## Implementation Approach
1. **Create the parent command**: Create `packages/cli/src/cmd/auth/index.ts` with a `defineCommand` that has `meta` (name: `'auth'`, description: `'Manage authentication credentials'`) and `subCommands: { jira: () => import('./jira').then((m) => m.jiraAuthCmd) }`
2. **Create the jira subcommand**: Create `packages/cli/src/cmd/auth/jira.ts` with a `defineCommand` that defines a `--profile` string arg with default `'default'` and a `run` function
3. **Implement the interactive flow**: In the `run` function, display an intro message indicating which profile is being configured. Prompt for email with `text()` and validate non-empty. Prompt for API token with `password()` and validate non-empty. Check `isCancel` after each prompt and exit gracefully if cancelled
4. **Persist credentials**: Call `Auth.setJira(args.profile, { email, apiToken })` to save the credentials to the auth store
5. **Display confirmation**: Show a success message with `log.success` that includes the file path from `Auth.resolveAuthPath()` and the profile name. Call `outro` with a completion message
6. **Register in root command**: Add `auth: () => import('./cmd/auth').then((m) => m.authCmd)` to the `subCommands` in `packages/cli/src/index.ts`

## Acceptance Criteria

1. **Command is registered and callable**
   - Given the CLI is built
   - When the user runs `ody auth jira`
   - Then the command executes and prompts for email and API token

2. **Default profile created**
   - Given the user runs `ody auth jira` and enters valid credentials
   - When the prompts are completed
   - Then the credentials are saved under the `"default"` profile in `auth.json`

3. **Named profile created**
   - Given the user runs `ody auth jira --profile work` and enters valid credentials
   - When the prompts are completed
   - Then the credentials are saved under the `"work"` profile in `auth.json`

4. **Existing profile updated**
   - Given a `"default"` profile already exists in `auth.json`
   - When the user runs `ody auth jira` and enters new credentials
   - Then the `"default"` profile is overwritten with the new credentials

5. **Cancellation handled gracefully**
   - Given the user is prompted for their email
   - When the user presses Ctrl+C
   - Then the command exits with a cancellation message and no credentials are written

6. **Empty input rejected**
   - Given the user is prompted for their email or API token
   - When the user submits an empty value
   - Then a validation error is shown and the prompt is repeated

7. **Success message shows file path and profile**
   - Given the user completes the credential prompts
   - When credentials are saved
   - Then a success message displays the path to `auth.json` and the profile name used

8. **Auth parent command is extensible**
   - Given the `auth` parent command in `cmd/auth/index.ts`
   - When a new provider subcommand needs to be added later
   - Then it can be added as a new entry in the `subCommands` map without modifying the parent command logic

## Metadata
- **Complexity**: Medium
- **Labels**: cli, auth, jira, command, ux
