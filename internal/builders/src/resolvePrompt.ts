type ResolvePullRequest = {
  number: number;
  title: string;
  body: string;
  url: string;
  state: string;
  baseRefName: string;
  headRefName: string;
  author: string;
};

type ResolveComment = {
  kind: 'issue_comment' | 'review_comment';
  id: number;
  author: string;
  body: string;
  url: string;
  createdAt: string;
  path?: string | null;
  line?: number | null;
  diffHunk?: string | null;
};

type BuildResolvePromptParams = {
  comment: ResolveComment;
  dryRun?: boolean;
  pullRequest: ResolvePullRequest;
};

function formatOptionalBlock(label: string, value: string | null | undefined) {
  if (!value) {
    return `${label}: (none)`;
  }

  return `${label}:\n${value}`;
}

function formatCommentContext(comment: ResolveComment) {
  const lines = [
    `Comment type: ${comment.kind === 'review_comment' ? 'Inline review comment' : 'Top-level PR comment'}`,
    `Comment URL: ${comment.url}`,
    `Author: ${comment.author}`,
    `Created at: ${comment.createdAt}`,
    `Body:\n${comment.body || '(empty)'}`,
  ];

  if (comment.kind === 'review_comment') {
    lines.push(`File path: ${comment.path ?? '(unknown)'}`);
    lines.push(`Line: ${comment.line ?? '(unknown)'}`);
    lines.push(formatOptionalBlock('Diff hunk', comment.diffHunk));
  }

  return lines.join('\n\n');
}

export function buildResolvePrompt({
  comment,
  dryRun = false,
  pullRequest,
}: BuildResolvePromptParams) {
  const modeSection = dryRun
    ? `MODE\n- Dry run only. Inspect the repository and comment request, then output a brief implementation plan summary.\n- Do not modify any files.\n- Do not stage, commit, push, post to GitHub, or change remote state.`
    : `MODE\n- Execution mode. Inspect the repository, keep your detailed plan internal, and apply the requested fix locally.\n- Limit actions to local code changes only.\n- Do not post replies to GitHub, submit reviews, push branches, create remote state, or open pull requests.\n- Do not create commits unless the user explicitly asks.`;

  return `# Resolve Pull Request Comment

You are addressing a GitHub pull request comment inside the local repository checkout.

${modeSection}

WORKFLOW
1. Read the pull request context and the selected comment.
2. Infer the requested change, inspect the relevant code, and decide what needs to change.
3. Keep the full execution plan in memory. Do not print the full chain-of-thought.
4. In dry-run mode, provide only a short summary of the intended work.
5. In execution mode, implement the change locally, then summarize what changed and any follow-up risks.

PULL REQUEST CONTEXT
Repository pull request: #${pullRequest.number}
Title: ${pullRequest.title}
URL: ${pullRequest.url}
State: ${pullRequest.state}
Author: ${pullRequest.author}
Base branch: ${pullRequest.baseRefName}
Head branch: ${pullRequest.headRefName}

${formatOptionalBlock('Pull request body', pullRequest.body)}

SELECTED COMMENT
${formatCommentContext(comment)}

OUTPUT EXPECTATIONS
- Focus on resolving the selected comment.
- If the comment is unclear or not actionable, explain the blocker briefly instead of guessing.
- Preserve existing project conventions and validation expectations.
- ${dryRun ? 'Return a concise plan summary only.' : 'Return a concise summary of the local code changes you made.'}
`.trim();
}
