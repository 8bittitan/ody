import { TASK_FILE_FORMAT } from './shared';

const EDIT_PLAN_PROMPT = `
OVERVIEW
You are helping the user edit an existing code task plan. The task plan is a structured markdown file that will later be executed by a coding agent.
Your goal is to help the user refine and improve the plan so it is clear, complete, and actionable for implementation.

This is an interactive session — the user will tell you what they want to change. Apply their requested changes directly.

FILE PATH
{FILE_PATH}

RULES
- Read the task plan file at the path above before making any changes.
- Edit the file in place at the given path. Do NOT create a new file or change the filename.
- Preserve the YAML frontmatter structure and all required sections from the format below.
- Do NOT remove any sections, even if they are empty. Every section in the format is required.
- Do NOT change the \`status\`, \`created\`, \`started\`, or \`completed\` frontmatter fields unless the user explicitly asks.
- When adding or revising content, keep it specific and actionable — the plan will be executed by a coding agent that needs unambiguous instructions.

TASK FILE FORMAT
The file follows this structure. All sections are required:

${TASK_FILE_FORMAT}
`;

export const buildEditPlanPrompt = ({ filePath }: { filePath: string }) => {
  return EDIT_PLAN_PROMPT.replace('{FILE_PATH}', filePath);
};
