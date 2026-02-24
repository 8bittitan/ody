---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Extract @internal/tasks Package

## Description
Extract task file utilities (parsing, listing, filtering, status management) from `@ody/cli` into a new `@internal/tasks` workspace package. This requires replacing Bun-specific APIs (`Bun.Glob`, `Bun.file().text()`) with Node.js-compatible alternatives.

## Background
`@internal/tasks` provides utilities for working with `.code-task.md` files: parsing frontmatter, extracting titles and descriptions, filtering by label, scanning directories, and checking task status. Currently these live in `packages/cli/src/util/task.ts` and `packages/cli/src/types/task.ts`. The main refactoring effort is replacing `Bun.Glob` with a Node-compatible glob solution and `Bun.file().text()` with `node:fs/promises` readFile.

## Technical Requirements
1. Create `internal/tasks/` directory with `package.json`, `tsconfig.json`, and `src/index.ts` barrel export
2. Move `packages/cli/src/util/task.ts` to `internal/tasks/src/task.ts` with these refactors:
   - Replace `Bun.Glob` with `node:fs` recursive readdir + manual `*.code-task.md` filtering, or use `fast-glob` library
   - Replace `Bun.file(path).text()` with `readFile(path, 'utf-8')` from `node:fs/promises`
3. Move `packages/cli/src/types/task.ts` to `internal/tasks/src/types.ts` (no changes -- pure types)
4. Package depends on `@internal/config` (for `BASE_DIR`, `TASKS_DIR`, config access)
5. All functions must be preserved: `resolveTasksDir`, `parseFrontmatter`, `parseTitle`, `parseDescription`, `getTaskFilesByLabel`, `getTaskFilesInDir`, `getTaskFilesInTasksDir`, `getTaskStatus`, `getTaskStates`, `mapWithConcurrency`
6. Export types: `TaskState`, `CompletedTask`

## Dependencies
- `extract-internal-config` task must be completed first

## Implementation Approach
1. Create `internal/tasks/` directory structure:
   ```
   internal/tasks/
     package.json
     tsconfig.json
     src/
       index.ts
       task.ts
       types.ts
   ```
2. Write `package.json` with `@internal/config` dependency. If using `fast-glob`, add it as a dependency; otherwise use `node:fs` readdir with recursive option
3. Write `tsconfig.json` extending root config
4. Copy `types.ts` from CLI without modification
5. Copy `task.ts` from CLI and refactor:
   - Replace glob scanning:
     ```typescript
     import { readdir } from 'node:fs/promises';
     
     async function getTaskFilesInDir(tasksDir: string): Promise<string[]> {
       const entries = await readdir(tasksDir);
       return entries
         .filter(f => f.endsWith('.code-task.md'))
         .sort();
     }
     ```
   - Replace file reading:
     ```typescript
     import { readFile } from 'node:fs/promises';
     const content = await readFile(filePath, 'utf-8');
     ```
6. Create barrel export with all public API members
7. Run `bun install` and verify workspace resolution

## Acceptance Criteria

1. **Package Structure**
   - Given the `internal/tasks/` directory
   - When inspecting its contents
   - Then it contains `package.json`, `tsconfig.json`, and `src/` with `index.ts`, `task.ts`, `types.ts`

2. **No Bun APIs**
   - Given the `internal/tasks/src/` files
   - When searching for `Bun.` references
   - Then none are found

3. **Task Scanning Works**
   - Given a directory containing `.code-task.md` files
   - When calling `getTaskFilesInDir()`
   - Then it returns the sorted list of task filenames

4. **Frontmatter Parsing**
   - Given a task file with YAML frontmatter
   - When calling `parseFrontmatter(content)`
   - Then it correctly extracts key-value pairs from between `---` delimiters

5. **Exports Complete**
   - Given the barrel export
   - When checking exported members
   - Then it exports all 10 functions plus `TaskState` and `CompletedTask` types

## Metadata
- **Complexity**: Medium
- **Labels**: extraction, internal-packages, tasks
