---
status: completed
created: 2026-02-18
started: 2026-02-18
completed: 2026-02-18
---
# Task: Add Jira Import Prompt Builder

## Description
Create a prompt builder at `packages/cli/src/builders/importPrompt.ts` that takes formatted Jira ticket data and wraps it in a structured prompt template instructing the backend agent to generate a `.code-task.md` file. The prompt reuses the same task file format specification as the existing plan prompt but includes a Jira-specific preamble that guides the agent on how to map ticket fields to task sections.

## Background
The existing plan prompt builder (`packages/cli/src/builders/planPrompt.ts`) generates prompts from free-form text descriptions. The import prompt builder serves a similar purpose but is specialized for structured Jira ticket data that has already been fetched and formatted by the Jira client module. The formatted ticket data includes fields like summary, description, priority, labels, comments, and more. The agent needs specific instructions on how to map these fields into the `.code-task.md` format — for example, using the Jira summary as the task name, mapping the description and comments to the Background and Technical Requirements sections, and preserving the Jira ticket key in the Labels metadata. The prompt template follows the same placeholder replacement pattern used by `buildPlanPrompt` and `buildBatchPlanPrompt` (replacing `{TASKS_DIR}`, `{CURRENT_DATE}`, etc.).

## Technical Requirements
1. Create `packages/cli/src/builders/importPrompt.ts` exporting a `buildImportPrompt` function
2. The function must accept a `{ ticketData: string }` parameter — the pre-formatted ticket text from `Jira.formatAsDescription()`
3. The prompt template must include the same OVERVIEW, RULES, and FILE FORMAT sections as `planPrompt.ts` to ensure consistent `.code-task.md` output
4. The prompt must include an IMPORTED JIRA TICKET section that:
   - Instructs the agent to use the ticket summary as the task name
   - Instructs the agent to map description and comments to Description, Background, and Technical Requirements sections
   - Instructs the agent to infer Implementation Approach and Acceptance Criteria from the ticket context
   - Instructs the agent to include the Jira ticket key in the Labels metadata field
5. The function must replace `{TICKET_DATA}` with the ticket data, `{CURRENT_DATE}` with today's date (YYYY-MM-DD), and `{TASKS_DIR}` with the resolved tasks directory path
6. The prompt must end with the `<woof>COMPLETE</woof>` completion marker instruction, consistent with other prompt builders
7. The RULES section must specify that exactly one task file is created, using kebab-case filenames ending with `.code-task.md`
8. The `<woof>COMPLETE</woof>` marker must never be written inside the task file itself (same rule as in `planPrompt.ts`)

## Dependencies
- `packages/cli/src/builders/planPrompt.ts` — reference for the prompt template structure, file format specification, and placeholder replacement pattern
- `packages/cli/src/lib/config.ts` — `Config.get('tasksDir')` for the configurable tasks directory
- `packages/cli/src/util/constants.ts` — `BASE_DIR` and `TASKS_DIR` constants
- No new npm dependencies required

## Implementation Approach
1. **Create the module file**: Create `packages/cli/src/builders/importPrompt.ts` with the necessary imports (`path`, `Config`, `BASE_DIR`, `TASKS_DIR`)
2. **Define the prompt template**: Write an `IMPORT_PROMPT` template string constant. Copy the OVERVIEW, RULES, and FILE FORMAT sections from `planPrompt.ts` as the base, adjusting the OVERVIEW to mention Jira ticket import. Keep the RULES and FILE FORMAT sections identical to ensure consistent output
3. **Add the Jira-specific section**: Replace the `USER TASK DESCRIPTION` section with an `IMPORTED JIRA TICKET` section that contains mapping instructions and the `{TICKET_DATA}` placeholder
4. **Implement the builder function**: Export `buildImportPrompt({ ticketData })` that resolves the current date, tasks directory path, and performs string replacements on the template for `{TICKET_DATA}`, `{CURRENT_DATE}`, and `{TASKS_DIR}` (global replace for `TASKS_DIR` since it appears multiple times). Call `.trim()` on the result
5. **Ensure OUTPUT section**: End the template with the standard `OUTPUT\nWhen finished writing the task file, output the text: <woof>COMPLETE</woof>.` block

## Acceptance Criteria

1. **Prompt contains ticket data**
   - Given formatted ticket data string
   - When `buildImportPrompt({ ticketData })` is called
   - Then the returned prompt contains the ticket data in the IMPORTED JIRA TICKET section

2. **Date placeholder replaced**
   - Given today's date is 2026-02-18
   - When `buildImportPrompt({ ticketData })` is called
   - Then the returned prompt contains `created: 2026-02-18` in the file format template

3. **Tasks directory placeholder replaced**
   - Given the tasks directory is configured as the default
   - When `buildImportPrompt({ ticketData })` is called
   - Then all occurrences of `{TASKS_DIR}` are replaced with the resolved tasks directory path (e.g., `.ody/tasks`)

4. **Completion marker instruction present**
   - Given any valid input
   - When `buildImportPrompt({ ticketData })` is called
   - Then the returned prompt contains `<woof>COMPLETE</woof>` in the OUTPUT section

5. **File format matches plan prompt format**
   - Given any valid input
   - When `buildImportPrompt({ ticketData })` is called
   - Then the file format specification in the prompt matches the same markdown structure used by `buildPlanPrompt` (frontmatter, sections, metadata)

6. **Jira mapping instructions present**
   - Given any valid input
   - When `buildImportPrompt({ ticketData })` is called
   - Then the prompt instructs the agent to use the ticket summary as the task name and include the Jira ticket key in Labels

## Metadata
- **Complexity**: Low
- **Labels**: cli, jira, prompt, builder
