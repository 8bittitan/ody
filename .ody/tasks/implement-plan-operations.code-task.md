---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement Plan Operations (New, Batch, Compact, Archive)

## Description
Build the Plan view with sub-tabs for creating single plans, batch-generating tasks from planning documents, and the archive functionality for compacting completed tasks. This includes the Plan Creator UI, file picker for batch mode, streaming preview, and the archive viewer.

## Background
The Plan view has three sub-tabs: Single (create one task from a description), Batch (generate multiple tasks from a planning document), and List (simplified task list). Plan Compact archives completed tasks into a markdown file, deletes the original task files, and clears `progress.txt`. The Archive view lists past archives with expandable content.

## Technical Requirements
1. Create `src/renderer/components/PlanCreator.tsx` -- plan creation UI with Single/Batch tabs
2. Create `src/renderer/components/PlanList.tsx` -- simplified task list (pending only)
3. Create `src/renderer/components/ArchiveViewer.tsx` -- archive listing and viewing
4. Wire IPC handlers:
   - `agent:planNew` -- spawn agent with `buildPlanPrompt({ description })` to create single task
   - `agent:planBatch` -- spawn agent with `buildBatchPlanPrompt({ filePath })` for batch task generation
   - `archive:compact` -- scan completed tasks, generate archive markdown, delete completed task files, archive and clear `progress.txt`
   - `archive:list` -- list all archive files with metadata
5. Single plan mode:
   - Multi-line text area for task description
   - "Generate" button spawns agent
   - Live-updating preview of generated task file as agent streams
   - "Create Another" button after completion
   - "Preview Prompt" button shows the prompt without executing
6. Batch plan mode:
   - File picker or drag-and-drop zone for planning document (markdown files)
   - "Generate Tasks" button spawns agent with `buildBatchPlanPrompt`
   - Streaming progress display
   - Task Board auto-refreshes on completion with new task cards
7. Archive functionality:
   - "Archive Completed" button in Task Board toolbar
   - Confirmation dialog showing list of tasks to be archived
   - Generates archive markdown file with task details
   - Deletes completed task files after archiving
   - Archives and clears `progress.txt`
8. Archive viewer:
   - List of past archives with date, task count
   - "View" button expands archive content inline

## Dependencies
- `implement-task-board` task must be completed
- `implement-agent-runner` task must be completed
- `extract-internal-builders` task must be completed

## Implementation Approach
1. Build `PlanCreator.tsx` with shadcn Tabs for Single/Batch:
   - **Single tab**: textarea + Generate button + streaming preview area
   - **Batch tab**: file input (styled as drag-and-drop zone) + Generate Tasks button + progress display
2. Implement `agent:planNew` handler:
   - Build prompt using `buildPlanPrompt({ description })` from `@internal/builders`
   - Spawn backend process
   - Stream output to renderer
   - On completion, refresh task list
3. Implement `agent:planBatch` handler:
   - Build prompt using `buildBatchPlanPrompt({ filePath })` from `@internal/builders`
   - Spawn backend process
   - Stream output to renderer
   - On completion, refresh task list
4. Implement `archive:compact` handler:
   - Scan tasks dir for completed tasks (frontmatter status === 'completed')
   - Read each completed task file content
   - Generate archive markdown: date header + task summaries + progress notes
   - Write archive file to `.ody/archives/` (or `.ody/archive-YYYY-MM-DD.md`)
   - Delete completed task files
   - Read and include `progress.txt` content in archive
   - Clear `progress.txt`
   - Return list of archived tasks and archive file path
5. Build `ArchiveViewer.tsx`:
   - List archives from `archive:list` IPC
   - Each entry shows date, task count, and View/Expand button
   - Expand shows formatted archive content
6. Wire "Archive Completed" button in `TaskBoard.tsx` toolbar:
   - Confirmation dialog lists tasks that will be archived
   - On confirm, call `archive:compact` IPC
   - Refresh task list after archiving

## Acceptance Criteria

1. **Single Plan Generation**
   - Given a description in the text area
   - When clicking "Generate"
   - Then the agent spawns and the generated task file streams into the preview

2. **Batch Plan Generation**
   - Given a planning document file
   - When clicking "Generate Tasks"
   - Then the agent creates multiple task files and the Task Board refreshes

3. **Archive Confirmation**
   - Given completed tasks exist
   - When clicking "Archive Completed"
   - Then a dialog shows which tasks will be archived before proceeding

4. **Archive Generates File**
   - Given completed tasks are confirmed for archiving
   - When the archive runs
   - Then an archive markdown file is created, completed tasks are deleted, and progress.txt is cleared

5. **Archive Viewer**
   - Given past archives exist
   - When opening the Archive view
   - Then archives are listed with dates and can be expanded to view content

6. **Preview Prompt**
   - Given a description in the Single plan tab
   - When clicking "Preview Prompt"
   - Then the full prompt is displayed without spawning an agent

## Metadata
- **Complexity**: High
- **Labels**: plan, archive, ui, desktop
