---
status: completed
created: 2026-03-11
started: 2026-03-11
completed: 2026-03-11
---
# Task: Add Resolve PR Comment Command

## Description
Add a new `ody resolve` CLI command that lets a user run the configured agent against a GitHub pull request comment. The command should gather the target PR comment context, instruct the agent to form an execution plan in memory, and then apply code changes locally to address the comment without posting back to GitHub or pushing changes.

## Background
The CLI already launches interactive agent workflows and has existing GitHub integration, backend selection, and prompt-building infrastructure. This feature extends that model from planning and review into PR comment resolution. The user wants the CLI to support both inline review comments and top-level PR conversation comments. For ergonomics, the command should accept an optional GitHub comment URL, but when the URL is omitted it should default to discovering the pull request associated with the current branch and let the user choose from available PR comments. The agent should be allowed to inspect the comment, form a plan internally, and then execute locally. A dry-run mode is needed so users can preview the intended work before any files are modified.

## Technical Requirements
1. Register a new top-level `resolve` subcommand in `packages/cli/src/index.ts` and implement it under `packages/cli/src/cmd/` using the repository's standard `defineCommand` pattern.
2. Support targeting both GitHub pull request review comments and top-level issue comments on pull requests.
3. Accept an optional GitHub comment URL argument; when provided, validate and resolve it to a supported PR comment, and fail with a clear user-facing error if the URL is malformed or does not reference a PR comment.
4. When no comment URL is provided, resolve the pull request associated with the current branch, list resolvable comments for that PR, and allow the user to select one comment to act on.
5. Provide a dry-run option that shows a brief plan summary before execution and does not apply any file changes.
6. In execution mode, launch the configured backend harness with a purpose-built resolve prompt that includes the selected PR comment context, directs the agent to keep its detailed plan in memory, and limits actions to local code changes only.
7. Reuse existing configuration, backend, GitHub authentication, and GitHub API client flows rather than introducing a separate resolution-specific auth or transport layer.

## Dependencies
- Existing interactive command and backend-launch patterns in `packages/cli/src/cmd/plan.ts` and related CLI command modules, which should guide command structure, config loading, and harness invocation.
- Existing GitHub auth and API infrastructure in `@internal/auth` and `@internal/integrations`, which should be extended or reused to fetch PR, review comment, and issue comment data.
- Prompt construction utilities in `@internal/builders`, which should provide the resolve-specific instructions and dry-run/execution variants.
- Existing branch/PR context handling, if available, or new GitHub lookup logic that can map the current branch to its pull request without changing remote state.

## Implementation Approach
1. Add the `resolve` command, define its arguments and flags, and wire it into the CLI entrypoint with support for an optional comment URL plus a dry-run mode.
2. Implement comment-target resolution logic that can either parse a provided GitHub comment URL or discover the current branch PR and present a selectable list of supported comments.
3. Build a resolve-specific prompt that supplies the comment text, surrounding PR context, and explicit instructions to analyze the request, keep the full plan internal, optionally emit a short dry-run summary, and make only local code changes in execution mode.
4. Connect the resolved comment context and prompt into the existing backend harness launch flow, preserving the current configuration and authentication model.
5. Add tests for command registration, argument validation, comment-type handling, fallback selection flow, dry-run behavior, and prompt construction.

## Acceptance Criteria

1. **Resolve From Comment URL**
   - Given a valid GitHub URL for a pull request review comment or PR issue comment
   - When the user runs `ody resolve <comment-url>`
   - Then the CLI resolves that comment, builds a resolve-specific agent prompt, and starts the workflow without requiring manual PR selection

2. **Resolve From Current Branch PR**
   - Given the user is on a branch associated with an open pull request and does not pass a comment URL
   - When the user runs `ody resolve`
   - Then the CLI discovers the pull request, lists supported comments, and lets the user select one comment to resolve

3. **Dry Run Preview**
   - Given a valid target comment and the dry-run option is enabled
   - When the resolve workflow starts
   - Then the CLI shows a brief execution plan summary and does not apply file changes

4. **Local-Only Execution**
   - Given the user runs the command in execution mode
   - When the agent acts on the selected comment
   - Then the workflow is instructed to make local code changes only and not post GitHub replies, submit reviews, push branches, or otherwise modify remote state

5. **Unsupported Target Handling**
   - Given the user passes a malformed URL or a GitHub URL that does not point to a supported PR comment
   - When the command is invoked
   - Then the CLI exits with a clear error explaining what inputs are supported

## Metadata
- **Complexity**: High
- **Labels**: cli, github, pull-request, comments, agent, dry-run
