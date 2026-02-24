---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement Task Import from Jira/GitHub

## Description
Build the Task Import panel that fetches Jira tickets or GitHub issues, previews the formatted data, and spawns an agent to generate `.code-task.md` files from external sources. Includes credential checking, data preview, and streaming output.

## Background
The Import panel provides a stepped flow: select source (Jira/GitHub), enter ticket/issue reference, fetch and preview data, then generate a task file. It reuses the Jira/GitHub clients from `@internal/integrations` and the `buildImportPrompt()` builder from `@internal/builders`. The panel checks for credentials before fetching and links to the Auth panel if missing.

## Technical Requirements
1. Create `src/renderer/components/TaskImport.tsx` -- import panel component
2. Create `src/renderer/hooks/useImport.ts` -- import state management hook
3. Wire IPC handlers:
   - `import:fetchJira` -- parse input, fetch ticket via `Jira.fetchTicket()`, format via `Jira.formatAsDescription()`
   - `import:fetchGitHub` -- parse input, fetch issue via `GitHub.fetchIssue()`, format via `GitHub.formatAsDescription()`
   - `agent:importFromJira` -- build import prompt, spawn agent to generate task
   - `agent:importFromGitHub` -- build import prompt, spawn agent to generate task
   - `agent:importDryRun` -- return the prompt without spawning
4. Import panel features:
   - Source selector: Radio group (Jira / GitHub)
   - Input field: ticket key, URL, or shorthand (auto-detects format)
   - "Fetch" button: calls respective IPC handler to fetch data
   - Loading state during fetch
   - Fetched data preview: title, status, priority, labels, description, comments
   - "Preview Prompt" button: shows the full prompt
   - "Generate Task" button: spawns agent with streaming output
   - Credential check: before fetching, verify auth profile exists; show "Configure credentials" link if missing
5. After successful generation, Task Board refreshes with the new task card

## Dependencies
- `implement-auth-management` task must be completed
- `implement-agent-runner` task must be completed
- `extract-internal-integrations` task must be completed
- `extract-internal-builders` task must be completed

## Implementation Approach
1. Implement IPC handlers:
   ```typescript
   ipcMain.handle('import:fetchJira', async (_, opts) => {
     const parsed = Jira.parseInput(opts.input, config.jira?.baseUrl);
     const auth = await Auth.getJira(config.jira?.profile);
     const ticket = await Jira.fetchTicket(parsed.baseUrl, parsed.key, auth);
     const formatted = Jira.formatAsDescription(ticket);
     return { ticket, formatted };
   });
   
   ipcMain.handle('agent:importFromJira', async (_, opts) => {
     // Similar to above, but build prompt and spawn agent
     const prompt = buildImportPrompt({ data: formatted, source: 'jira' });
     // Spawn agent with prompt, stream output
   });
   ```
2. Build `TaskImport.tsx`:
   - Source selector using shadcn RadioGroup
   - Text input for ticket/issue reference
   - Fetch button triggers data loading
   - Preview area shows formatted ticket/issue data in a structured layout
   - Generate Task button spawns agent and shows streaming output
3. Implement `useImport` hook:
   - State: source ('jira' | 'github'), input, fetchedData, isLoading, isGenerating
   - Actions: fetch, generate, reset
   - Credential check: call `auth:list` and verify profile exists for selected source
4. Credential check flow:
   - Before fetch, check if auth profile exists
   - If missing, show inline message: "No [Jira/GitHub] credentials configured" with link to Auth panel
5. Streaming output during generation:
   - Subscribe to `agent:output` events
   - Display in a log area below the preview
   - Detect completion, refresh Task Board
6. Preview layout matches the wireframe from the plan:
   - Title, Status, Priority in a structured card
   - Labels as chips
   - Description text
   - Comments list with author prefixes

## Acceptance Criteria

1. **Jira Ticket Fetched**
   - Given valid Jira credentials and a ticket key
   - When clicking "Fetch"
   - Then the ticket data is displayed in the preview area

2. **GitHub Issue Fetched**
   - Given valid GitHub credentials and an issue reference
   - When clicking "Fetch"
   - Then the issue data is displayed in the preview area

3. **Task Generated**
   - Given a fetched ticket/issue
   - When clicking "Generate Task"
   - Then the agent spawns, streams output, and creates a `.code-task.md` file

4. **Missing Credentials Warning**
   - Given no auth profile for the selected source
   - When attempting to fetch
   - Then a warning appears with a link to configure credentials

5. **Preview Prompt**
   - Given a fetched ticket
   - When clicking "Preview Prompt"
   - Then the full prompt is displayed without spawning an agent

6. **Task Board Refreshes**
   - Given successful task generation
   - When the agent completes
   - Then the Task Board shows the new task card

## Metadata
- **Complexity**: High
- **Labels**: import, jira, github, integrations, desktop
