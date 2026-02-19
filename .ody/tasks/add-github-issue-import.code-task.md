---
status: completed
created: 2026-02-18
started: 2026-02-18
completed: 2026-02-18
---
# Task: Add GitHub Issue Import to Task Import Command

## Description
Extend the `ody task import` command to support importing GitHub issues as code tasks, alongside the existing Jira integration. Users should be able to pass a `--github` / `-gh` flag with a GitHub issue URL or `owner/repo#number` shorthand. The command fetches the issue via the GitHub REST API (authenticated using the GitHub auth provider profile), formats the issue data, and feeds it through the existing agent-based task generation pipeline to produce a `.code-task.md` file.

## Background
The CLI already has a mature Jira import pipeline in `packages/cli/src/cmd/task/import.ts` that follows this flow: parse input → resolve auth credentials → fetch ticket via REST API → format as structured text → build an import prompt → spawn an agent to generate the `.code-task.md` file. The GitHub import should mirror this architecture exactly.

The auth infrastructure is being extended to support GitHub (see the pending `add-github-auth-provider` task) with `Auth.getGitHub(profile)` / `Auth.setGitHub(profile, credentials)` storing a personal access token in the XDG auth store. The config schema will include an optional `github` object with a `profile` field for selecting the credential profile. This task depends on that auth provider being in place, or can be developed in parallel by referencing the expected interface.

GitHub's REST API v3 exposes issues at `GET /repos/{owner}/{repo}/issues/{issue_number}` and returns fields like `title`, `body`, `state`, `labels`, `assignees`, `milestone`, and `comments_url`. Authentication uses a `Bearer` token in the `Authorization` header.

## Technical Requirements
1. Create a `packages/cli/src/lib/github.ts` module exporting a `GitHub` namespace with:
   - A `GitHubIssue` type containing: `number`, `title`, `body`, `state`, `labels` (string array), `assignees` (string array), `milestone` (string or null), `comments` (string array).
   - `GitHub.parseInput(input: string)` that accepts either a full GitHub issue URL (`https://github.com/owner/repo/issues/123`) or a shorthand (`owner/repo#123`) and returns `{ owner: string; repo: string; issueNumber: number }`.
   - `GitHub.fetchIssue(owner, repo, issueNumber, token?)` that calls the GitHub REST API to fetch the issue and its comments (separate `GET /repos/{owner}/{repo}/issues/{issue_number}/comments` call), returning a `GitHubIssue`.
   - `GitHub.formatAsDescription(issue: GitHubIssue)` that formats the issue into a structured multi-line text block mirroring the Jira formatter's style (key fields on labeled lines, then description, then comments).
2. Add a `--github` / `-gh` flag (type `string`, required: false) to the import command args in `packages/cli/src/cmd/task/import.ts`.
3. Make `--jira` and `--github` mutually exclusive (exactly one must be provided). If neither or both are supplied, log an error and exit.
4. When `--github` is provided, the run handler should: parse the input via `GitHub.parseInput`, resolve the GitHub credential profile from config (`Config.get('github')?.profile ?? 'default'`), load the token via `Auth.getGitHub(profile)`, fetch the issue via `GitHub.fetchIssue`, format via `GitHub.formatAsDescription`, build an import prompt via a new `buildGitHubImportPrompt` (or extend the existing one), and spawn the agent identically to the Jira flow.
5. Create or extend the import prompt builder in `packages/cli/src/builders/importPrompt.ts` to handle GitHub issue data. The prompt should instruct the agent to map GitHub issue fields (title, body, labels, comments) to the task file sections, include the issue reference (e.g., `owner/repo#123`) in the Labels metadata field, and follow the same task file format.
6. Handle GitHub API errors with clear user-facing messages: 401 (suggest `ody auth github`), 403 (rate limit or permissions), 404 (issue not found), and generic failures.
7. Support public repositories without authentication (token is optional) — if no GitHub auth is configured and the request fails with 401/403, suggest running `ody auth github`.

## Dependencies
- `packages/cli/src/lib/auth.ts` — `Auth.getGitHub(profile)` method and `GitHubCredentials` type (from the `add-github-auth-provider` task). Expected interface: `Auth.getGitHub(profile?: string): Promise<GitHubCredentials | undefined>` where `GitHubCredentials = { token: string }`.
- `packages/cli/src/lib/config.ts` — Optional `github` config key with `profile` field (from the `add-github-auth-provider` task). Expected: `Config.get('github')` returns `{ profile?: string } | undefined`.
- `packages/cli/src/cmd/task/import.ts` — Existing import command to extend with the `--github` flag.
- `packages/cli/src/builders/importPrompt.ts` — Import prompt builder to extend or duplicate for GitHub issues.
- `packages/cli/src/builders/shared.ts` — `TASK_FILE_FORMAT` constant used in prompt construction.
- `packages/cli/src/lib/jira.ts` — Reference implementation for the API client pattern (parse → fetch → format).
- `packages/cli/src/util/stream.ts` — `Stream.toOutput` for agent process output streaming.
- `packages/cli/src/backends/backend.ts` — `Backend` class for spawning the agent process.
- GitHub REST API v3 (`https://api.github.com`) — External dependency for issue fetching.

## Implementation Approach
1. **Create the GitHub API client** at `packages/cli/src/lib/github.ts`:
   - Define the `GitHubIssue` and `ParsedIssueInput` types.
   - Implement `GitHub.parseInput(input)` with a regex for full URLs (`https://github.com/{owner}/{repo}/issues/{number}`) and shorthand (`{owner}/{repo}#{number}`). Validate that the issue number is a positive integer and that owner/repo are non-empty.
   - Implement `GitHub.fetchIssue(owner, repo, issueNumber, token?)` using `fetch()` against `https://api.github.com/repos/{owner}/{repo}/issues/{issueNumber}`. Set `Accept: application/vnd.github.v3+json` and optionally `Authorization: Bearer {token}`. After fetching the issue, also fetch comments from the `comments_url` in the response (or construct it). Map the response JSON to `GitHubIssue`, extracting label names, assignee logins, milestone title, and comment bodies with authors.
   - Implement `GitHub.formatAsDescription(issue)` producing labeled lines: `Issue: owner/repo#number`, `Title: ...`, `State: ...`, `Labels: ...`, `Assignees: ...`, `Milestone: ...`, blank line, `Description:`, body text, blank line, `Comments:` with each comment as a bullet.

2. **Extend the import prompt builder** in `packages/cli/src/builders/importPrompt.ts`:
   - Add a `GITHUB_IMPORT_PROMPT` template string similar to `IMPORT_PROMPT` but with an "IMPORTED GITHUB ISSUE" section instead of "IMPORTED JIRA TICKET". The instructions should map GitHub fields to task sections: use the issue title for the Task name, map body and comments to Description/Background/Technical Requirements, include `owner/repo#number` in Labels metadata.
   - Export a `buildGitHubImportPrompt({ issueData }: { issueData: string })` function that performs the same placeholder replacement as `buildImportPrompt`.

3. **Extend the import command** in `packages/cli/src/cmd/task/import.ts`:
   - Change `--jira` from `required: true` to `required: false`.
   - Add `--github` / `-gh` arg (type `string`, required: false).
   - At the start of `run()`, validate mutual exclusivity: if both are set or neither is set, log an error and exit.
   - Add a conditional branch: if `args.github` is provided, run the GitHub import flow (parse input, resolve profile, load auth, fetch issue, format, build prompt, spawn agent). If `args.jira` is provided, run the existing Jira flow unchanged.
   - The agent spawning, streaming, and completion detection logic is identical for both paths — extract it into a shared helper or reuse inline.

4. **Wire up imports and types**:
   - Import the new `GitHub` namespace and `buildGitHubImportPrompt` in the import command.
   - Import `Auth` (already imported) and reference `GitHubCredentials` type if needed.
   - Ensure the `github` config key is available via `Config.get('github')` (depends on config schema update from the auth provider task).

5. **Error handling**:
   - In `GitHub.fetchIssue`, handle HTTP status codes with specific messages: 401 → "Authentication required. Run `ody auth github` to configure credentials or verify your token has the correct scopes."; 403 → "Access denied or rate limit exceeded. Authenticated requests get 5,000 requests/hour."; 404 → "Issue not found. Check the owner, repo, and issue number."; others → generic with status code.
   - In the import command, wrap the GitHub fetch in try/catch with spinner stop and `log.error` + `process.exit(1)`, matching the Jira error handling pattern.

## Acceptance Criteria

1. **Import via full GitHub URL**
   - Given a user runs `ody task import --github https://github.com/owner/repo/issues/42`
   - When the issue exists and is accessible
   - Then a `.code-task.md` file is generated in the tasks directory with content derived from the GitHub issue

2. **Import via shorthand**
   - Given a user runs `ody task import -gh owner/repo#42`
   - When the issue exists and is accessible
   - Then the command parses the shorthand correctly and generates a task file

3. **Authenticated requests**
   - Given GitHub credentials are stored via `ody auth github`
   - When a user imports a private repository issue
   - Then the request includes the Bearer token and succeeds

4. **Public repo without auth**
   - Given no GitHub credentials are configured
   - When a user imports an issue from a public repository
   - Then the request succeeds without authentication

5. **Mutual exclusivity of flags**
   - Given a user runs `ody task import --jira PROJ-123 --github owner/repo#1`
   - When the command starts
   - Then it logs an error about providing exactly one source and exits

6. **Missing both flags**
   - Given a user runs `ody task import` with no `--jira` or `--github` flag
   - When the command starts
   - Then it logs an error about providing exactly one source and exits

7. **Dry run support**
   - Given a user runs `ody task import --github owner/repo#42 --dry-run`
   - When the issue is fetched
   - Then the generated prompt is printed to stdout without spawning an agent

8. **GitHub API error handling**
   - Given the GitHub API returns a 404
   - When the user runs the import
   - Then the spinner stops and a clear error message is displayed suggesting the user check the owner, repo, and issue number

9. **Generated task file structure**
   - Given a successful GitHub import
   - When the agent completes
   - Then the generated `.code-task.md` file contains all required sections (frontmatter, Description, Background, Technical Requirements, Dependencies, Implementation Approach, Acceptance Criteria, Metadata) and the issue reference appears in the Labels metadata

## Metadata
- **Complexity**: High
- **Labels**: github, import, task, cli-command, api-client, prompt-builder
