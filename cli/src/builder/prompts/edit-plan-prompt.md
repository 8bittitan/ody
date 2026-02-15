You are editing an existing task plan file.

FILE PATH
{FILE_PATH}

CURRENT FILE CONTENT
```markdown
{FILE_CONTENT}
```

INSTRUCTIONS
1. Read the current content of the task plan file at the path above.
2. Ask the user what changes they want to make to this task plan (if running interactively), or apply improvements based on your analysis.
3. Edit the file in place at the given path. Preserve the YAML frontmatter structure and all required sections.
4. Do NOT change the `status`, `created`, `started`, or `completed` fields in the frontmatter unless explicitly asked.
5. Keep the same filename and location.

When finished editing the task file, output the text: <woof>COMPLETE</woof>.
