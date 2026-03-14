---
status: completed
created: 2026-03-11
started: 2026-03-11
completed: 2026-03-11
---
# Task: Add Review CLI Command

## Description
Add a new `review` CLI command to `@ody/cli` that accepts a GitHub pull request URL as a positional argument and launches an interactive review session through the configured backend harness. The command should delegate the actual PR review, discussion flow, and inline comment submission to the agent so users can steer which findings become GitHub review comments and which items should be ignored.

## Background
The CLI already has an interactive `plan` command that launches the configured backend harness directly from the terminal. This feature should follow the same interaction model, but for pull request review. The user wants the CLI to remain thin: it should validate and pass the GitHub PR URL into an agent prompt, not fetch PR data itself. Review scope is limited to the PR diff, and submitted feedback should be inline review comments only for now. Existing backend selection comes from `Config`, and GitHub credentials should continue to flow through the repo’s existing auth/config path rather than introducing a new authentication model.

## Technical Requirements
1. Register a new top-level `review` subcommand in `packages/cli/src/index.ts` and implement it under `packages/cli/src/cmd/` using `defineCommand`.
2. Accept a GitHub pull request URL as a required positional argument, validate that the argument is a plausible PR URL, and fail with a clear user-facing error when it is missing or malformed.
3. Launch the configured backend harness interactively, using a purpose-built review prompt that instructs the agent to review the specified PR diff, discuss findings with the user, ignore items when directed, and submit approved inline review comments to GitHub.
4. Keep the CLI command itself free of PR-fetching logic; all PR inspection and inline comment submission behavior must be delegated to the backend harness/agent.
5. Reuse existing configuration and GitHub authentication flows so the command works with the current backend and auth setup without adding a separate review-specific auth path.

## Dependencies
- Existing interactive command pattern in `packages/cli/src/cmd/plan.ts`, which should be used as the reference for launching the backend harness in terminal-interactive mode.
- Existing backend/config/auth infrastructure in `@internal/backends`, `@internal/config`, and `@internal/auth`, which should supply the selected harness, model, and GitHub credentials/context.
- A new or extended prompt builder in `@internal/builders` to provide explicit review instructions to the agent, including diff-only scope and inline-comment-only behavior.

## Implementation Approach
1. Add a new CLI command module and wire it into the top-level command registry, following the existing `plan` command setup/loading pattern and `Config.load()` behavior already used by the CLI.
2. Create a review-specific prompt builder that includes the PR URL, instructs the agent to retrieve and review only the PR diff, conduct an interactive review conversation with the user, and post only user-approved inline review comments back to GitHub.
3. Implement the command run path so it validates the positional URL argument, resolves the configured backend/model, launches `buildInteractiveCommand(...)`, and exits with the harness exit code on failure.
4. Add focused tests for command argument handling and prompt construction, plus any command-registry coverage needed to ensure the new subcommand is reachable.

## Acceptance Criteria

1. **Interactive Review Launch**
   - Given a valid GitHub pull request URL and a configured backend
   - When the user runs `ody review <pr-url>`
   - Then the CLI launches the backend harness interactively with a review-specific prompt instead of trying to inspect the PR locally

2. **Delegated Diff Review Behavior**
   - Given the review command is launched successfully
   - When the agent receives the prompt
   - Then the prompt directs the agent to review only the pull request diff, discuss findings with the user, and let the user decide which items to comment on or ignore

3. **Inline Comment Submission Scope**
   - Given the user approves a finding during the interactive review
   - When the agent submits feedback to GitHub
   - Then the workflow is limited to inline review comments and does not instruct the agent to submit an overall `APPROVE`, `COMMENT`, or `REQUEST_CHANGES` review state

4. **Invalid URL Handling**
   - Given the user omits the positional argument or passes a malformed PR URL
   - When the command is invoked
   - Then the CLI exits with a clear error explaining that a valid GitHub pull request URL is required

## Metadata
- **Complexity**: Medium
- **Labels**: cli, github, review, interactive, agent
