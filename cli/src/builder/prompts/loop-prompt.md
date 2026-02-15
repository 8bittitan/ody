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

