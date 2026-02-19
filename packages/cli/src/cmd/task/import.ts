import { log, outro, spinner } from '@clack/prompts';
import { defineCommand } from 'citty';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { Backend } from '../../backends/backend';
import { buildImportPrompt } from '../../builders/importPrompt';
import { Auth } from '../../lib/auth';
import { Config } from '../../lib/config';
import { GitHub } from '../../lib/github';
import { Jira } from '../../lib/jira';
import { BASE_DIR, TASKS_DIR } from '../../util/constants';
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
      const result = await buildJiraPrompt(args.jira as string);
      prompt = result.prompt;
      sourceLabel = result.sourceLabel;
    } else {
      const result = await buildGitHubPromptFromArgs(args.github as string);
      prompt = result.prompt;
      sourceLabel = result.sourceLabel;
    }

    if (args['dry-run']) {
      log.info(prompt);
      outro('Dry run complete');
      return;
    }

    await spawnAgent(prompt, sourceLabel, args.verbose);
  },
});

async function buildJiraPrompt(input: string) {
  const jiraConfig = Config.get('jira');
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

async function buildGitHubPromptFromArgs(input: string) {
  const { owner, repo, issueNumber } = GitHub.parseInput(input);
  const issueRef = `${owner}/${repo}#${issueNumber}`;

  const githubConfig = Config.get('github');
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

async function spawnAgent(prompt: string, sourceLabel: string, verbose: boolean) {
  const tasksDir = Config.get('tasksDir') ?? TASKS_DIR;
  const spin = spinner();

  try {
    await mkdir(path.join(BASE_DIR, tasksDir), { recursive: true });
    spin.start(`Generating task from ${sourceLabel}...`);

    const backend = new Backend(Config.get('backend'));
    const proc = Bun.spawn({
      cmd: backend.buildCommand(prompt),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    await Promise.allSettled([
      Stream.toOutput(proc.stdout, {
        shouldPrint: verbose,
        onChunk(accumulated) {
          if (accumulated.includes('<woof>COMPLETE</woof>')) {
            proc.kill();
            return true;
          }
        },
      }),
      Stream.toOutput(proc.stderr, { shouldPrint: verbose }),
    ]);

    await proc.exited;

    spin.stop(`Task generated`);
  } catch (err) {
    spin.stop('Task generation failed');
    log.error(`Failed to generate task: ${err}`);
    process.exit(1);
  }

  outro(`Task imported from ${sourceLabel}`);
}
