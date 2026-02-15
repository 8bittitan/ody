import { spinner, text, isCancel, outro, log, confirm } from '@clack/prompts';
import { defineCommand } from 'citty';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { Backend } from '../backends/backend';
import { buildPlanPrompt } from '../builders/planPrompt';
import { Config } from '../lib/config';
import { BASE_DIR, TASKS_DIR } from '../util/constants';
import { Stream } from '../util/stream';

export const planCmd = defineCommand({
  meta: {
    name: 'plan',
    description: 'Plan upcoming work',
  },
  args: {
    ['dry-run']: {
      default: false,
      description: 'Run as dry run, without sending prompt to agent',
      type: 'boolean',
      alias: 'd',
    },
    verbose: {
      default: false,
      description: "Enable verbose logging, streaming the agent's work in progress",
      type: 'boolean',
    },
  },
  async run({ args }) {
    const backend = new Backend(Config.get('backend'));
    const spin = spinner();

    while (true) {
      const description = await text({
        message: 'Describe the task you want to plan',
        validate(value) {
          if (!value || value.trim() === '') return 'Please enter a task description.';

          return undefined;
        },
      });

      if (isCancel(description)) {
        outro('Plan cancelled.');
        return;
      }

      const planPrompt = buildPlanPrompt({
        description,
      });

      if (args['dry-run']) {
        log.info(planPrompt);
      } else {
        await mkdir(path.join(BASE_DIR, TASKS_DIR), { recursive: true });
        spin.start('Generating task plan');

        const proc = Bun.spawn({
          cmd: backend.buildCommand(planPrompt),
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

        spin.stop('Task plan generated');
      }

      const another = await confirm({
        message: 'Would you like to add another plan?',
      });

      if (isCancel(another) || !another) {
        break;
      }
    }

    outro('Task planning complete');
  },
});
