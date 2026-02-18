import { log, outro, spinner } from '@clack/prompts';
import { defineCommand } from 'citty';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { Backend } from '../../backends/backend';
import { buildImportPrompt } from '../../builders/importPrompt';
import { Auth } from '../../lib/auth';
import { Config } from '../../lib/config';
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
      required: true,
      description: 'Jira ticket key (e.g. PROJ-123) or full URL',
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
    const jiraConfig = Config.get('jira');
    const { baseUrl, ticketKey } = Jira.parseInput(args.jira, jiraConfig?.baseUrl);

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
    const prompt = buildImportPrompt({ ticketData });

    if (args['dry-run']) {
      log.info(prompt);
      outro('Dry run complete');
      return;
    }

    const tasksDir = Config.get('tasksDir') ?? TASKS_DIR;

    try {
      await mkdir(path.join(BASE_DIR, tasksDir), { recursive: true });
      spin.start(`Generating task from ${ticketKey}...`);

      const backend = new Backend(Config.get('backend'));
      const proc = Bun.spawn({
        cmd: backend.buildCommand(prompt),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      await Promise.allSettled([
        Stream.toOutput(proc.stdout, {
          shouldPrint: args.verbose,
          onChunk(accumulated) {
            if (accumulated.includes('<woof>COMPLETE</woof>')) {
              proc.kill();
              return true;
            }
          },
        }),
        Stream.toOutput(proc.stderr, { shouldPrint: args.verbose }),
      ]);

      await proc.exited;

      spin.stop(`Task generated`);
    } catch (err) {
      spin.stop('Task generation failed');
      log.error(`Failed to generate task: ${err}`);
      process.exit(1);
    }

    outro(`Task imported from ${ticketKey}`);
  },
});
