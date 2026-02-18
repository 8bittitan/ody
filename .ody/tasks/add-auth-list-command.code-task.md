---
status: completed
created: 2026-02-18
started: 2026-02-18
completed: 2026-02-18
---
# Task: Add Auth List Command

## Description
Add an `ody auth list` subcommand that displays all configured authentication credentials in a single unified view. The command merges global auth store entries (from `~/.local/share/ody/auth.json`) with the local project config's provider settings (e.g., the Jira `baseUrl` and `profile` from `.ody/ody.json`) so users can see at a glance which providers are configured and which credentials are active. API keys and tokens must be truncated for security: display exactly 12 characters where the first 6 are masked (e.g., `******`) and the last 6 show the actual tail of the key/token.

## Background
The CLI currently supports `ody auth jira` to interactively set Jira credentials, but there is no way to review what credentials are already stored or which profile is active for the current project. Users need a read-only listing command to verify their auth configuration without opening raw JSON files. The auth store lives globally in `$XDG_DATA_HOME/ody/auth.json` while provider-specific settings (like Jira's `baseUrl` and `profile`) live in the project-local `.ody/ody.json`. The list command must combine both sources into a single coherent output.

## Technical Requirements
1. Register a new `list` subcommand under `ody auth` in `packages/cli/src/cmd/auth/index.ts`
2. Create the command implementation in `packages/cli/src/cmd/auth/list.ts` using `defineCommand` from `citty`
3. Load credentials from the global auth store via `Auth.load()` (from `packages/cli/src/lib/auth.ts`)
4. Attempt to load local project config to merge provider-specific settings (e.g., Jira `baseUrl`, active `profile`); gracefully handle missing config since `auth` is a skippable command
5. For each provider (currently Jira), display: provider name, profile name, associated email or identifier, the truncated API key/token, and any local config values (e.g., `baseUrl`)
6. Truncation rule: always show exactly 12 characters total — `******` (6 masked characters) followed by the last 6 characters of the actual key/token. If the key/token is shorter than 6 characters, show the entire key masked with `******`
7. Use `@clack/prompts` (`intro`, `log`, `outro`) for output formatting, consistent with other CLI commands
8. If no credentials are found, display an informative message directing the user to `ody auth jira`

## Dependencies
- `packages/cli/src/lib/auth.ts` — `Auth` namespace for loading the global auth store
- `packages/cli/src/lib/config.ts` — `Config` namespace for reading local project config (Jira `baseUrl`, `profile`)
- `packages/cli/src/cmd/auth/index.ts` — parent auth command where the new subcommand must be registered
- `@clack/prompts` — for CLI output formatting
- `citty` — for command definition

## Implementation Approach
1. **Create the command file** at `packages/cli/src/cmd/auth/list.ts`:
   - Define `listAuthCmd` using `defineCommand` with `meta.name = 'list'` and `meta.description = 'List configured authentication credentials'`
   - No arguments are required for this command
2. **Implement a `maskToken` utility** within the command file (or as a small helper):
   - Accept a string (API key/token)
   - If the string length is 6 or fewer characters, return `******`
   - Otherwise, return `******` + the last 6 characters of the string (always 12 characters total)
3. **Load auth data in the `run` handler**:
   - Call `Auth.load()` to get the global `AuthStore`
   - Attempt to load local config by calling `Config.load()` wrapped in a try/catch (since config may not exist and `auth` is a skippable command), then read `Config.get('jira')` for local Jira settings
4. **Build the merged output for Jira**:
   - Iterate over all profiles in `store.jira` (the global auth store's Jira record)
   - For each profile, display the profile name, the email, the masked `apiToken`, and whether it's the active profile for this project (if local config's `jira.profile` matches or defaults to `"default"`)
   - If local config provides a `baseUrl`, include it in the output for the active profile
5. **Format and display**:
   - Use `intro('Authentication credentials')` at the top
   - Use `log.info` and `log.message` to output each provider section with its profiles
   - If no credentials exist at all, use `log.warn` with a hint to run `ody auth jira`
   - End with `outro('Done')`
6. **Register the subcommand** in `packages/cli/src/cmd/auth/index.ts`:
   - Add `list: () => import('./list').then((m) => m.listAuthCmd)` to the `subCommands` object

## Acceptance Criteria

1. **Lists Jira credentials from global auth store**
   - Given the user has Jira credentials stored in the global auth store under the "default" profile
   - When the user runs `ody auth list`
   - Then the output displays the Jira provider section with profile name "default", the email address, and the truncated API token showing `******` followed by the last 6 characters

2. **Handles multiple profiles**
   - Given the user has multiple Jira profiles stored (e.g., "default" and "work")
   - When the user runs `ody auth list`
   - Then all profiles are listed with their respective credentials, each token properly truncated

3. **Merges local config settings**
   - Given the project has `.ody/ody.json` with `jira.baseUrl` and optionally `jira.profile`
   - When the user runs `ody auth list`
   - Then the active profile is indicated and the Jira `baseUrl` from local config is shown alongside it

4. **Masks short tokens correctly**
   - Given a credential with an API token shorter than 6 characters
   - When the user runs `ody auth list`
   - Then the token is displayed as `******` (fully masked)

5. **Shows helpful message when no credentials exist**
   - Given no credentials are stored in the global auth store
   - When the user runs `ody auth list`
   - Then a message is displayed indicating no credentials are configured and suggesting `ody auth jira` to set them up

6. **Works without project config**
   - Given the user runs `ody auth list` from a directory without `.ody/ody.json`
   - When the command executes
   - Then global credentials are still listed without errors (local config enrichment is simply skipped)

## Metadata
- **Complexity**: Low
- **Labels**: cli, auth, command
