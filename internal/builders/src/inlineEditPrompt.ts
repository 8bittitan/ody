type SelectionRange = {
  from: number;
  to: number;
};

type BuildInlineEditPromptOptions = {
  fileContent: string;
  selection?: SelectionRange;
  instruction: string;
};

export const buildInlineEditPrompt = ({
  fileContent,
  selection,
  instruction,
}: BuildInlineEditPromptOptions) => {
  const selectionDetails = selection
    ? `Focus edits on the selected character range from ${selection.from} to ${selection.to}.`
    : 'No selection range was provided. Apply the instruction across the full file when needed.';

  return `
You are editing a source file.

INSTRUCTION
${instruction}

SCOPE
${selectionDetails}

CURRENT FILE CONTENT
<file_content>
${fileContent}
</file_content>

OUTPUT RULES
- Apply the instruction to the file content.
- Return the complete modified file, not a diff.
- Return only the file content wrapped in these exact markers:
<modified_file>
[full file content]
</modified_file>
`.trim();
};
