import { isCancel, outro, text, log, cancel, confirm, box, spinner } from '@clack/prompts';
import { defineCommand } from 'citty';

import { Backend } from '../backends/backend';
import { buildPlanPrompt } from '../builders/prompt';
import { Config } from '../lib/config';
import { Stream } from '../util/stream';

const spin = spinner();

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

      const stepsDescription = await text({
        message: 'Describe, in free form text, steps the task should use for building.',
        validate(value) {
          if (!value || value.trim() === '') return 'Please enter a description for steps.';

          return undefined;
        },
      });

      if (isCancel(stepsDescription)) {
        outro('Plan cancelled.');
        return;
      }

      log.message('');

      box(
        `
Task description: ${String(description).trim()}
Steps description: ${String(stepsDescription).trim()}
`,
        'Plan details',
        {
          width: 'auto',
          rounded: true,
          titleAlign: 'center',
        },
      );

      const confirmed = await confirm({
        message: 'Proceed with these plan details?',
      });

      if (isCancel(confirmed) || !confirmed) {
        log.message('');
        cancel('Planning cancelled');
        process.exit(0);
      }

      const planPrompt = buildPlanPrompt({
        description,
        stepsDescription,
      });

      if (args['dry-run']) {
        log.info(planPrompt);
      } else {
        spin.start('Generating task plan');

        const proc = Bun.spawn({
          cmd: backend.buildCommand(planPrompt),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let completed = false;

        await Promise.all([
          Stream.toOutput(proc.stdout, {
            shouldPrint: args.verbose,
            onChunk(accumulated) {
              if (accumulated.includes('<woof>COMPLETE</woof>')) {
                completed = true;
                proc.kill();
                return true;
              }
            },
          }),
          Stream.toOutput(proc.stderr, { shouldPrint: args.verbose }),
        ]);

        await proc.exited;

        spin.stop('Task plan generated');

        if (completed) {
          break;
        }
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
