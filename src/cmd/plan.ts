import { isCancel, outro, text, log, cancel, confirm, box, spinner } from '@clack/prompts';
import { defineCommand } from 'citty';

import { Backend } from '../backends/backend';
import { buildPlanPrompt } from '../builders/prompt';
import { Config } from '../lib/config';

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

    if (!confirmed) {
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
      outro('Task planning complete');
      process.exit(0);
    }

    const backend = new Backend(Config.get('backend'));
    const decoder = new TextDecoder();

    spin.start('Generating task plan');

    let output = '';

    const proc = Bun.spawn({
      cmd: backend.buildCommand(planPrompt),
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const reader = proc.stdout.getReader();

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const out = decoder.decode(value);

      if (args.verbose) {
        log.message('');
        log.message(out);
      }

      output += out;

      if (output.includes('<woof>COMPLETE</woof>')) {
        proc.kill();
        break;
      }
    }

    await proc.exited;

    spin.stop('Task plan generated');

    outro('Task planning complete');
  },
});
