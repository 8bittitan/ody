---
status: completed
created: 2026-02-20
started: 2026-02-21
completed: 2026-02-21
---
# Task: Opencode Model Selection via `opencode models` During Init

## Description

When the user runs `ody init` and selects `opencode` as their backend, instead of presenting a free-form `text` prompt for the model, call the `opencode models` CLI command, parse its output into a list of available model IDs, and present an `autocomplete` prompt so the user can search and select one. If the command fails or returns no models, fall back gracefully to the existing free-form `text` prompt.

## Background

Currently, `ody init` prompts for the model using a plain `text` prompt with no validation or suggestions (see `packages/cli/src/cmd/init.ts`, the `model` prompt section). The `opencode` binary supports a `models` subcommand that lists all available models. The `@clack/prompts` package (v1.0.1) already used in this project exposes an `autocomplete` prompt that supports type-ahead filtering — the same prompt type already used for backend selection. The config field `model` accepts a plain string and is saved to `.ody/ody.json`.

## Technical Requirements

1. After the user selects `opencode` as the backend (either via `--backend` arg or the autocomplete prompt), spawn `opencode models` using `Bun.spawn` and capture its stdout.
2. Parse the stdout output to extract a list of model identifiers. Determine the exact output format of `opencode models` by running it and examining its structure; parse accordingly (e.g., one model ID per line, or JSON array).
3. If the command succeeds and returns at least one model, present an `autocomplete` prompt (from `@clack/prompts`) with the parsed model list so the user can search and select a model. The user must also be able to leave the selection blank/skip to use the backend default.
4. If the command fails (non-zero exit, binary not found, or empty output), fall back to the existing free-form `text` prompt with the current placeholder text.
5. The selected model value (or blank) must be passed through the existing `model` config field unchanged — no changes to the config schema or `Config` class are needed.
6. Do not change behavior for `claude` or `codex` backends — the free-form `text` prompt remains for those.

## Dependencies

- `opencode` binary must be in `PATH` (already guaranteed at this point in the init flow, since backend detection uses `Bun.which('opencode')`).
- `@clack/prompts` v1.0.1 — `autocomplete` prompt is already available; no new dependencies needed.
- `Bun.spawn` — already used elsewhere in the codebase for process spawning.

## Implementation Approach

1. In `packages/cli/src/cmd/init.ts`, after the backend is determined to be `opencode`, add a helper (or inline logic) that runs `Bun.spawn(['opencode', 'models'], { stdout: 'pipe' })`, awaits `proc.exited`, reads stdout with `TextDecoder`, and parses the result into `string[]` of model IDs.
2. Determine the output format of `opencode models` by running the command and inspecting output. Implement parsing accordingly (e.g., `output.trim().split('\n').filter(Boolean)` for line-delimited output, or `JSON.parse` for JSON).
3. If parsing yields a non-empty array, replace the `text` model prompt for opencode with:
   ```ts
   const model = await autocomplete({
     message: 'Select a model to use with OpenCode',
     placeholder: 'Type to search, leave blank for default',
     options: [
       { label: 'Default (backend decides)', value: '' },
       ...models.map(m => ({ label: m, value: m })),
     ],
   });
   ```
4. If parsing yields an empty array or the spawn throws, log a warning with `log.warn` and fall back to the existing `text` prompt.
5. Ensure the resulting `model` value (empty string or model ID string) is handled the same way as before — passed to `Config.parse()` and saved.

## Acceptance Criteria

1. **Model list fetched and displayed for opencode**
   - Given `opencode` is installed and `opencode models` returns a non-empty list
   - When the user runs `ody init` and selects `opencode` as the backend
   - Then an `autocomplete` prompt is shown with all available models plus a "Default" option, allowing the user to type to filter

2. **Selected model saved to config**
   - Given the user selects a specific model from the autocomplete list
   - When init completes
   - Then `.ody/ody.json` contains `"model": "<selected-model-id>"`

3. **Default (blank) selection works**
   - Given the user selects the "Default" option or submits empty
   - When init completes
   - Then `.ody/ody.json` does not include a `model` key, or it is empty/omitted per existing behavior

4. **Graceful fallback when `opencode models` fails**
   - Given `opencode models` exits with a non-zero code or returns empty output
   - When the user runs `ody init` and selects `opencode`
   - Then a warning is logged and the free-form `text` prompt is shown instead

5. **Non-opencode backends unaffected**
   - Given the user selects `claude` or `codex` as the backend
   - When the model prompt is reached
   - Then the existing free-form `text` prompt is shown, unchanged

## Metadata
- **Complexity**: Low
- **Labels**: init, opencode, models, autocomplete, ux
