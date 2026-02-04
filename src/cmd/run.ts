import { outro, spinner, log } from '@clack/prompts';
import { defineCommand } from 'citty';

import { Backend } from '../backends/backend';
import { buildPrompt } from '../builders/prompt';
import { Config } from '../lib/config';
import { logger } from '../lib/logger';

const agentSpinner = spinner();

export const runCmd = defineCommand({
  meta: {
    name: 'run',
    description: 'Run Ody in a loop',
  },
  args: {
    verbose: {
      description: 'Enables verbose logging; (streamed agent output)',
      type: 'boolean',
      default: false,
    },
    once: {
      description: 'Run a single iteration instead of the loop',
      type: 'boolean',
      default: false,
    },
    ['dry-run']: {
      description: 'Dry run of building the harness command (only with --once)',
      type: 'boolean',
      default: false,
    },
  },
  async setup() {
    // TODO: Move to main command
    await Config.load();
  },
  async run({ args }) {
    const config = Config.all();
    const backend = new Backend(config.backend);
    const prompt = buildPrompt();

    if (args.once) {
      log.info('Running ody once');

      const cmd = backend.buildOnceCommand(prompt);

      if (args['dry-run']) {
        log.info('Running dry run');
        log.message(
          JSON.stringify(
            {
              backend: backend.name,
              prompt,
              cmd,
            },
            null,
            2,
          ),
        );
        return;
      }

      try {
        const proc = Bun.spawn({
          cmd,
          stdio: ['inherit', 'inherit', 'inherit'],
        });

        const exitCode = await proc.exited;

        outro('Finished');
        proc.kill(exitCode);
        process.exit(exitCode);
      } catch (err) {
        if (Error.isError(err)) {
          log.error(err.message);
        }

        process.exit(1);
      }
    }

    const maxIterations = config.maxIterations;

    agentSpinner.start('Running agent loop');

    const decoder = new TextDecoder();

    for (let i = 0; i < maxIterations; i++) {
      try {
        const proc = Bun.spawn({
          cmd: backend.buildCommand(prompt),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        const reader = proc.stdout.getReader();
        let output = '';

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
        }

        if (output.includes('<bark>COMPLETE</bark>')) {
          agentSpinner.stop('Agent finished all available tasks');
          proc.kill(0);
          break;
        }

        await proc.exited;
      } catch (err) {
        if (Error.isError(err)) {
          agentSpinner.error(err.message);
        }
      }
    }

    outro('Agent loop complete');
  },
});
