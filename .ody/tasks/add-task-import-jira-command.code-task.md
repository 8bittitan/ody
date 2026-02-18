---
status: completed
created: 2026-02-18
started: 2026-02-18
completed: 2026-02-18
---
# Task: Add Task Import Jira Command

## Description
Add an `ody task import --jira <KEY_OR_URL>` command that fetches a Jira ticket via the REST API and generates a `.code-task.md` file by piping the ticket data through the backend agent. This is the top-level integration command that ties together the auth store, Jira client, import prompt builder, and backend agent into a single user-facing workflow. It follows the same spawn/stream/completion-marker pattern used by the `plan` command.

## Background
The Ody CLI can create tasks via the interactive `plan` command, but there is no way to import tasks from external project management tools. Many teams track work in Jira and want to convert Jira tickets into Ody code-tasks that the agent can then execute. This command bridges that gap. The `--jira` flag accepts either a full Jira URL (`https://company.atlassian.net/browse/PROJ-123`) or a ticket key (`PROJ-123`). When a ticket key is used, the base URL is resolved from the project's `.ody/ody.json` config (`jira.baseUrl`). Credentials are loaded from the global auth store (`~/.local/share/ody/auth.json`) using the profile specified in `jira.profile` (defaulting to `"default"`). The fetched ticket data is formatted and passed to the import prompt builder, which produces a prompt that instructs the backend agent to create a well-structured `.code-task.md` file.

## Technical Requirements
1. Create `packages/cli/src/cmd/task/import.ts` exporting `importCmd` using `defineCommand` from `citty`
2. Register the command in `packages/cli/src/cmd/task/index.ts` as a lazy-loaded subcommand: `import: () => import('./import').then((m) => m.importCmd)`
3. Define the following args:
   - `jira`: `type: 'string'`, `required: true`, description: `'Jira ticket key (e.g. PROJ-123) or full URL'`
   - `verbose`: `type: 'boolean'`, `default: false`, description: `'Enable verbose logging'`
   - `dry-run`: `type: 'boolean'`, `default: false`, `alias: 'd'`, description: `'Print the generated prompt without running the agent'`
4. The `run` function must execute the following steps in order:
   - Parse the `--jira` input using `Jira.parseInput(args.jira, jiraConfig?.baseUrl)` to get `baseUrl` and `ticketKey`
   - Resolve the credential profile from `Config.get('jira')?.profile ?? 'default'`
   - Load credentials from `Auth.getJira(profile)`
   - Fetch the ticket using `Jira.fetchTicket(baseUrl, ticketKey, auth)` with a spinner
   - Format the ticket using `Jira.formatAsDescription(ticket)`
   - Build the prompt using `buildImportPrompt({ ticketData })`
   - If `--dry-run`, print the prompt and exit
   - Create the tasks directory with `mkdir` (recursive)
   - Spawn the backend agent with `Bun.spawn({ cmd: backend.buildCommand(prompt), stdio: ['ignore', 'pipe', 'pipe'] })`
   - Stream output using `Stream.toOutput`, detecting the `<woof>COMPLETE</woof>` completion marker to kill the process
   - Display a success message with the ticket key
5. Error handling must wrap the Jira fetch in try/catch with `spin.stop` on failure and `log.error` with the error message, then `process.exit(1)`
6. Error handling must wrap the agent spawn in try/catch with the same pattern
7. Use `spinner` from `@clack/prompts` for both the fetch and agent generation phases
8. Use `outro` from `@clack/prompts` for the final success message

## Dependencies
- `packages/cli/src/lib/auth.ts` — `Auth.getJira(profile)` for loading credentials
- `packages/cli/src/lib/jira.ts` — `Jira.parseInput()`, `Jira.fetchTicket()`, `Jira.formatAsDescription()` for ticket fetching and formatting
- `packages/cli/src/lib/config.ts` — `Config.get('jira')` for base URL and profile, `Config.get('backend')` for backend selection
- `packages/cli/src/builders/importPrompt.ts` — `buildImportPrompt()` for prompt generation
- `packages/cli/src/backends/backend.ts` — `Backend` class for building the agent command
- `packages/cli/src/util/stream.ts` — `Stream.toOutput()` for streaming agent output
- `packages/cli/src/util/constants.ts` — `BASE_DIR` and `TASKS_DIR` for directory paths
- `@clack/prompts` (already a dependency) — for `spinner`, `outro`, `log`
- `citty` (already a dependency) — for `defineCommand`
- `node:fs/promises` — for `mkdir`
- `node:path` — for path joining

## Implementation Approach
1. **Create the command file**: Create `packages/cli/src/cmd/task/import.ts` with imports for all dependencies listed above
2. **Define the command**: Use `defineCommand` with `meta` (name: `'import'`, description: `'Import a task from an external source'`) and the three `args` specified in the requirements
3. **Implement input parsing**: At the start of `run`, get `jiraConfig` from `Config.get('jira')` and call `Jira.parseInput(args.jira, jiraConfig?.baseUrl)` to resolve the base URL and ticket key. This handles both URL and key inputs
4. **Resolve credentials**: Determine the profile name from `jiraConfig?.profile ?? 'default'` and call `Auth.getJira(profile)` to get the credentials (may be `undefined` for public instances)
5. **Fetch the ticket**: Start a spinner with a message like `Fetching {ticketKey} from Jira...`. Call `Jira.fetchTicket(baseUrl, ticketKey, auth)` in a try/catch. On success, stop the spinner showing the ticket summary. On error, stop the spinner, log the error, and exit
6. **Build the prompt**: Call `Jira.formatAsDescription(ticket)` to get the text, then `buildImportPrompt({ ticketData })` to wrap it in the prompt template
7. **Handle dry-run**: If `args['dry-run']` is true, log the prompt with `log.info` and call `outro('Dry run complete')`, then return
8. **Spawn the agent**: Create the tasks directory with `mkdir(path.join(BASE_DIR, tasksDir), { recursive: true })`. Start a new spinner. Create the backend with `new Backend(Config.get('backend'))` and spawn the process with `Bun.spawn`. Use `Promise.allSettled` to stream both stdout and stderr via `Stream.toOutput`, passing `shouldPrint: args.verbose` and an `onChunk` callback that checks for `<woof>COMPLETE</woof>` and kills the process when found. Await `proc.exited`
9. **Complete**: Stop the spinner and call `outro` with a message like `Task imported from {ticketKey}`
10. **Register the command**: In `packages/cli/src/cmd/task/index.ts`, add `import: () => import('./import').then((m) => m.importCmd)` to the `subCommands` object

## Acceptance Criteria

1. **Command is registered and callable**
   - Given the CLI is built
   - When the user runs `ody task import --jira PROJ-123`
   - Then the command executes and attempts to fetch the ticket

2. **Full URL input works**
   - Given valid Jira credentials are configured
   - When the user runs `ody task import --jira https://company.atlassian.net/browse/PROJ-123`
   - Then the ticket is fetched from the URL's host and a `.code-task.md` file is generated

3. **Ticket key input uses config base URL**
   - Given `jira.baseUrl` is set in `.ody/ody.json` and credentials are configured
   - When the user runs `ody task import --jira PROJ-123`
   - Then the base URL from config is used and a `.code-task.md` file is generated

4. **Profile from config is used for credentials**
   - Given `jira.profile` is set to `"work"` in `.ody/ody.json` and the `"work"` profile exists in `auth.json`
   - When the user runs `ody task import --jira PROJ-123`
   - Then the `"work"` profile credentials are used for authentication

5. **Default profile used when no profile configured**
   - Given no `jira.profile` is set in `.ody/ody.json` and a `"default"` profile exists in `auth.json`
   - When the user runs `ody task import --jira PROJ-123`
   - Then the `"default"` profile credentials are used

6. **Dry run prints prompt without spawning agent**
   - Given valid Jira credentials and a reachable ticket
   - When the user runs `ody task import --jira PROJ-123 --dry-run`
   - Then the generated prompt is printed to the console and no agent is spawned

7. **Verbose mode streams agent output**
   - Given valid Jira credentials and a reachable ticket
   - When the user runs `ody task import --jira PROJ-123 --verbose`
   - Then the agent's output is streamed to the terminal in real time

8. **Jira fetch failure shows clear error**
   - Given the Jira instance is unreachable or the ticket does not exist
   - When the user runs `ody task import --jira PROJ-999`
   - Then an error message is displayed and the command exits with code 1

9. **Missing base URL for ticket key shows guidance**
   - Given no `jira.baseUrl` is configured in `.ody/ody.json`
   - When the user runs `ody task import --jira PROJ-123`
   - Then an error message is displayed guiding the user to set `jira.baseUrl`

10. **Task file is created in tasks directory**
    - Given a successful import
    - When the agent completes
    - Then a new `.code-task.md` file exists in the configured tasks directory with status `pending`

11. **Completion marker terminates the agent**
    - Given the agent outputs `<woof>COMPLETE</woof>` during execution
    - When the marker is detected in the stream
    - Then the agent process is killed and the command exits with a success message

## Metadata
- **Complexity**: High
- **Labels**: cli, jira, command, import, task
