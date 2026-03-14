import { afterEach, describe, expect, test } from 'bun:test';

import { buildReviewPrompt } from '@internal/builders';

import { isGitHubPullRequestUrl, runReview } from '../review';

function createDeps() {
  const messages = {
    errors: [] as string[],
    info: [] as string[],
  };
  const calls = {
    backend: [] as Array<{ selectedBackend: string; config: Record<string, unknown> }>,
    commands: [] as Array<{ prompt: string; model: string | undefined }>,
    promptUrls: [] as string[],
    spawn: [] as string[][],
    exits: [] as number[],
    resolveModel: [] as string[],
  };

  const config = {
    backend: 'codex' as const,
    agent: 'build',
    model: 'gpt-5',
    skipPermissions: true,
  };

  return {
    calls,
    deps: {
      buildPrompt: ({ pullRequestUrl }: { pullRequestUrl: string }) => {
        calls.promptUrls.push(pullRequestUrl);
        return `prompt:${pullRequestUrl}`;
      },
      createBackend: (selectedBackend: string, backendConfig: Record<string, unknown>) => {
        calls.backend.push({ selectedBackend, config: backendConfig });

        return {
          buildInteractiveCommand(prompt: string, model?: string) {
            calls.commands.push({ prompt, model });
            return ['agent', prompt, model ?? ''];
          },
        };
      },
      exit: (code: number) => {
        calls.exits.push(code);
        throw new Error(`process.exit(${code})`);
      },
      getConfig: () => config,
      log: {
        error(message: string) {
          messages.errors.push(message);
        },
        info(message: string) {
          messages.info.push(message);
        },
      },
      resolveModel: () => {
        calls.resolveModel.push('review');
        return 'review-model';
      },
      spawn: (cmd: string[]) => {
        calls.spawn.push(cmd);

        return {
          exited: Promise.resolve(0),
        };
      },
    },
    messages,
  };
}

describe('isGitHubPullRequestUrl', () => {
  afterEach(() => {
    process.exitCode = 0;
  });

  test('accepts a standard GitHub pull request URL', () => {
    expect(isGitHubPullRequestUrl('https://github.com/acme/ody/pull/123')).toBe(true);
  });

  test('rejects non-pull GitHub URLs', () => {
    expect(isGitHubPullRequestUrl('https://github.com/acme/ody/issues/123')).toBe(false);
  });

  test('rejects malformed GitHub pull request URLs', () => {
    expect(isGitHubPullRequestUrl('not-a-url')).toBe(false);
  });
});

describe('runReview', () => {
  afterEach(() => {
    process.exitCode = 0;
  });

  test('fails with a clear error when the pull request URL is missing', async () => {
    const { deps, messages, calls } = createDeps();

    await expect(runReview({}, deps)).rejects.toThrow('process.exit(1)');
    expect(messages.errors).toEqual(['A valid GitHub pull request URL is required.']);
    expect(calls.spawn).toHaveLength(0);
  });

  test('fails with a clear error when the pull request URL is malformed', async () => {
    const { deps, messages, calls } = createDeps();

    await expect(
      runReview({ pullRequestUrl: 'https://github.com/acme/ody/issues/123' }, deps),
    ).rejects.toThrow('process.exit(1)');
    expect(messages.errors).toEqual(['A valid GitHub pull request URL is required.']);
    expect(calls.spawn).toHaveLength(0);
  });

  test('launches the configured backend interactively for a valid pull request URL', async () => {
    const { deps, messages, calls } = createDeps();

    await runReview({ pullRequestUrl: 'https://github.com/acme/ody/pull/123' }, deps);

    expect(messages.info).toEqual(['Launching interactive review harness']);
    expect(calls.promptUrls).toEqual(['https://github.com/acme/ody/pull/123']);
    expect(calls.resolveModel).toEqual(['review']);
    expect(calls.backend).toHaveLength(1);
    expect(calls.commands).toEqual([
      { prompt: 'prompt:https://github.com/acme/ody/pull/123', model: 'review-model' },
    ]);
    expect(calls.spawn).toEqual([
      ['agent', 'prompt:https://github.com/acme/ody/pull/123', 'review-model'],
    ]);
  });

  test('exits with the harness exit code when the interactive review fails', async () => {
    const { deps, calls } = createDeps();

    deps.spawn = () => ({
      exited: Promise.resolve(7),
    });

    await expect(
      runReview({ pullRequestUrl: 'https://github.com/acme/ody/pull/123' }, deps),
    ).rejects.toThrow('process.exit(7)');
    expect(calls.exits).toContain(7);
  });
});

describe('buildReviewPrompt', () => {
  test('limits the agent to diff review and inline comments', () => {
    const prompt = buildReviewPrompt({
      pullRequestUrl: 'https://github.com/acme/ody/pull/123',
    });

    expect(prompt).toContain('https://github.com/acme/ody/pull/123');
    expect(prompt).toContain('Retrieve and review only the pull request diff');
    expect(prompt).toContain(
      'submit it back to GitHub only as an inline pull request review comment',
    );
    expect(prompt).toContain(
      'Do not submit an overall review state such as APPROVE, COMMENT, or REQUEST_CHANGES.',
    );
  });
});
