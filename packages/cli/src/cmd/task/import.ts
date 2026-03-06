import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { log, outro, spinner } from '@clack/prompts';
import { Auth } from '@internal/auth';
import { Backend } from '@internal/backends';
import { buildImportPrompt } from '@internal/builders';
import { BASE_DIR, Config, TASKS_DIR, type OdyConfig } from '@internal/config';
import { GitHub, Jira } from '@internal/integrations';
import { defineCommand } from 'citty';

import {
  createCompletionMarkerDetector,
  validateAgentCompletion,
} from '../../util/agentCompletion';
import { Stream } from '../../util/stream';

export const importCmd = defineCommand({
  meta: {
    name: 'import',
    description: 'Import a task from an external source',
  },
  args: {
    jira: {
      type: 'string',
      required: false,
      description: 'Jira ticket key (e.g. PROJ-123) or full URL',
    },
    github: {
      type: 'string',
      required: false,
      alias: 'gh',
      description: 'GitHub issue URL or shorthand (e.g. owner/repo#123)',
    },
    verbose: {
      type: 'boolean',
      default: false,
      description: 'Enable verbose logging',
    },
    ['dry-run']: {
      type: 'boolean',
      default: false,
      alias: 'd',
      description: 'Print the generated prompt without running the agent',
    },
  },
  async run({ args }) {
    const config = Config.all();
    const backend = new Backend(config.backend, config);
    const tasksDirPath = path.join(BASE_DIR, config.tasksDir ?? TASKS_DIR);

    const hasJira = Boolean(args.jira);
    const hasGitHub = Boolean(args.github);

    if (hasJira && hasGitHub) {
      log.error('Provide exactly one source: --jira or --github, not both.');
      process.exit(1);
    }

    if (!hasJira && !hasGitHub) {
      log.error('Provide exactly one source: --jira or --github.');
      process.exit(1);
    }

    let prompt: string;
    let sourceLabel: string;

    if (hasJira) {
      const result = await buildJiraPrompt(args.jira as string, config.jira);
      prompt = result.prompt;
      sourceLabel = result.sourceLabel;
    } else {
      const result = await buildGitHubPromptFromArgs(args.github as string, config.github);
      prompt = result.prompt;
      sourceLabel = result.sourceLabel;
    }

    if (args['dry-run']) {
      log.info(prompt);
      outro('Dry run complete');
      return;
    }

    await spawnAgent(prompt, sourceLabel, args.verbose, backend, tasksDirPath);
  },
});

async function buildJiraPrompt(input: string, jiraConfig: OdyConfig['jira']) {
  const { baseUrl, ticketKey } = Jira.parseInput(input, jiraConfig?.baseUrl);

  const profile = jiraConfig?.profile ?? 'default';
  const auth = await Auth.getJira(profile);

  const spin = spinner();

  let ticket;

  try {
    spin.start(`Fetching ${ticketKey} from Jira...`);
    ticket = await Jira.fetchTicket(baseUrl, ticketKey, auth);
    spin.stop(`Fetched ${ticketKey}: ${ticket.summary}`);
  } catch (err) {
    spin.stop(`Failed to fetch ${ticketKey}`);
    log.error(`${err}`);
    process.exit(1);
  }

  const ticketData = Jira.formatAsDescription(ticket);
  const prompt = buildImportPrompt({ data: ticketData, source: 'jira' });

  return { prompt, sourceLabel: ticketKey };
}

async function buildGitHubPromptFromArgs(input: string, githubConfig: OdyConfig['github']) {
  const { owner, repo, issueNumber } = GitHub.parseInput(input);
  const issueRef = `${owner}/${repo}#${issueNumber}`;
  const profile = githubConfig?.profile ?? 'default';
  const auth = await Auth.getGitHub(profile);
  const token = auth?.token;

  const spin = spinner();

  let issue;

  try {
    spin.start(`Fetching ${issueRef} from GitHub...`);
    issue = await GitHub.fetchIssue(owner, repo, issueNumber, token);
    spin.stop(`Fetched ${issueRef}: ${issue.title}`);
  } catch (err) {
    spin.stop(`Failed to fetch ${issueRef}`);
    log.error(`${err}`);
    process.exit(1);
  }

  const issueData = GitHub.formatAsDescription(issue, owner, repo);
  const prompt = buildImportPrompt({ data: issueData, source: 'github' });

  return { prompt, sourceLabel: issueRef };
}

async function spawnAgent(
  prompt: string,
  sourceLabel: string,
  verbose: boolean,
  backend: Backend,
  tasksDirPath: string,
) {
  const spin = spinner();

  try {
    await mkdir(tasksDirPath, { recursive: true });
    spin.start(`Generating task from ${sourceLabel}...`);

    const proc = Bun.spawn({
      cmd: backend.buildCommand(prompt),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const markerDetector = createCompletionMarkerDetector();

    await Promise.all([
      Stream.toOutput(proc.stdout, {
        shouldPrint: verbose,
        onChunk(chunk) {
          markerDetector.onChunk(chunk);
        },
      }),
      Stream.toOutput(proc.stderr, { shouldPrint: verbose }),
    ]);

    const markerDetection = markerDetector.finalize();
    const exitCode = await proc.exited;
    validateAgentCompletion(exitCode, markerDetection, { requireMarker: true });

    spin.stop(`Task generated`);
  } catch (err) {
    spin.stop('Task generation failed');
    log.error(`Failed to generate task: ${err}`);
    process.exit(1);
  }

  outro(`Task imported from ${sourceLabel}`);
}
