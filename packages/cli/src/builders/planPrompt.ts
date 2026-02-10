import path from 'node:path';

import { Config } from '../lib/config';
import { BASE_DIR, TASKS_DIR } from '../util/constants';

// Modified from Anthropic's code-task-generator skill
const PLAN_PROMPT = `
OVERVIEW
This SOP generates structured code task files from rough descriptions, ideas, or PDD implementation plans. It automatically detects the input type and creates properly formatted code task files following the code task format specification. For PDD plans, it processes implementation steps one at a time to allow for learning and adaptation between steps.

RULES
- Create EXACTLY ONE task as a markdown file
- The file MUST be written to the {TASKS_DIR} directory
- The filename MUST use kebab-case and end with .code-task.md (e.g., {TASKS_DIR}/add-email-validation.code-task.md)
- The filename should be descriptive of the task content
- Take the user provided steps description and create your own detailed implementation approach
- All sections in the template below are REQUIRED — do not skip any

FILE FORMAT
The file MUST follow this exact structure:

\`\`\`markdown
---
status: pending
created: {CURRENT_DATE}
started: null
completed: null
---
# Task: [Concise Task Name]

## Description
[A clear description of what needs to be implemented and why]

## Background
[Relevant context and background information needed to understand the task]

## Technical Requirements
1. [First requirement]
2. [Second requirement]
3. [Third requirement]

## Dependencies
- [First dependency with details]
- [Second dependency with details]

## Implementation Approach
1. [First implementation step or approach]
2. [Second implementation step or approach]
3. [Third implementation step or approach]

## Acceptance Criteria

1. **[Criterion Name]**
   - Given [precondition]
   - When [action]
   - Then [expected result]

2. **[Another Criterion]**
   - Given [precondition]
   - When [action]
   - Then [expected result]

## Metadata
- **Complexity**: [Low/Medium/High]
- **Labels**: [Comma-separated list of labels]
\`\`\`

USER TASK DESCRIPTION
{TASK_DESCRIPTION}

OUTPUT
When finished writing the task file, output the text: <woof>COMPLETE</woof>.
`;

export const buildPlanPrompt = ({ description }: { description: string }) => {
  const currentDate = new Date().toISOString().slice(0, 10);
  const tasksDir = Config.get('tasksDir') ?? TASKS_DIR;
  const tasksDirPath = path.join(BASE_DIR, tasksDir);

  return PLAN_PROMPT.replace('{TASK_DESCRIPTION}', description)
    .replace('{CURRENT_DATE}', currentDate)
    .replace(/{TASKS_DIR}/g, tasksDirPath)
    .trim();
};
