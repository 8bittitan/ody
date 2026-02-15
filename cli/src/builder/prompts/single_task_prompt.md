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

