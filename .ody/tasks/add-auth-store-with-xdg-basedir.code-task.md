---
status: completed
created: 2026-02-18
started: 2026-02-18
completed: 2026-02-18
---
# Task: Add Auth Store With XDG Base Directory Support

## Description
Create a credential storage module at `packages/cli/src/lib/auth.ts` that reads and writes an `auth.json` file under the XDG data directory. This keeps sensitive credentials (API tokens, emails) out of project-level config files and in a user-global location that will never be accidentally committed to git. The module uses the `xdg-basedir` npm package to resolve `$XDG_DATA_HOME`, with a fallback to `~/.local/share` when the environment variable is unset (e.g., on macOS).

## Background
The Ody CLI needs to store authentication credentials for external services like Jira. Currently all configuration lives in `.ody/ody.json` inside the project tree. Storing secrets there risks accidental git commits and makes it impossible to share credentials across projects. The XDG Base Directory specification provides a standard location for user-specific data files (`$XDG_DATA_HOME`, defaulting to `~/.local/share`). By storing credentials at `~/.local/share/ody/auth.json` (or `$XDG_DATA_HOME/ody/auth.json`), we get a secure, user-global credential store. The auth store supports named profiles so users can maintain different credentials per project (e.g., `"default"`, `"work"`, `"freelance"`), with the project config referencing a profile by name.

## Technical Requirements
1. Install `xdg-basedir` as a dependency in `packages/cli/package.json`
2. Create `packages/cli/src/lib/auth.ts` exporting an `Auth` namespace (matching the `Config` and `Installation` namespace patterns)
3. Define a Zod schema for the auth store: `{ jira?: Record<string, { email: string, apiToken: string }> }` where the record keys are profile names
4. Export `AuthStore` and `JiraCredentials` types inferred from the Zod schema
5. Implement `Auth.resolveAuthPath()` — returns the path to `auth.json` using `xdgData` from `xdg-basedir`, falling back to `path.join(os.homedir(), '.local', 'share')` when `xdgData` is `undefined`
6. Implement `Auth.load()` — reads and parses `auth.json` with Zod validation, returns `{}` if the file does not exist
7. Implement `Auth.save(store)` — creates the directory with `mkdir -p` and writes `auth.json` with file mode `0o600` (owner-only read/write)
8. Implement `Auth.getJira(profile?)` — convenience method that loads the store and returns the credentials for the given profile (defaults to `"default"`), or `undefined` if not found
9. Implement `Auth.setJira(profile, credentials)` — convenience method that loads the store, sets the profile entry, and saves
10. Use `Bun.file()` for reading and `Bun.write()` for writing, following project conventions

## Dependencies
- `xdg-basedir` — new npm dependency for resolving `$XDG_DATA_HOME`
- `zod` (already a dependency) — for schema validation
- `node:path` and `node:os` — for path resolution and home directory fallback
- `node:fs/promises` — for `mkdir`
- `Bun.file()` and `Bun.write()` — for file I/O per project conventions

## Implementation Approach
1. **Install `xdg-basedir`**: Run `bun add xdg-basedir` from the `packages/cli` directory to add it as a dependency
2. **Create `packages/cli/src/lib/auth.ts`**: Define the Zod schema for the auth store using `z.object` with an optional `jira` field that is a `z.record(z.string(), jiraCredentialsSchema)` to model named profiles
3. **Implement path resolution**: Create a private `resolveDataDir()` function that returns `xdgData ?? path.join(os.homedir(), '.local', 'share')`, then `resolveAuthDir()` that appends `'ody'`, and a public `resolveAuthPath()` that appends `'auth.json'`
4. **Implement `load()`**: Use `Bun.file(authPath)` to check existence and read JSON. If the file does not exist, return an empty object `{}`. Parse through the Zod schema for validation
5. **Implement `save(store)`**: Use `mkdir` with `{ recursive: true }` to ensure the directory exists, then `Bun.write()` with `JSON.stringify(store, null, 2)` and mode `0o600`
6. **Implement convenience methods**: `getJira(profile)` calls `load()` and returns `store.jira?.[profile]`. `setJira(profile, credentials)` calls `load()`, sets `store.jira[profile]`, and calls `save(store)`
7. **Export types**: Export `AuthStore` and `JiraCredentials` as type aliases inferred from the Zod schemas for use by other modules

## Acceptance Criteria

1. **xdg-basedir is installed**
   - Given the `packages/cli` directory
   - When `bun install` is run
   - Then `xdg-basedir` is listed in `package.json` dependencies and installed in `node_modules`

2. **Auth path resolves correctly on Linux with XDG_DATA_HOME set**
   - Given `$XDG_DATA_HOME` is set to `/custom/data`
   - When `Auth.resolveAuthPath()` is called
   - Then it returns `/custom/data/ody/auth.json`

3. **Auth path falls back when XDG_DATA_HOME is unset**
   - Given `$XDG_DATA_HOME` is not set (e.g., macOS)
   - When `Auth.resolveAuthPath()` is called
   - Then it returns `~/.local/share/ody/auth.json`

4. **Load returns empty object when no auth file exists**
   - Given `auth.json` does not exist at the resolved path
   - When `Auth.load()` is called
   - Then it returns `{}`

5. **Save creates directory and writes with correct permissions**
   - Given the auth directory does not yet exist
   - When `Auth.save(store)` is called
   - Then the directory is created recursively and `auth.json` is written with mode `0o600`

6. **Named profiles are stored and retrieved correctly**
   - Given `Auth.setJira('work', { email: 'a@b.com', apiToken: 'tok' })` is called
   - When `Auth.getJira('work')` is called
   - Then it returns `{ email: 'a@b.com', apiToken: 'tok' }`

7. **Default profile is used when no profile specified**
   - Given credentials are stored under the `"default"` profile
   - When `Auth.getJira()` is called with no arguments
   - Then it returns the `"default"` profile credentials

8. **Multiple profiles coexist without overwriting**
   - Given `Auth.setJira('default', creds1)` and `Auth.setJira('work', creds2)` are called
   - When `Auth.load()` is called
   - Then both profiles exist in `store.jira` with their respective credentials

## Metadata
- **Complexity**: Medium
- **Labels**: cli, auth, xdg, infrastructure
