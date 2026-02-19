---
status: completed
created: 2026-02-18
started: 2026-02-18
completed: 2026-02-18
---
# Task: Add GitHub Auth Provider with Profile Support

## Description
Add GitHub as an authentication provider to the CLI, accepting a personal access token (API key). The implementation must follow the same "profiles" scheme used by the Jira integration, where non-sensitive config lives in the project config (`.ody/ody.json`) and sensitive credentials are stored in the global XDG-based auth store (`~/.local/share/ody/auth.json`) keyed by named profile.

## Background
The CLI currently supports Jira as its only external service integration with authentication. Jira uses a two-layer profiles architecture:

1. **Project config** (`.ody/ody.json`) stores non-sensitive settings like `baseUrl` and an optional `profile` name.
2. **Global auth store** (`~/.local/share/ody/auth.json`) stores sensitive credentials (`email`, `apiToken`) keyed by profile name (e.g., `"default"`, `"work"`).

The auth store schema in `packages/cli/src/lib/auth.ts` is designed to be extensible — new providers are added as new optional top-level keys alongside `jira`. The auth CLI command structure in `packages/cli/src/cmd/auth/index.ts` uses a `subCommands` map that supports adding new provider commands. The `ody auth list` command in `packages/cli/src/cmd/auth/list.ts` iterates provider-specific credential entries and needs to be extended for each new provider.

GitHub authentication uses personal access tokens (classic or fine-grained) passed as a `Bearer` token in the `Authorization` header for GitHub REST API v3 calls.

## Technical Requirements
1. Extend the `authStoreSchema` in `packages/cli/src/lib/auth.ts` to include a `github` key using `z.record(z.string(), githubCredentialsSchema).optional()`, where `githubCredentialsSchema` contains a single `token` field (string).
2. Export a `GitHubCredentials` type inferred from the new Zod schema.
3. Add `Auth.getGitHub(profile?: string)` and `Auth.setGitHub(profile: string, credentials: GitHubCredentials)` convenience methods to the `Auth` namespace, mirroring the existing `Auth.getJira` / `Auth.setJira` pattern.
4. Add a `github` optional object to the config schema in `packages/cli/src/lib/config.ts` with a `profile` field (optional string) that references the named credential profile, similar to the `jira` config schema.
5. Create an interactive CLI command `ody auth github` at `packages/cli/src/cmd/auth/github.ts` that accepts a `--profile` flag (default: `"default"`), prompts for the GitHub access token using `password()` (masked input), handles cancellation, and persists via `Auth.setGitHub()`.
6. Register the `github` subcommand in `packages/cli/src/cmd/auth/index.ts`.
7. Update `ody auth list` in `packages/cli/src/cmd/auth/list.ts` to display GitHub credential profiles alongside Jira profiles, showing the token masked in the same style (last 6 characters visible).
8. Determine the active GitHub profile using the same resolution as Jira: `githubConfig?.profile ?? 'default'`.

## Dependencies
- `packages/cli/src/lib/auth.ts` — Auth store schema, `Auth` namespace with load/save/get/set methods, XDG path resolution.
- `packages/cli/src/lib/config.ts` — Config schema definition (`configSchema`, `configSchemaWithDescriptions`), `Config` namespace.
- `packages/cli/src/cmd/auth/index.ts` — Parent `ody auth` command with `subCommands` map.
- `packages/cli/src/cmd/auth/list.ts` — `ody auth list` command that displays all provider credentials.
- `@clack/prompts` — Used for `password()`, `text()`, `log`, `isCancel`, `outro` in interactive CLI flows.
- `zod` — Schema validation for auth store and config.

## Implementation Approach
1. **Extend the auth store schema** in `packages/cli/src/lib/auth.ts`:
   - Define a `githubCredentialsSchema` with a `token: z.string()` field.
   - Add `github: z.record(z.string(), githubCredentialsSchema).optional()` to the `authStoreSchema`.
   - Export the `GitHubCredentials` type.
   - Add `Auth.getGitHub(profile = 'default')` that loads the store and returns `store.github?.[profile]`.
   - Add `Auth.setGitHub(profile, credentials)` that loads, merges, and saves using the same load-modify-save pattern as `setJira`.

2. **Extend the config schema** in `packages/cli/src/lib/config.ts`:
   - Define a `githubSchema` with `profile: z.string().optional()` and make the whole object optional.
   - Add the `github` field to both `configSchema` and `configSchemaWithDescriptions` with appropriate `.describe()` annotations.

3. **Create the `ody auth github` command** at `packages/cli/src/cmd/auth/github.ts`:
   - Use `defineCommand` from `citty` with `meta.name = 'github'` and a suitable description.
   - Define a `--profile` arg with type `string`, default `'default'`, and a description.
   - In the `run` handler, prompt for the token using `password()` from `@clack/prompts` with placeholder text and a validation function that rejects empty input.
   - Handle cancellation with `isCancel` and `outro`.
   - Call `Auth.setGitHub(profile, { token })` to persist.
   - Log a success message confirming the profile name that was saved.

4. **Register the new subcommand** in `packages/cli/src/cmd/auth/index.ts`:
   - Import the github command from `./github`.
   - Add `github` to the `subCommands` object.

5. **Update `ody auth list`** in `packages/cli/src/cmd/auth/list.ts`:
   - After the Jira credential listing section, add a GitHub section.
   - Load the project config to resolve the active GitHub profile (`githubConfig?.profile ?? 'default'`).
   - Iterate `store.github` entries, display the profile name, masked token (reuse the existing `maskToken` helper), and indicate the active profile.
   - Handle the case where no GitHub profiles exist by either skipping the section or showing a note.

## Acceptance Criteria

1. **Token storage via CLI**
   - Given a user runs `ody auth github`
   - When they enter a valid GitHub token at the prompt
   - Then the token is stored in `~/.local/share/ody/auth.json` under `github.default` with `0o600` permissions

2. **Named profile support**
   - Given a user runs `ody auth github --profile work`
   - When they enter a valid GitHub token
   - Then the token is stored under `github.work` in the auth store, without overwriting other profiles

3. **Credential retrieval**
   - Given GitHub credentials are stored for the `"default"` profile
   - When `Auth.getGitHub()` is called without arguments
   - Then it returns the credentials for the `"default"` profile

4. **Config profile resolution**
   - Given `.ody/ody.json` contains `"github": { "profile": "work" }`
   - When the system resolves which GitHub profile to use
   - Then it selects `"work"` instead of `"default"`

5. **Auth list display**
   - Given both Jira and GitHub credentials are stored
   - When a user runs `ody auth list`
   - Then both Jira and GitHub credentials are displayed with masked tokens and the active profile indicated

6. **Cancellation handling**
   - Given a user runs `ody auth github`
   - When they cancel the token prompt (Ctrl+C or Escape)
   - Then the command exits gracefully without saving and shows a cancellation message

## Metadata
- **Complexity**: Medium
- **Labels**: auth, github, profiles, cli-command, config
