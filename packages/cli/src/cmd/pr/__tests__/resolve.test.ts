import { afterEach, describe, expect, test } from 'bun:test';

import { buildResolvePrompt } from '@internal/builders';
import type { GitHubPullRequest } from '@internal/integrations';

import type { ResolvableComment } from '../resolve';
import { parseGitHubCommentUrl, parseGitHubRemoteUrl, runResolve } from '../resolve';

function createPullRequest(): GitHubPullRequest {
  return {
    author: 'octocat',
    baseRefName: 'main',
    body: 'Fix the edge case in the resolver.',
    headOwner: 'acme',
    headRefName: 'feature/resolve',
    number: 123,
    state: 'open',
    title: 'Improve resolve command',
    url: 'https://github.com/acme/ody/pull/123',
  };
}

function createDeps() {
  const messages = {
    errors: [] as string[],
    info: [] as string[],
    warn: [] as string[],
  };
  const calls = {
    backend: [] as Array<{ selectedBackend: string; config: Record<string, unknown> }>,
    buildCommand: [] as Array<{ prompt: string; model: string | undefined }>,
    buildInteractiveCommand: [] as Array<{ prompt: string; model: string | undefined }>,
    nonInteractive: [] as Array<{
      prompt: string;
      model: string | undefined;
      verbose: boolean | undefined;
    }>,
    exits: [] as number[],
    fetchIssueComment: [] as number[],
    fetchPullRequest: [] as number[],
    fetchPullRequestIssueComments: [] as number[],
    fetchPullRequestReviewComments: [] as number[],
    fetchReviewComment: [] as number[],
    findOpenPullRequestByBranch: [] as string[],
    promptSelections: [] as string[],
    resolveModel: [] as string[],
  };

  const config = {
    backend: 'codex' as const,
    agent: 'build',
    github: {
      profile: 'work',
    },
    model: {
      run: 'run-model',
      plan: 'plan-model',
      edit: 'edit-model',
    },
    skipPermissions: true,
  };

  const deps = {
    buildPrompt: (input: Parameters<typeof buildResolvePrompt>[0]) =>
      `prompt:${input.pullRequest.number}:${input.comment.id}:${input.dryRun ? 'dry' : 'live'}`,
    createBackend: (selectedBackend: string, backendConfig: Record<string, unknown>) => {
      calls.backend.push({ selectedBackend, config: backendConfig });

      return {
        buildCommand(prompt: string, model?: string) {
          calls.buildCommand.push({ prompt, model });
          return ['agent', 'dry', prompt, model ?? ''];
        },
        buildInteractiveCommand(prompt: string, model?: string) {
          calls.buildInteractiveCommand.push({ prompt, model });
          return ['agent', 'interactive', prompt, model ?? ''];
        },
      };
    },
    executeNonInteractive: async (
      backend: { buildCommand(prompt: string, model?: string): string[] },
      prompt: string,
      options?: { model?: string; verbose?: boolean },
    ) => {
      backend.buildCommand(prompt, options?.model);
      calls.nonInteractive.push({
        prompt,
        model: options?.model,
        verbose: options?.verbose,
      });
      return 0;
    },
    executeInteractive: async (
      backend: { buildInteractiveCommand(prompt: string, model?: string): string[] },
      prompt: string,
      model?: string,
    ) => {
      backend.buildInteractiveCommand(prompt, model);
      return 0;
    },
    exit: (code: number) => {
      calls.exits.push(code);
      throw new Error(`process.exit(${code})`);
    },
    getConfig: () => config,
    getCurrentBranch: async () => 'feature/resolve',
    getGitHubToken: async () => 'ghs_test',
    getOriginRemoteUrl: async () => 'git@github.com:acme/ody.git',
    gitHub: {
      fetchIssueComment: async (_owner: string, _repo: string, commentId: number) => {
        calls.fetchIssueComment.push(commentId);
        return {
          author: 'alice',
          body: 'Please update the error handling.',
          createdAt: '2026-03-11T09:00:00Z',
          id: commentId,
          kind: 'issue_comment' as const,
          pullRequestNumber: 123,
          url: `https://github.com/acme/ody/pull/123#issuecomment-${commentId}`,
        };
      },
      fetchPullRequest: async (_owner: string, _repo: string, pullRequestNumber: number) => {
        calls.fetchPullRequest.push(pullRequestNumber);
        return createPullRequest();
      },
      fetchPullRequestIssueComments: async (
        _owner: string,
        _repo: string,
        pullRequestNumber: number,
      ) => {
        calls.fetchPullRequestIssueComments.push(pullRequestNumber);
        return [
          {
            author: 'alice',
            body: 'Please update the error handling.',
            createdAt: '2026-03-11T09:00:00Z',
            id: 456,
            kind: 'issue_comment' as const,
            pullRequestNumber,
            url: 'https://github.com/acme/ody/pull/123#issuecomment-456',
          },
        ];
      },
      fetchPullRequestReviewComments: async (
        _owner: string,
        _repo: string,
        pullRequestNumber: number,
      ) => {
        calls.fetchPullRequestReviewComments.push(pullRequestNumber);
        return [
          {
            author: 'bob',
            body: 'This branch lookup should be extracted.',
            createdAt: '2026-03-11T10:00:00Z',
            diffHunk: '@@ -1,1 +1,1 @@',
            id: 789,
            kind: 'review_comment' as const,
            line: 42,
            path: 'packages/cli/src/cmd/resolve.ts',
            pullRequestNumber,
            url: 'https://github.com/acme/ody/pull/123#discussion_r789',
          },
        ];
      },
      fetchReviewComment: async (_owner: string, _repo: string, commentId: number) => {
        calls.fetchReviewComment.push(commentId);
        return {
          author: 'bob',
          body: 'This branch lookup should be extracted.',
          createdAt: '2026-03-11T10:00:00Z',
          diffHunk: '@@ -1,1 +1,1 @@',
          id: commentId,
          kind: 'review_comment' as const,
          line: 42,
          path: 'packages/cli/src/cmd/resolve.ts',
          pullRequestNumber: 123,
          url: `https://github.com/acme/ody/pull/123#discussion_r${commentId}`,
        };
      },
      findOpenPullRequestByBranch: async (
        _owner: string,
        _repo: string,
        branch: string,
      ): Promise<GitHubPullRequest | undefined> => {
        calls.findOpenPullRequestByBranch.push(branch);
        return createPullRequest();
      },
    },
    log: {
      error(message: string) {
        messages.errors.push(message);
      },
      info(message: string) {
        messages.info.push(message);
      },
      warn(message: string) {
        messages.warn.push(message);
      },
    },
    promptForCommentSelection: async (comments: ResolvableComment[]) => {
      calls.promptSelections.push(comments.map((comment) => String(comment.id)).join(','));
      return comments.find((comment) => comment.id === 789);
    },
    resolveModel: () => {
      calls.resolveModel.push('resolve');
      return 'run-model';
    },
  };

  return {
    calls,
    deps,
    messages,
  };
}

describe('parseGitHubCommentUrl', () => {
  test('accepts top-level pull request issue comment URLs', () => {
    expect(parseGitHubCommentUrl('https://github.com/acme/ody/pull/123#issuecomment-456')).toEqual({
      owner: 'acme',
      repo: 'ody',
      pullRequestNumber: 123,
      commentId: 456,
      kind: 'issue_comment',
    });
  });

  test('accepts inline pull request review comment URLs', () => {
    expect(parseGitHubCommentUrl('https://github.com/acme/ody/pull/123#discussion_r789')).toEqual({
      owner: 'acme',
      repo: 'ody',
      pullRequestNumber: 123,
      commentId: 789,
      kind: 'review_comment',
    });
  });

  test('rejects unsupported GitHub URLs', () => {
    expect(() => parseGitHubCommentUrl('https://github.com/acme/ody/issues/123')).toThrow(
      'A valid GitHub pull request comment URL is required.',
    );
  });
});

describe('parseGitHubRemoteUrl', () => {
  test('parses SSH remotes', () => {
    expect(parseGitHubRemoteUrl('git@github.com:acme/ody.git')).toEqual({
      owner: 'acme',
      repo: 'ody',
    });
  });

  test('parses HTTPS remotes', () => {
    expect(parseGitHubRemoteUrl('https://github.com/acme/ody.git')).toEqual({
      owner: 'acme',
      repo: 'ody',
    });
  });
});

describe('runResolve', () => {
  afterEach(() => {
    process.exitCode = 0;
  });

  test('launches the non-interactive resolve harness by default for a direct issue comment URL', async () => {
    const { deps, calls, messages } = createDeps();

    await runResolve({ commentUrl: 'https://github.com/acme/ody/pull/123#issuecomment-456' }, deps);

    expect(messages.info).toEqual(['Launching resolve harness']);
    expect(calls.fetchIssueComment).toEqual([456]);
    expect(calls.fetchPullRequest).toEqual([123]);
    expect(calls.nonInteractive).toEqual([
      { prompt: 'prompt:123:456:live', model: 'run-model', verbose: undefined },
    ]);
    expect(calls.buildInteractiveCommand).toHaveLength(0);
  });

  test('discovers the current branch pull request and lets the user choose a comment', async () => {
    const { deps, calls, messages } = createDeps();

    await runResolve({}, deps);

    expect(messages.info).toEqual(['Launching resolve harness']);
    expect(calls.findOpenPullRequestByBranch).toEqual(['feature/resolve']);
    expect(calls.fetchPullRequestIssueComments).toEqual([123]);
    expect(calls.fetchPullRequestReviewComments).toEqual([123]);
    expect(calls.promptSelections).toEqual(['789,456']);
    expect(calls.nonInteractive).toEqual([
      { prompt: 'prompt:123:789:live', model: 'run-model', verbose: undefined },
    ]);
    expect(calls.buildInteractiveCommand).toHaveLength(0);
  });

  test('uses dry-run mode to preview the resolve plan without interactive execution', async () => {
    const { deps, calls, messages } = createDeps();

    await runResolve(
      { commentUrl: 'https://github.com/acme/ody/pull/123#discussion_r789', dryRun: true },
      deps,
    );

    expect(messages.info).toEqual(['Previewing resolve plan']);
    expect(calls.fetchReviewComment).toEqual([789]);
    expect(calls.nonInteractive).toEqual([
      { prompt: 'prompt:123:789:dry', model: 'run-model', verbose: undefined },
    ]);
    expect(calls.buildInteractiveCommand).toHaveLength(0);
  });

  test('passes verbose through for non-interactive execution', async () => {
    const { deps, calls } = createDeps();

    await runResolve(
      {
        commentUrl: 'https://github.com/acme/ody/pull/123#issuecomment-456',
        verbose: true,
      },
      deps,
    );

    expect(calls.nonInteractive).toEqual([
      { prompt: 'prompt:123:456:live', model: 'run-model', verbose: true },
    ]);
  });

  test('uses interactive execution when the interactive flag is enabled', async () => {
    const { deps, calls, messages } = createDeps();

    await runResolve(
      {
        commentUrl: 'https://github.com/acme/ody/pull/123#issuecomment-456',
        interactive: true,
      },
      deps,
    );

    expect(messages.info).toEqual(['Launching interactive resolve harness']);
    expect(calls.buildInteractiveCommand).toEqual([
      { prompt: 'prompt:123:456:live', model: 'run-model' },
    ]);
    expect(calls.nonInteractive).toHaveLength(0);
  });

  test('warns when dry-run is ignored in interactive mode', async () => {
    const { deps, calls, messages } = createDeps();

    await runResolve(
      {
        commentUrl: 'https://github.com/acme/ody/pull/123#discussion_r789',
        dryRun: true,
        interactive: true,
      },
      deps,
    );

    expect(messages.warn).toEqual(['Ignoring --dry-run because interactive mode is enabled.']);
    expect(calls.buildInteractiveCommand).toEqual([
      { prompt: 'prompt:123:789:live', model: 'run-model' },
    ]);
    expect(calls.nonInteractive).toHaveLength(0);
  });

  test('fails with a clear error for unsupported comment URLs', async () => {
    const { deps, calls, messages } = createDeps();

    await expect(
      runResolve({ commentUrl: 'https://github.com/acme/ody/issues/123' }, deps),
    ).rejects.toThrow('process.exit(1)');

    expect(messages.errors).toEqual([
      'A valid GitHub pull request comment URL is required. Supported URLs look like https://github.com/owner/repo/pull/123#issuecomment-456 or https://github.com/owner/repo/pull/123#discussion_r789.',
    ]);
    expect(calls.buildInteractiveCommand).toHaveLength(0);
  });

  test('fails when no open pull request exists for the current branch', async () => {
    const { deps, messages, calls } = createDeps();

    deps.gitHub.findOpenPullRequestByBranch = async (): Promise<GitHubPullRequest | undefined> =>
      undefined;

    await expect(runResolve({}, deps)).rejects.toThrow('process.exit(1)');
    expect(messages.errors).toEqual(['No open pull request found for branch "feature/resolve".']);
    expect(calls.buildInteractiveCommand).toHaveLength(0);
  });
});

describe('buildResolvePrompt', () => {
  test('includes local-only execution constraints', () => {
    const prompt = buildResolvePrompt({
      comment: {
        author: 'alice',
        body: 'Please update the error handling.',
        createdAt: '2026-03-11T09:00:00Z',
        id: 456,
        kind: 'issue_comment',
        url: 'https://github.com/acme/ody/pull/123#issuecomment-456',
      },
      pullRequest: createPullRequest(),
    });

    expect(prompt).toContain('keep your detailed plan internal');
    expect(prompt).toContain('Do not post replies to GitHub');
    expect(prompt).toContain('Please update the error handling.');
  });

  test('switches to a no-write preview mode for dry runs', () => {
    const prompt = buildResolvePrompt({
      comment: {
        author: 'bob',
        body: 'This branch lookup should be extracted.',
        createdAt: '2026-03-11T10:00:00Z',
        diffHunk: '@@ -1,1 +1,1 @@',
        id: 789,
        kind: 'review_comment',
        line: 42,
        path: 'packages/cli/src/cmd/resolve.ts',
        url: 'https://github.com/acme/ody/pull/123#discussion_r789',
      },
      dryRun: true,
      pullRequest: createPullRequest(),
    });

    expect(prompt).toContain('Do not modify any files.');
    expect(prompt).toContain('packages/cli/src/cmd/resolve.ts');
    expect(prompt).toContain('Return a concise plan summary only.');
  });
});
