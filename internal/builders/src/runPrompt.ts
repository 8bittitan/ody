import path from 'path';

import { BASE_DIR, Config, TASKS_DIR } from '@internal/config';
import type { OdyConfig } from '@internal/config';

export const LOOP_PROMPT = `
1. Look in the {TASKS_DIR} directory for .code-task.md files. Read the YAML frontmatter of each file and find tasks with "status: pending". Select the single highest-priority pending task (use your judgement; not necessarily the first listed).
2. Update the selected task's YAML frontmatter: set "status: in_progress" and set "started" to today's date (YYYY-MM-DD format).
3. Implement only that task, following its Technical Requirements and Implementation Approach.
4. Use following commands to validate work: {VALIDATION_COMMANDS} (skip if none).
   If any validation commands are failing, do your best to fix them on your own
5. Update the task's YAML frontmatter: set "status: completed" and set "completed" to today's date (YYYY-MM-DD format).
6. Append a short progress note to {PROGRESS_FILE} file.
7. If shouldCommit is true, create a git commit for this task.
   ONLY commit if all validation commands are passing

INPUT
shouldCommit: {SHOULD_COMMIT}

OUTPUT
- If all tasks in {TASKS_DIR} are completed (no pending tasks remain), output <woof>COMPLETE</woof>.
- If no {TASKS_DIR} directory or no .code-task.md files can be found, output <woof>COMPLETE</woof>.
`;

export const SINGLE_TASK_PROMPT = `
1. Read the task file at {TASK_FILE}. Parse its YAML frontmatter and body.
2. Update the task's YAML frontmatter: set "status: in_progress" and set "started" to today's date (YYYY-MM-DD format).
3. Implement only that task, following its Technical Requirements and Implementation Approach.
4. Use following commands to validate work: {VALIDATION_COMMANDS} (skip if none).
   If any validation commands are failing, do your best to fix them on your own
5. Update the task's YAML frontmatter: set "status: completed" and set "completed" to today's date (YYYY-MM-DD format).
6. Append a short progress note to {PROGRESS_FILE} file.
7. If shouldCommit is true, create a git commit for this task.
   ONLY commit if all validation commands are passing

INPUT
shouldCommit: {SHOULD_COMMIT}

OUTPUT
- When the task is completed, output <woof>COMPLETE</woof>.
`;

type BuildRunPromptOptions = {
  taskFiles?: string[];
  taskFile?: string;
  config?: Pick<OdyConfig, 'shouldCommit' | 'validatorCommands' | 'tasksDir'>;
};

export const buildRunPrompt = (options?: BuildRunPromptOptions) => {
  const config = options?.config ?? Config.all();
  const shouldCommit = config.shouldCommit;
  const validatorCommands = config.validatorCommands;
  const tasksDirPath = path.join(BASE_DIR, config.tasksDir ?? TASKS_DIR);
  const validationStr = validatorCommands ? validatorCommands.join(', ') : '';

  if (options?.taskFile) {
    const prompt = SINGLE_TASK_PROMPT.replace('{TASK_FILE}', options.taskFile)
      .replace('{VALIDATION_COMMANDS}', validationStr)
      .replace('{PROGRESS_FILE}', '.ody/progress.txt')
      .replace('{SHOULD_COMMIT}', String(shouldCommit));

    return prompt.trim();
  }

  let prompt = LOOP_PROMPT.replace('{VALIDATION_COMMANDS}', validationStr)
    .replace(/{TASKS_DIR}/g, tasksDirPath)
    .replace('{PROGRESS_FILE}', '.ody/progress.txt')
    .replace('{SHOULD_COMMIT}', String(shouldCommit));

  if (options?.taskFiles && options.taskFiles.length > 0) {
    const taskList = options.taskFiles.map((f) => `  - ${f}`).join('\n');
    prompt += `

LABEL FILTER
Only consider the following task files:
${taskList}`;
  }

  return prompt.trim();
};
