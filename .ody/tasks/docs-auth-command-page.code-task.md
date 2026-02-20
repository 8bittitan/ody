---
status: completed
created: 2026-02-20
started: 2026-02-20
completed: 2026-02-20
---
# Task: Add Auth Command Documentation Page

## Description
Add a documentation page for the `ody auth` command and its subcommands (`github`, `jira`, `list`) to the docs website. The auth command manages authentication credentials for third-party integrations and currently has no documentation on the site.

## Background
The `ody auth` command is a parent command with three subcommands:
- `ody auth github` -- Stores a GitHub personal access token under a named profile.
- `ody auth jira` -- Stores Jira credentials (email + API token) under a named profile.
- `ody auth list` -- Displays all stored credentials with masked tokens, showing which profiles are active.

Credentials are persisted to `$XDG_DATA_HOME/ody/auth.json` (typically `~/.local/share/ody/auth.json`) with `0600` file permissions. Both `github` and `jira` subcommands accept a `--profile` flag (default `"default"`) for managing multiple credential sets.

The docs site uses Next.js with Fumadocs and MDX content files. Existing command pages follow a consistent structure: frontmatter, synopsis, flags/arguments table, behavior description, examples, and related links. Navigation is controlled by `meta.json` files in the content directories.

## Technical Requirements
1. Create `packages/docs/content/docs/commands/auth/` directory with MDX files for the parent command and each subcommand
2. Create a `meta.json` inside `auth/` to define subcommand page ordering
3. Add `"auth"` to the pages array in `packages/docs/content/docs/commands/meta.json` so the auth section appears in the sidebar
4. Follow the exact documentation style used by existing command pages (frontmatter with `title` and `description`, synopsis code block, flags table, behavior section, examples, related links)
5. Document the credential storage location and file permissions in the behavior section

## Dependencies
- Existing docs framework at `packages/docs/` (Next.js + Fumadocs + MDX)
- Auth command implementation in `packages/cli/src/cmd/auth/` (index, github, jira, list)
- Auth storage layer in `packages/cli/src/lib/auth.ts`
- Existing `meta.json` navigation config at `packages/docs/content/docs/commands/meta.json`

## Implementation Approach
1. **Create the auth directory** -- Add `packages/docs/content/docs/commands/auth/` to hold the auth command docs, mirroring how `task/` is structured for subcommands.
2. **Create `auth/meta.json`** -- Define the page order: `["index", "github", "jira", "list"]` with `"title": "auth"` to match the `task/` convention.
3. **Create `auth/index.mdx`** -- Write the parent command overview page. Include frontmatter (`title: ody auth`, `description: Manage authentication credentials`), a synopsis showing `ody auth <subcommand>`, a table listing available subcommands with descriptions, a brief behavior section explaining the credential storage model (XDG base directory, JSON file, `0600` permissions, named profiles), and links to each subcommand page.
4. **Create `auth/github.mdx`** -- Document the GitHub auth subcommand. Include synopsis (`ody auth github [--profile <name>]`), a flags table for `--profile`, behavior section describing the interactive PAT prompt and storage, examples for default and named profiles, and related links to `ody auth list` and `ody auth jira`.
5. **Create `auth/jira.mdx`** -- Document the Jira auth subcommand. Include synopsis (`ody auth jira [--profile <name>]`), a flags table for `--profile`, behavior section describing the interactive email and API token prompts, examples for default and named profiles, and related links.
6. **Create `auth/list.mdx`** -- Document the list subcommand. Include synopsis (`ody auth list`), note that it has no flags, behavior section explaining how it displays all stored profiles with masked credentials and active-profile indicators, an example showing sample output, and related links.
7. **Update `commands/meta.json`** -- Add `"auth"` to the pages array (insert it alphabetically after `"index"` or logically after `"config"`) so the auth section appears in the sidebar navigation.

## Acceptance Criteria

1. **Auth section appears in sidebar**
   - Given the docs site is running
   - When a user views the commands section in the sidebar
   - Then an "auth" entry is visible with expandable subcommand links (github, jira, list)

2. **Parent auth page renders correctly**
   - Given a user navigates to `/docs/commands/auth`
   - When the page loads
   - Then it displays a synopsis, subcommand list, and credential storage overview

3. **Subcommand pages follow existing conventions**
   - Given a user views any auth subcommand page (github, jira, or list)
   - When they compare it to existing command docs (e.g., `ody init`, `ody config`)
   - Then the structure matches: frontmatter, synopsis, flags table (where applicable), behavior, examples, and related links

4. **Profile flag is documented**
   - Given a user reads the `ody auth github` or `ody auth jira` page
   - When they look at the flags table
   - Then they see `--profile` with alias `-p`, type `string`, default `"default"`, and a clear description

5. **Credential storage is explained**
   - Given a user reads any auth documentation page
   - When they look for where credentials are stored
   - Then they find the XDG data home path, the `auth.json` filename, and the `0600` permission details

## Metadata
- **Complexity**: Medium
- **Labels**: docs, auth, commands, documentation
