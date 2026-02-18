import path from 'node:path';

import { Config } from '../lib/config';
import { BASE_DIR, TASKS_DIR } from '../util/constants';
import { TASK_FILE_FORMAT } from './shared';

const IMPORT_PROMPT = `
OVERVIEW
This SOP generates a structured code task file from an imported Jira ticket. It takes the formatted ticket data and creates a properly formatted .code-task.md file following the code task format specification. The agent maps Jira ticket fields to the appropriate task sections.

RULES
- Create EXACTLY ONE task as a markdown file
- The file MUST be written to the {TASKS_DIR} directory
- The filename MUST use kebab-case and end with .code-task.md (e.g., {TASKS_DIR}/add-email-validation.code-task.md)
- The filename should be descriptive of the task content, derived from the Jira ticket summary
- <woof>COMPLETE</woof> should NEVER be added to the task file, as it's important during the runtime of implementing a task
- All sections in the template below are REQUIRED — do not skip any

FILE FORMAT
The file MUST follow this exact structure:

${TASK_FILE_FORMAT}

IMPORTED JIRA TICKET
The following is the formatted data from a Jira ticket. Use this data to populate the task file sections:

- Use the ticket **summary** as the basis for the Task name (concise and descriptive)
- Map the ticket **description** and **comments** to the Description, Background, and Technical Requirements sections
- Infer the Implementation Approach from the ticket context, breaking it into concrete steps
- Infer Acceptance Criteria from the ticket context using the Given/When/Then format
- Include the Jira ticket key (e.g., PROJ-123) in the Labels metadata field
- Map the ticket priority to the Complexity field (use your best judgement)

{TICKET_DATA}

OUTPUT
When finished writing the task file, output the text: <woof>COMPLETE</woof>.
`;

export const buildImportPrompt = ({ ticketData }: { ticketData: string }) => {
  const currentDate = new Date().toISOString().slice(0, 10);
  const tasksDir = Config.get('tasksDir') ?? TASKS_DIR;
  const tasksDirPath = path.join(BASE_DIR, tasksDir);

  return IMPORT_PROMPT.replace('{TICKET_DATA}', ticketData)
    .replace('{CURRENT_DATE}', currentDate)
    .replace(/{TASKS_DIR}/g, tasksDirPath)
    .trim();
};
