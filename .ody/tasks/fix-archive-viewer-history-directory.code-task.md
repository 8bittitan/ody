---
status: pending
created: 2026-02-24
started: null
completed: null
---
# Task: Fix Archive Viewer to Read from .ody/history with Date-Grouped Display

## Description
The desktop Archive view does not display archived files because it reads from `.ody/archives/` while the CLI `ody compact` command writes archives to `.ody/history/`. The archive viewer also assumes a flat directory of timestamped markdown files, but the actual history directory uses date-stamped subdirectories (`YYYY-MM-DD/`) containing `tasks.md` and `progress.md` files, plus legacy flat archive files at the root level. The viewer needs to be updated to read from the correct directory, traverse its date-based subdirectory structure, and present archives grouped by date to reflect the on-disk layout.

## Background
There are two separate archive systems that diverged:

1. **CLI (`ody compact`)** — writes to `.ody/history/` using date-stamped subdirectories:
   ```
   .ody/history/
     archive-2026-02-13.md          ← legacy flat file
     2026-02-21/
       tasks.md
       progress.md
     2026-02-24/
       tasks.md
       progress.md
   ```
   Each `tasks.md` contains a `# Task Archive` heading with a task count and `## Task Title` entries. Each `progress.md` contains a `# Progress Log` heading with the archived progress notes.

2. **Desktop (`archive:list` IPC)** — reads from `.ody/archives/` (which does not exist in practice) and expects flat `archive-<timestamp>.md` files.

The desktop viewer has never successfully displayed CLI-created archives because the directory path and file structure assumptions are wrong. The viewer should be updated to match the CLI's actual output structure, presenting archives grouped by their date subdirectory, with the ability to view tasks and progress files separately within each date group.

## Technical Requirements
1. Change `resolveArchivesDirPath` in `packages/desktop/src/main/ipc.ts` to resolve to `.ody/history` instead of `.ody/archives`.
2. Update the `archive:list` IPC handler to traverse the history directory, detecting both date-stamped subdirectories (`YYYY-MM-DD/`) and legacy flat `.md` files at the root level.
3. Update the `ArchiveEntry` type in `packages/desktop/src/renderer/types/ipc.ts` to support the richer structure (date grouping, separate tasks/progress files per date entry).
4. Update `parseTaskCountFromArchive` to work with the CLI's archive format, parsing the `Total tasks archived: N` line from `tasks.md`.
5. Update `ArchiveViewer.tsx` to render archives grouped by date, with separate expandable sections for tasks and progress within each group.
6. Ensure legacy flat archive files (e.g., `archive-2026-02-13.md`) are still displayed, treated as a single entry for their extracted date.

## Dependencies
- `packages/desktop/src/main/ipc.ts` — contains `resolveArchivesDirPath`, `parseTaskCountFromArchive`, `archive:compact`, and `archive:list` handlers (lines 245–1446)
- `packages/desktop/src/renderer/types/ipc.ts` — contains `ArchiveEntry` type (line 42) and `IpcChannels` type for `archive:list` return type (line 136)
- `packages/desktop/src/renderer/components/ArchiveViewer.tsx` — the React component that renders the archive list
- `packages/desktop/src/preload/index.ts` — preload bridge for `archive.list` (lines 93–96)
- `packages/cli/src/cmd/compact.ts` — the CLI command that produces the archive files (read-only reference, do not modify)

## Implementation Approach
1. **Update the history directory resolver** — In `ipc.ts`, change `resolveArchivesDirPath` to point to `history` instead of `archives`:
   ```typescript
   const resolveHistoryDirPath = (projectPath: string) => join(projectPath, BASE_DIR, 'history');
   ```

2. **Redesign the `ArchiveEntry` type** — Replace the current flat `ArchiveEntry` with a structure that represents date-grouped archives, each containing optional tasks and progress content:
   ```typescript
   export type ArchiveFile = {
     filePath: string;
     content: string;
     taskCount: number;
   };

   export type ArchiveEntry = {
     date: string;                    // YYYY-MM-DD
     tasks: ArchiveFile | null;       // tasks.md if present
     progress: ArchiveFile | null;    // progress.md if present
     legacy: ArchiveFile | null;      // flat archive-*.md if present
   };
   ```

3. **Rewrite the `archive:list` handler** — Read the `.ody/history` directory, iterate its entries, and for each:
   - If it is a directory matching `YYYY-MM-DD`, read `tasks.md` and `progress.md` within it.
   - If it is a `.md` file matching the legacy `archive-YYYY-MM-DD.md` pattern, treat it as a legacy entry.
   - Group everything by date and sort descending (newest first).

4. **Update `parseTaskCountFromArchive`** — Support both the CLI format (`Total tasks archived: N`) and the existing desktop format (`## Tasks (N)`) for backwards compatibility with any legacy files.

5. **Redesign `ArchiveViewer.tsx`** — Render a list of date-grouped cards. Each card shows the date as a header and contains:
   - A task count summary (e.g., "37 archived tasks").
   - Separate "Tasks" and "Progress" toggle buttons/sections that expand to show the respective file content.
   - For legacy entries, a single "View" toggle.
   - Maintain the existing visual style (panel backgrounds, border styling, text sizing).

6. **Update the `archive:compact` handler** — Align the desktop compact handler to also write to `.ody/history/` using the same date-subdirectory format as the CLI, ensuring future compactions from the desktop are compatible. Update file writing logic to produce `tasks.md` and `progress.md` matching the CLI format.

7. **Clean up references** — Rename `resolveArchivesDirPath` to `resolveHistoryDirPath` across all usages. Remove any references to `.ody/archives/` that are no longer needed.

## Acceptance Criteria

1. **Archives from CLI compact are visible in desktop**
   - Given the user has run `ody compact` from the CLI, producing date-subdirectories under `.ody/history/`
   - When the user opens the Archive view in the desktop app
   - Then all archived date entries are listed, sorted newest first, showing task counts and expandable content

2. **Date-grouped display reflects directory structure**
   - Given `.ody/history/` contains subdirectories like `2026-02-21/` and `2026-02-24/`
   - When the archive list loads
   - Then each date appears as a distinct group with separate Tasks and Progress sections that can be independently expanded

3. **Legacy flat archive files are supported**
   - Given `.ody/history/` contains a legacy file like `archive-2026-02-13.md`
   - When the archive list loads
   - Then the legacy file appears as an entry under its extracted date (`2026-02-13`) with viewable content

4. **Task count parsing works for CLI format**
   - Given a `tasks.md` file containing `Total tasks archived: 37`
   - When the archive list is built
   - Then the entry shows "37 archived tasks"

5. **Desktop compact writes to history directory**
   - Given the user triggers "Archive completed tasks" from the desktop Task Board
   - When the compact operation completes
   - Then the archive files are written to `.ody/history/YYYY-MM-DD/` with `tasks.md` and `progress.md`, matching the CLI format

6. **Empty and error states still work**
   - Given `.ody/history/` does not exist or is empty
   - When the archive list loads
   - Then the "No archives yet" empty state is displayed without errors

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, archive, bug-fix, ipc
