import { Config } from '../lib/config';

const LOOP_PROMPT = `
1. Look in the .ody/tasks/ directory for .code-task.md files. Read the YAML frontmatter of each file and find tasks with "status: pending". Select the single highest-priority pending task (use your judgement; not necessarily the first listed).
2. Update the selected task's YAML frontmatter: set "status: in_progress" and set "started" to today's date (YYYY-MM-DD format).
3. Implement only that task, following its Technical Requirements and Implementation Approach.
4. Use following commands to validate work: {VALIDATION_COMMANDS} (skip if none).
5. Update the task's YAML frontmatter: set "status: completed" and set "completed" to today's date (YYYY-MM-DD format).
6. Append a short progress note to {PROGRESS_FILE} file.
7. If shouldCommit is true, create a git commit for this task.

INPUT
shouldCommit: {SHOULD_COMMIT}

OUTPUT
- If all tasks in .ody/tasks/ are completed (no pending tasks remain), output <woof>COMPLETE</woof>.
- If no .ody/tasks/ directory or no .code-task.md files can be found, output <woof>COMPLETE</woof>.
`;

export const buildPrompt = () => {
  const shouldCommit = Config.get('shouldCommit');
  const validatorCommands = Config.get('validatorCommands');

  let prompt = LOOP_PROMPT.replace(
    '{VALIDATION_COMMANDS}',
    validatorCommands ? validatorCommands.join(', ') : '',
  )
    .replace('{PROGRESS_FILE}', '.ody/progress.txt')
    .replace('{SHOULD_COMMIT}', String(shouldCommit));

  return prompt.trim();
};

// Modified from Anthropic's code-task-generator skill
const PLAN_PROMPT = `
OVERVIEW
This SOP generates structured code task files from rough descriptions, ideas, or PDD implementation plans. It automatically detects the input type and creates properly formatted code task files following the code task format specification. For PDD plans, it processes implementation steps one at a time to allow for learning and adaptation between steps.

RULES
- Create EXACTLY ONE task as a markdown file
- The file MUST be written to the .ody/tasks/ directory
- The filename MUST use kebab-case and end with .code-task.md (e.g., .ody/tasks/add-email-validation.code-task.md)
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

  return PLAN_PROMPT.replace('{TASK_DESCRIPTION}', description)
    .replace('{CURRENT_DATE}', currentDate)
    .trim();
};
