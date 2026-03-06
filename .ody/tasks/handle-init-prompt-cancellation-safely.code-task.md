---
status: completed
created: 2026-03-06
started: 2026-03-06
completed: 2026-03-06
---
# Task: Handle `ody init` Prompt Cancellation Without Persisting Invalid Values

## Description
The interactive `ody init` flow currently converts some cancelled prompt results to strings without checking `isCancel()`, which can persist cancellation sentinel values into the generated config. Fix prompt handling so cancellation exits cleanly and no invalid `model` or `agent` values are written to `.ody/ody.json`.

## Background
In `packages/cli/src/cmd/init.ts`, several `text()` prompt results are immediately coerced with `.toString()`. For backend model selection fallback and agent entry, that means a cancelled prompt result can become a literal string such as `Symbol(clack:cancel)` and then be saved into config.

Other prompts in the same file already guard with `isCancel()` and exit cleanly, so the current behavior is inconsistent and user-hostile. It can also lead to subtle downstream bugs when later commands resolve the saved `model` or `agent` values.

## Technical Requirements
1. Cancelling any interactive `model` prompt in `ody init` must stop the flow cleanly without saving invalid config
2. Cancelling the interactive `agent` prompt must also stop the flow cleanly without saving invalid config
3. No cancelled prompt result may be converted with `.toString()` and persisted into `configInput`
4. Existing successful prompt behavior for blank input vs explicit values must remain intact
5. The `--dry-run` path must continue to show the would-be config only when the prompts completed successfully

## Dependencies
- `packages/cli/src/cmd/init.ts` — interactive init flow and prompt handling
- `@clack/prompts` cancellation semantics via `isCancel`
- `@internal/config` parsing and serialization of the generated config

## Implementation Approach
1. Audit every interactive prompt in `packages/cli/src/cmd/init.ts` that currently calls `.toString()` on a prompt result
2. Add `isCancel()` checks before coercing or trimming prompt values for:
   - manual model entry
   - non-opencode model entry
   - agent entry
3. Reuse the existing cancellation pattern already used elsewhere in the file (`cancel(...)` / `outro(...)` + early return or exit)
4. Confirm blank-string responses are still treated as “use backend default” rather than as cancellation
5. Add focused tests if the CLI package has an established way to exercise interactive prompt helpers or extract small helpers to make this testable

## Acceptance Criteria

1. **Cancelled model prompt does not save a sentinel string**
   - Given the user cancels during model entry in `ody init`
   - When the command exits
   - Then no config is written with a `model` value like `Symbol(clack:cancel)`

2. **Cancelled agent prompt exits cleanly**
   - Given the user cancels during agent entry in `ody init`
   - When the command exits
   - Then the command stops cleanly without saving invalid config

3. **Blank input still means default**
   - Given the user submits an empty string for model or agent
   - When `ody init` completes
   - Then the config continues to omit those values or use the intended defaults

4. **Successful prompt flow still works**
   - Given the user provides valid backend, model, and agent inputs
   - When `ody init` completes
   - Then the generated config matches those values correctly

## Metadata
- **Complexity**: Low
- **Labels**: cli, init, bug-fix
