import path from 'node:path';

import { BASE_DIR, Config, TASKS_DIR } from '@internal/config';

import { TASK_FILE_FORMAT } from './shared';

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
- <woof>COMPLETE</woof> should NEVER be added to the task file, as it's important during the runtime of implementing a task
- All sections in the template below are REQUIRED — do not skip any

FILE FORMAT
The file MUST follow this exact structure:

${TASK_FILE_FORMAT}

USER TASK DESCRIPTION
{TASK_DESCRIPTION}

OUTPUT
When finished writing the task file, output the text: <woof>COMPLETE</woof>.
`;

export const buildPlanPrompt = ({
  description,
  tasksDir: tasksDirOverride,
}: {
  description: string;
  tasksDir?: string;
}) => {
  const currentDate = new Date().toISOString().slice(0, 10);
  let tasksDir = tasksDirOverride ?? TASKS_DIR;

  if (!tasksDirOverride) {
    try {
      tasksDir = Config.get('tasksDir') ?? TASKS_DIR;
    } catch {
      tasksDir = TASKS_DIR;
    }
  }

  const tasksDirPath = path.join(BASE_DIR, tasksDir);

  return PLAN_PROMPT.replace('{TASK_DESCRIPTION}', description)
    .replace('{CURRENT_DATE}', currentDate)
    .replace(/{TASKS_DIR}/g, tasksDirPath)
    .trim();
};

const INTERACTIVE_PLAN_PROMPT = `
You are helping the user create one or more valid \`.code-task.md\` files through an interactive conversation.

Your job is not to jump straight to writing files. First, collaborate with the user to clarify the work until you have enough concrete information to produce high-quality, actionable code tasks.

Objectives:
- Work with the user to define one or more implementation tasks clearly enough that an execution agent could complete them.
- Ask focused follow-up questions when details are missing, ambiguous, or too broad.
- Decompose broad requests into discrete, well-scoped task files.
- Once enough information is gathered, write the task file or files in the required format.
- Order tasks logically: dependencies first, dependent tasks later.

Behavior rules:
- Be concise, practical, and structured.
- Drive the conversation forward; do not ask unnecessary questions.
- Prefer resolving ambiguity with 1-3 high-value questions at a time.
- Challenge vague requirements when needed.
- Infer reasonable details only when low-risk, and label them as assumptions.
- Do not include implementation code unless the user explicitly asks for it.
- Do not mark any task as completed.
- Do not include \`<woof>COMPLETE</woof>\` inside task file content.
- Preserve the exact task file structure for every file you produce.

Before writing files, make sure you understand:
- The overall goal and why it matters
- Relevant background/context
- The discrete tasks needed to complete the work
- Concrete technical requirements for each task
- Dependencies, constraints, or related systems
- A plausible implementation approach for each task
- Clear acceptance criteria for each task
- Useful labels
- Concise task titles and kebab-case filenames

Required output:
- Produce one or more Markdown task files - one per discrete, actionable task.
- Each filename must be kebab-case and end with \`.code-task.md\`.
- Each file must use this exact structure:

${TASK_FILE_FORMAT}

Workflow:

1. Start by briefly restating the user’s requested work.
2. Ask the smallest set of questions needed to make the task file or files actionable.
3. Once enough detail exists, summarize the planned task or tasks in a few lines, note any assumptions, and confirm the decomposition when multiple tasks are needed.
4. Then produce, for each task in logical order:
    - Filename: <name>.code-task.md
    - the full Markdown content
5. If important details are still missing, do not fabricate them silently; ask before finalizing.

Quality bar:

- Each task should be specific enough for an implementation agent to execute without guessing at the goal.
- Each task should stay focused on a discrete piece of work, even when the overall request requires multiple files.
- Acceptance criteria should be testable and behavior-focused.
- Implementation approach should be concrete, but not overly prescriptive unless the user requested that.
- Labels should be short and useful for filtering.

If the user gives you a well-scoped request, producing one task file is fine. If the user gives you a broad initiative, help decompose it into as many task files as needed.
`;

export const buildInteractivePlanPrompt = () => INTERACTIVE_PLAN_PROMPT;

const BATCH_PLAN_PROMPT = `
OVERVIEW
You are given a planning document file. Read the file, analyze its contents, and decompose it into discrete, actionable code tasks. Create one .code-task.md file per task in the {TASKS_DIR} directory.

RULES
- Read the planning document at the path provided below
- Create as many task files as needed — one per discrete, actionable task
- Each file MUST be written to the {TASKS_DIR} directory
- Each filename MUST use kebab-case and end with .code-task.md (e.g., {TASKS_DIR}/add-email-validation.code-task.md)
- Each filename should be descriptive of the task content
- Take the planning document content and create your own detailed implementation approach for each task
- <woof>COMPLETE</woof> should NEVER be added to any task file, as it's important during the runtime of implementing a task
- All sections in the template below are REQUIRED for each task file — do not skip any
- Order tasks logically: dependencies first, dependent tasks later

FILE FORMAT
Each file MUST follow this exact structure:

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

PLANNING DOCUMENT FILE
Read the file at the following path and generate task files based on its contents:
{PLAN_FILE_PATH}

OUTPUT
When finished writing all task files, output the text: <woof>COMPLETE</woof>.
`;

export const buildBatchPlanPrompt = ({
  filePath,
  tasksDir: tasksDirOverride,
}: {
  filePath: string;
  tasksDir?: string;
}) => {
  const currentDate = new Date().toISOString().slice(0, 10);
  let tasksDir = tasksDirOverride ?? TASKS_DIR;

  if (!tasksDirOverride) {
    try {
      tasksDir = Config.get('tasksDir') ?? TASKS_DIR;
    } catch {
      tasksDir = TASKS_DIR;
    }
  }

  const tasksDirPath = path.join(BASE_DIR, tasksDir);

  return BATCH_PLAN_PROMPT.replace('{PLAN_FILE_PATH}', filePath)
    .replace('{CURRENT_DATE}', currentDate)
    .replace(/{TASKS_DIR}/g, tasksDirPath)
    .trim();
};
