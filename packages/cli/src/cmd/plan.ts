import { spinner, text, isCancel, outro, log, confirm } from '@clack/prompts';
import { defineCommand } from 'citty';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { Backend } from '../backends/backend';
import { buildBatchPlanPrompt, buildPlanPrompt } from '../builders/planPrompt';
import { Config } from '../lib/config';
import { BASE_DIR, TASKS_DIR } from '../util/constants';
import { Stream } from '../util/stream';

export const planCmd = defineCommand({
  meta: {
    name: 'plan',
    description: 'Plan upcoming work',
  },
  args: {
    planFile: {
      type: 'positional',
      description: 'Path to a planning document to generate tasks from',
      required: false,
    },
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

    if (args.planFile) {
      const fileExists = await Bun.file(args.planFile).exists();

      if (!fileExists) {
        log.error(`Plan file not found: ${args.planFile}`);
        process.exit(1);
      }

      const batchPrompt = buildBatchPlanPrompt({ filePath: args.planFile });

      if (args['dry-run']) {
        log.info(batchPrompt);
        outro('Dry run complete');
        return;
      }

      try {
        await mkdir(path.join(BASE_DIR, TASKS_DIR), { recursive: true });
        spin.start('Generating task plans from file...');

        const proc = Bun.spawn({
          cmd: backend.buildCommand(batchPrompt),
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

        spin.stop('Task plans generated from file');
      } catch (err) {
        spin.stop('Task plan generation failed');
        log.error(`Failed to generate task plans: ${err}`);
        process.exit(1);
      }

      outro('Batch task planning complete');
      return;
    }

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
