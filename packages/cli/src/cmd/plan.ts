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

    // Phase 1: Collect all plan descriptions upfront
    const descriptions: string[] = [];

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

      descriptions.push(description);

      const another = await confirm({
        message: 'Add another plan?',
      });

      if (isCancel(another) || !another) {
        break;
      }
    }

    if (descriptions.length === 0) {
      outro('No plans to process.');
      return;
    }

    // Phase 2: Process all collected descriptions sequentially
    let generated = 0;

    for (let i = 0; i < descriptions.length; i++) {
      const description = descriptions[i]!;
      const planPrompt = buildPlanPrompt({
        description,
      });

      if (args['dry-run']) {
        log.info(`Plan ${i + 1} of ${descriptions.length}:\n${planPrompt}`);
        generated++;
      } else {
        try {
          await mkdir(path.join(BASE_DIR, TASKS_DIR), { recursive: true });
          spin.start(`Generating task plan ${i + 1} of ${descriptions.length}`);

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

          spin.stop(`Task plan ${i + 1} of ${descriptions.length} generated`);
          generated++;
        } catch (err) {
          spin.stop(`Task plan ${i + 1} of ${descriptions.length} failed`);
          log.error(`Failed to generate task plan ${i + 1}: ${err}`);
        }
      }
    }

    outro(`Task planning complete — ${generated} task${generated === 1 ? '' : 's'} generated`);
  },
});
