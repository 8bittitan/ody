import { log } from '@clack/prompts';
import { Backend } from '@internal/backends';
import { buildReviewPrompt } from '@internal/builders';
import { Config } from '@internal/config';
import { defineCommand } from 'citty';

export function isGitHubPullRequestUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);

    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      (hostname === 'github.com' || hostname === 'www.github.com') &&
      parts.length >= 4 &&
      parts[2] === 'pull' &&
      /^[1-9]\d*$/.test(parts[3] ?? '')
    );
  } catch {
    return false;
  }
}

type ReviewArgs = {
  pullRequestUrl?: string;
};

type ReviewConfig = Pick<
  ReturnType<typeof Config.all>,
  'agent' | 'backend' | 'model' | 'skipPermissions'
>;

type ReviewBackend = {
  buildInteractiveCommand(prompt: string, model?: string): string[];
};

type ReviewProcess = {
  exited: Promise<number>;
};

type ReviewDeps = {
  buildPrompt: typeof buildReviewPrompt;
  createBackend: (selectedBackend: string, config: ReviewConfig) => ReviewBackend;
  exit: (code: number) => never;
  getConfig: () => ReviewConfig;
  log: Pick<typeof log, 'error' | 'info'>;
  resolveModel: (config: ReviewConfig) => string | undefined;
  spawn: (cmd: string[]) => ReviewProcess;
};

function createBackend(selectedBackend: string, config: ReviewConfig) {
  return new Backend(selectedBackend, config);
}

function spawnInteractiveReview(cmd: string[]) {
  return Bun.spawn({
    cmd,
    stdio: ['inherit', 'inherit', 'inherit'],
  });
}

const REVIEW_ERROR_MESSAGE = 'A valid GitHub pull request URL is required.';

function resolveReviewModel(config: ReviewConfig) {
  if (typeof config.model === 'string') {
    return config.model;
  }

  return config.model?.run;
}

export async function runReview(
  args: ReviewArgs,
  deps: ReviewDeps = {
    buildPrompt: buildReviewPrompt,
    createBackend,
    exit(code: number) {
      process.exit(code);
    },
    getConfig: Config.all,
    log,
    resolveModel: resolveReviewModel,
    spawn: spawnInteractiveReview,
  },
) {
  const pullRequestUrl = args.pullRequestUrl?.trim();

  if (!pullRequestUrl || !isGitHubPullRequestUrl(pullRequestUrl)) {
    deps.log.error(REVIEW_ERROR_MESSAGE);
    deps.exit(1);
  }

  const config = deps.getConfig();
  const backend = deps.createBackend(config.backend, config);
  const model = deps.resolveModel(config);

  deps.log.info('Launching interactive review harness');

  const prompt = deps.buildPrompt({ pullRequestUrl });
  const proc = deps.spawn(backend.buildInteractiveCommand(prompt, model));
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    deps.exit(exitCode);
  }
}

export const reviewCmd = defineCommand({
  meta: {
    name: 'review',
    description: 'Review a GitHub pull request interactively',
  },
  args: {
    pullRequestUrl: {
      type: 'positional',
      description: 'GitHub pull request URL to review',
      required: false,
    },
  },
  async run({ args }) {
    await runReview({ pullRequestUrl: args.pullRequestUrl });
  },
});
