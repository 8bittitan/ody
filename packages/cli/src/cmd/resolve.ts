import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { isCancel, log, outro, select, spinner } from '@clack/prompts';
import { Auth } from '@internal/auth';
import { Backend } from '@internal/backends';
import { buildResolvePrompt } from '@internal/builders';
import { Config } from '@internal/config';
import { GitHub } from '@internal/integrations';
import { defineCommand } from 'citty';

import { Stream } from '../util/stream';

const execFileAsync = promisify(execFile);

const RESOLVE_URL_ERROR_MESSAGE =
  'A valid GitHub pull request comment URL is required. Supported URLs look like https://github.com/owner/repo/pull/123#issuecomment-456 or https://github.com/owner/repo/pull/123#discussion_r789.';

export type ParsedGitHubCommentUrl = {
  owner: string;
  repo: string;
  pullRequestNumber: number;
  commentId: number;
  kind: 'issue_comment' | 'review_comment';
};

export type ResolvableComment = {
  kind: 'issue_comment' | 'review_comment';
  id: number;
  author: string;
  body: string;
  createdAt: string;
  pullRequestNumber: number;
  url: string;
  path?: string | null;
  line?: number | null;
  diffHunk?: string | null;
};

type ResolveArgs = {
  commentUrl?: string;
  dryRun?: boolean;
  interactive?: boolean;
  verbose?: boolean;
};

type ResolveConfig = Pick<
  ReturnType<typeof Config.all>,
  'agent' | 'backend' | 'github' | 'model' | 'skipPermissions'
>;

type ResolveBackend = {
  buildCommand(prompt: string, model?: string): string[];
  buildInteractiveCommand(prompt: string, model?: string): string[];
};

type ResolvePromptInput = Parameters<typeof buildResolvePrompt>[0];

type ResolveDeps = {
  buildPrompt: (input: ResolvePromptInput) => string;
  createBackend: (selectedBackend: string, config: ResolveConfig) => ResolveBackend;
  executeNonInteractive: (
    backend: ResolveBackend,
    prompt: string,
    options?: { model?: string; verbose?: boolean },
  ) => Promise<number>;
  executeInteractive: (backend: ResolveBackend, prompt: string, model?: string) => Promise<number>;
  exit: (code: number) => never;
  getConfig: () => ResolveConfig;
  getCurrentBranch: () => Promise<string>;
  getGitHubToken: (profile?: string) => Promise<string | undefined>;
  getOriginRemoteUrl: () => Promise<string>;
  gitHub: {
    fetchIssueComment: typeof GitHub.fetchIssueComment;
    fetchPullRequest: typeof GitHub.fetchPullRequest;
    fetchPullRequestIssueComments: typeof GitHub.fetchPullRequestIssueComments;
    fetchPullRequestReviewComments: typeof GitHub.fetchPullRequestReviewComments;
    fetchReviewComment: typeof GitHub.fetchReviewComment;
    findOpenPullRequestByBranch: typeof GitHub.findOpenPullRequestByBranch;
  };
  log: Pick<typeof log, 'error' | 'info' | 'warn'>;
  promptForCommentSelection: (
    comments: ResolvableComment[],
  ) => Promise<ResolvableComment | undefined>;
  resolveModel: (config: ResolveConfig) => string | undefined;
};

type ResolvedTarget = {
  comment: ResolvableComment;
  owner: string;
  pullRequest: Awaited<ReturnType<typeof GitHub.fetchPullRequest>>;
  repo: string;
};

function createBackend(selectedBackend: string, config: ResolveConfig) {
  return new Backend(selectedBackend, config);
}

async function executeResolveNonInteractive(
  backend: ResolveBackend,
  prompt: string,
  options: { model?: string; verbose?: boolean } = {},
) {
  const agentSpinner = options.verbose ? null : spinner();

  agentSpinner?.start('Running resolve task');

  const proc = Bun.spawn({
    cmd: backend.buildCommand(prompt, options.model),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await Promise.all([
      Stream.toOutput(proc.stdout, { shouldPrint: options.verbose ?? false }),
      Stream.toOutput(proc.stderr, { shouldPrint: options.verbose ?? false }),
    ]);

    const exitCode = await proc.exited;

    if (exitCode === 0) {
      agentSpinner?.stop('Resolve task complete');
    } else {
      agentSpinner?.stop(`Resolve task failed with exit code ${exitCode}`);
    }

    return exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    agentSpinner?.stop(`Resolve task failed: ${message}`);
    throw error;
  }
}

async function executeResolveInteractive(backend: ResolveBackend, prompt: string, model?: string) {
  const proc = Bun.spawn({
    cmd: backend.buildInteractiveCommand(prompt, model),
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  return proc.exited;
}

async function getCurrentBranchName() {
  const { stdout } = await execFileAsync('git', ['branch', '--show-current']);
  return stdout.trim();
}

async function getOriginRemoteUrl() {
  const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin']);
  return stdout.trim();
}

async function getGitHubToken(profile?: string) {
  const credentials = await Auth.getGitHub(profile);
  return credentials?.token;
}

async function promptForCommentSelection(comments: ResolvableComment[]) {
  const selected = await select({
    message: 'Select a pull request comment to resolve',
    options: comments.map((comment) => ({
      value: String(comment.id),
      label: formatCommentOptionLabel(comment),
      hint: truncateComment(comment.body),
    })),
  });

  if (isCancel(selected)) {
    outro('Resolve cancelled.');
    return undefined;
  }

  return comments.find((comment) => String(comment.id) === selected);
}

function truncateComment(body: string, maxLength = 72) {
  const singleLine = body.replace(/\s+/g, ' ').trim();

  if (singleLine.length <= maxLength) {
    return singleLine || '(empty comment)';
  }

  return `${singleLine.slice(0, maxLength - 3)}...`;
}

function formatCommentOptionLabel(comment: ResolvableComment) {
  const typeLabel = comment.kind === 'review_comment' ? 'review' : 'comment';
  const location =
    comment.kind === 'review_comment' && comment.path
      ? ` ${comment.path}${comment.line ? `:${comment.line}` : ''}`
      : '';

  return `${comment.author} (${typeLabel}${location})`;
}

export function parseGitHubCommentUrl(value: string): ParsedGitHubCommentUrl {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(RESOLVE_URL_ERROR_MESSAGE);
  }

  const hostname = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  const hash = url.hash.replace(/^#/, '');

  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    (hostname !== 'github.com' && hostname !== 'www.github.com') ||
    parts.length < 4 ||
    parts[2] !== 'pull' ||
    !/^[1-9]\d*$/.test(parts[3] ?? '')
  ) {
    throw new Error(RESOLVE_URL_ERROR_MESSAGE);
  }

  const issueCommentMatch = hash.match(/^issuecomment-(\d+)$/);

  if (issueCommentMatch) {
    return {
      owner: parts[0] as string,
      repo: parts[1] as string,
      pullRequestNumber: Number.parseInt(parts[3] as string, 10),
      commentId: Number.parseInt(issueCommentMatch[1] as string, 10),
      kind: 'issue_comment',
    };
  }

  const reviewCommentMatch = hash.match(/^discussion_r(\d+)$/);

  if (reviewCommentMatch) {
    return {
      owner: parts[0] as string,
      repo: parts[1] as string,
      pullRequestNumber: Number.parseInt(parts[3] as string, 10),
      commentId: Number.parseInt(reviewCommentMatch[1] as string, 10),
      kind: 'review_comment',
    };
  }

  throw new Error(RESOLVE_URL_ERROR_MESSAGE);
}

export function parseGitHubRemoteUrl(remoteUrl: string) {
  const trimmed = remoteUrl.trim();
  const patterns = [
    /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/,
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
    /^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);

    if (match) {
      return {
        owner: match[1] as string,
        repo: match[2] as string,
      };
    }
  }

  throw new Error(`Unsupported GitHub remote URL: ${remoteUrl}`);
}

function toResolvableComment(
  comment:
    | Awaited<ReturnType<typeof GitHub.fetchIssueComment>>
    | Awaited<ReturnType<typeof GitHub.fetchReviewComment>>,
): ResolvableComment {
  if (comment.kind === 'review_comment') {
    return {
      author: comment.author,
      body: comment.body,
      createdAt: comment.createdAt,
      diffHunk: comment.diffHunk,
      id: comment.id,
      kind: comment.kind,
      line: comment.line,
      path: comment.path,
      pullRequestNumber: comment.pullRequestNumber,
      url: comment.url,
    };
  }

  return {
    author: comment.author,
    body: comment.body,
    createdAt: comment.createdAt,
    id: comment.id,
    kind: comment.kind,
    pullRequestNumber: comment.pullRequestNumber,
    url: comment.url,
  };
}

async function resolveCommentFromUrl(
  parsed: ParsedGitHubCommentUrl,
  deps: ResolveDeps,
  token?: string,
) {
  const comment =
    parsed.kind === 'review_comment'
      ? toResolvableComment(
          await deps.gitHub.fetchReviewComment(parsed.owner, parsed.repo, parsed.commentId, token),
        )
      : toResolvableComment(
          await deps.gitHub.fetchIssueComment(parsed.owner, parsed.repo, parsed.commentId, token),
        );

  if (comment.pullRequestNumber !== parsed.pullRequestNumber) {
    throw new Error(RESOLVE_URL_ERROR_MESSAGE);
  }

  const pullRequest = await deps.gitHub.fetchPullRequest(
    parsed.owner,
    parsed.repo,
    parsed.pullRequestNumber,
    token,
  );

  return {
    comment,
    owner: parsed.owner,
    pullRequest,
    repo: parsed.repo,
  } satisfies ResolvedTarget;
}

async function discoverCommentFromBranch(deps: ResolveDeps, token?: string) {
  const branch = await deps.getCurrentBranch();

  if (!branch) {
    throw new Error('Unable to determine the current git branch.');
  }

  const remote = parseGitHubRemoteUrl(await deps.getOriginRemoteUrl());
  const pullRequest = await deps.gitHub.findOpenPullRequestByBranch(
    remote.owner,
    remote.repo,
    branch,
    token,
  );

  if (!pullRequest) {
    throw new Error(`No open pull request found for branch "${branch}".`);
  }

  const [issueComments, reviewComments] = await Promise.all([
    deps.gitHub.fetchPullRequestIssueComments(remote.owner, remote.repo, pullRequest.number, token),
    deps.gitHub.fetchPullRequestReviewComments(
      remote.owner,
      remote.repo,
      pullRequest.number,
      token,
    ),
  ]);

  const comments = [...issueComments, ...reviewComments]
    .map((comment) => toResolvableComment(comment))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  if (comments.length === 0) {
    throw new Error(`No resolvable comments found on pull request #${pullRequest.number}.`);
  }

  const selectedComment = await deps.promptForCommentSelection(comments);

  if (!selectedComment) {
    return undefined;
  }

  return {
    comment: selectedComment,
    owner: remote.owner,
    pullRequest,
    repo: remote.repo,
  } satisfies ResolvedTarget;
}

function resolveRunModel(config: ResolveConfig) {
  return Config.resolveModel('run', config);
}

export async function runResolve(
  args: ResolveArgs,
  deps: ResolveDeps = {
    buildPrompt: buildResolvePrompt,
    createBackend,
    executeNonInteractive: executeResolveNonInteractive,
    executeInteractive: executeResolveInteractive,
    exit(code: number) {
      process.exit(code);
    },
    getConfig: Config.all,
    getCurrentBranch: getCurrentBranchName,
    getGitHubToken,
    getOriginRemoteUrl,
    gitHub: {
      fetchIssueComment: GitHub.fetchIssueComment,
      fetchPullRequest: GitHub.fetchPullRequest,
      fetchPullRequestIssueComments: GitHub.fetchPullRequestIssueComments,
      fetchPullRequestReviewComments: GitHub.fetchPullRequestReviewComments,
      fetchReviewComment: GitHub.fetchReviewComment,
      findOpenPullRequestByBranch: GitHub.findOpenPullRequestByBranch,
    },
    log,
    promptForCommentSelection,
    resolveModel: resolveRunModel,
  },
) {
  const config = deps.getConfig();
  const token = await deps.getGitHubToken(config.github?.profile);
  const trimmedUrl = args.commentUrl?.trim();

  let target: ResolvedTarget | undefined;

  try {
    target = trimmedUrl
      ? await resolveCommentFromUrl(parseGitHubCommentUrl(trimmedUrl), deps, token)
      : await discoverCommentFromBranch(deps, token);
  } catch (error) {
    deps.log.error(error instanceof Error ? error.message : String(error));
    deps.exit(1);
  }

  if (!target) {
    return;
  }

  const backend = deps.createBackend(config.backend, config);
  const model = deps.resolveModel(config);
  const shouldDryRun = (args.dryRun ?? false) && !(args.interactive ?? false);
  const prompt = deps.buildPrompt({
    comment: target.comment,
    dryRun: shouldDryRun,
    pullRequest: target.pullRequest,
  });

  let exitCode: number;

  if (args.interactive && args.dryRun) {
    deps.log.warn('Ignoring --dry-run because interactive mode is enabled.');
  }

  if (args.interactive) {
    deps.log.info('Launching interactive resolve harness');
    exitCode = await deps.executeInteractive(backend, prompt, model);
  } else if (shouldDryRun) {
    deps.log.info('Previewing resolve plan');
    exitCode = await deps.executeNonInteractive(backend, prompt, {
      model,
      verbose: args.verbose,
    });
  } else {
    deps.log.info('Launching resolve harness');
    exitCode = await deps.executeNonInteractive(backend, prompt, {
      model,
      verbose: args.verbose,
    });
  }

  if (exitCode !== 0) {
    deps.exit(exitCode);
  }
}

export const resolveCmd = defineCommand({
  meta: {
    name: 'resolve',
    description: 'Resolve a GitHub pull request comment locally',
  },
  args: {
    commentUrl: {
      type: 'positional',
      description: 'GitHub pull request comment URL to resolve',
      required: false,
    },
    ['dry-run']: {
      default: false,
      description: 'Preview the resolve plan without changing files',
      type: 'boolean',
      alias: 'd',
    },
    interactive: {
      default: false,
      description: 'Launch the resolve harness interactively',
      type: 'boolean',
      alias: 'i',
    },
    verbose: {
      default: false,
      description: 'Enables verbose logging; (streamed agent output)',
      type: 'boolean',
      alias: 'v',
    },
  },
  async run({ args }) {
    await runResolve({
      commentUrl: args.commentUrl,
      dryRun: args['dry-run'],
      interactive: args.interactive,
      verbose: args.verbose,
    });
  },
});
