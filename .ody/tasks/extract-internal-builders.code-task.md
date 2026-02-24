---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Extract @internal/builders Package

## Description
Extract all prompt template builders from `@ody/cli` into a new `@internal/builders` workspace package. This includes run, plan, batch plan, edit plan, and import prompt builders. Additionally, create a new `buildInlineEditPrompt()` builder for the desktop editor's Cmd+K AI edit flow.

## Background
`@internal/builders` contains pure string template functions that construct prompts for the various agent operations. These are already pure functions with no side effects or Bun-specific APIs. The only new work is creating `inlineEditPrompt.ts` for the desktop's inline editing feature. Currently the builders live in `packages/cli/src/builders/`.

## Technical Requirements
1. Create `internal/builders/` directory with `package.json`, `tsconfig.json`, and `src/index.ts` barrel export
2. Move files from `packages/cli/src/builders/` to `internal/builders/src/`:
   - `shared.ts` -- no changes (pure constant `TASK_FILE_FORMAT`)
   - `runPrompt.ts` -- no changes (pure string templates, exports `buildRunPrompt`, `LOOP_PROMPT`, `SINGLE_TASK_PROMPT`)
   - `planPrompt.ts` -- no changes (exports `buildPlanPrompt` and `buildBatchPlanPrompt`)
   - `editPlanPrompt.ts` -- no changes (exports `buildEditPlanPrompt`)
   - `importPrompt.ts` -- no changes (exports `buildImportPrompt` and `ImportSource` type)
3. Create new `inlineEditPrompt.ts`:
   - Export `buildInlineEditPrompt({ fileContent, selection?, instruction })` function
   - Takes file content (string), optional selection range `{ from: number; to: number }`, and user instruction (string)
   - Constructs a prompt instructing the agent to output the complete modified file
   - If selection is provided, the prompt should reference the specific region to focus edits on
4. Package depends on `@internal/config` (workspace dependency)
5. `package.json`: `name: "@internal/builders"`, `version: "0.0.1"`, `private: true`, `type: "module"`

## Dependencies
- `extract-internal-config` task must be completed first

## Implementation Approach
1. Create `internal/builders/` directory structure:
   ```
   internal/builders/
     package.json
     tsconfig.json
     src/
       index.ts
       shared.ts
       runPrompt.ts
       planPrompt.ts
       editPlanPrompt.ts
       importPrompt.ts
       inlineEditPrompt.ts
   ```
2. Write `package.json` with `@internal/config` dependency
3. Write `tsconfig.json` extending root config
4. Copy all existing builder files from CLI without modification
5. Create `inlineEditPrompt.ts` with the following approach:
   - Accept `{ fileContent: string; selection?: { from: number; to: number }; instruction: string }`
   - Build a prompt that provides the full file content
   - If selection is provided, indicate the line range or character range to focus on
   - Instruct the agent to apply the user's instruction and output the complete modified file
   - Include clear markers so the agent's output can be parsed
6. Create barrel export with all public API members
7. Run `bun install` and verify workspace resolution

## Acceptance Criteria

1. **Package Structure**
   - Given the `internal/builders/` directory
   - When inspecting its contents
   - Then it contains all builder source files including the new `inlineEditPrompt.ts`

2. **Existing Builders Unchanged**
   - Given the moved builder files
   - When comparing to their originals in CLI
   - Then they are functionally identical

3. **Inline Edit Prompt Builder Works**
   - Given `buildInlineEditPrompt` with file content and an instruction
   - When called without a selection
   - Then it produces a prompt referencing the full file

4. **Inline Edit Prompt With Selection**
   - Given `buildInlineEditPrompt` with file content, a selection range, and an instruction
   - When called
   - Then it produces a prompt referencing the specific selected region

5. **Exports Complete**
   - Given the barrel export
   - When checking exported members
   - Then it exports `buildRunPrompt`, `LOOP_PROMPT`, `SINGLE_TASK_PROMPT`, `buildPlanPrompt`, `buildBatchPlanPrompt`, `buildEditPlanPrompt`, `buildImportPrompt`, `ImportSource`, `buildInlineEditPrompt`, and `TASK_FILE_FORMAT`

## Metadata
- **Complexity**: Medium
- **Labels**: extraction, internal-packages, builders
