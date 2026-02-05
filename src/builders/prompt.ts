import { Config } from '../lib/config';

const LOOP_PROMPT = `
1. Select the single highest-priority unfinished PRD item (use your judgement; not necessarily the first listed).
2. Implement only that item.
3. Use following commands to validate work: {VALIDATION_COMMANDS} (skip if none).
4. Update the PRD to mark the task as completed.
5. Append a short progress note to {PROGRESS_FILE} file.
6. If shouldCommit is true, create a git commit for this task.

INPUT
shouldCommit: {SHOULD_COMMIT}

OUTPUT
- If the PRD is complete, output <woof>COMPLETE</woof>.
- If no PRD file can be found, output <woof>COMPLETE</woof>.
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

const PLAN_PROMPT = `
You are proficient in making software development plans. You are being asked to create a singular task based on the user's description.

RULES
- ONLY create a singular task
- The task MUST be "passes: false" by default
- Take the user provided steps description and create your own steps to aide in implementation
- Decide on a relevant "category" that the category should fall under. Here are some examples, but they are not exhaustive, feel free to use one not defined below if it makes sense:
  - "feature"
  - "ui"
  - "api"
  - "testing"
  - "refactoring"
  - "database"
- Use short description of task
- Use short decriptions for the various steps

Once you have thought of the task data, APPEND it to the provided prd json file.

TASK STRUCTURE
{
  "category": string,
  "description": string,
  "steps": string[],
  "passes": false 
}

USER TASK DESCRIPTION
{TASK_DESCRIPTION}

USER STEPS DESCRIPTION
{STEPS_DESCRIPTION}

OUTPUT
When finished appending the task to the prd file, output the text: <woof>COMPLETE</woof>.
`;

export const buildPlanPrompt = ({
  description,
  stepsDescription,
}: {
  description: string;
  stepsDescription: string;
}) => {
  return PLAN_PROMPT.replace('{TASK_DESCRIPTION}', description)
    .replace('{STEPS_DESCRIPTION}', stepsDescription)
    .trim();
};
