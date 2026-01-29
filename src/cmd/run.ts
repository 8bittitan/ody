import { defineCommand } from 'citty';

import { Backend } from '../backends/backend';
import { buildPrompt } from '../builders/prompt';
import { Config } from '../lib/config';
import { logger } from '../lib/logger';

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
      logger.info('Running Ody once');

      const cmd = backend.buildOnceCommand(prompt);

      if (args['dry-run']) {
        logger.info('Running dry run');
        logger.log({
          backend: backend.name,
          prompt,
          cmd,
        });
        return;
      }

      try {
        const proc = Bun.spawn({
          cmd,
          stdio: ['inherit', 'inherit', 'inherit'],
        });

        const exitCode = await proc.exited;

        logger.info('Finished');
        process.exit(exitCode);
      } catch (err) {
        logger.fatal(err);
      }

      return;
    }

    const maxIterations = config.maxIterations;

    logger.start('Starting Agent loop');

    for (let i = 0; i < maxIterations; i++) {
      try {
        const proc = Bun.spawn({
          cmd: backend.buildCommand(prompt),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        const reader = proc.stdout.getReader();
        const decoder = new TextDecoder();
        let output = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const out = decoder.decode(value);

          if (args.verbose) {
            logger.info(out);
          }

          output += out;
        }

        if (output.includes('<bark>COMPLETE</bark>')) {
          logger.success('Agent finished all available tasks, exiting.');
          proc.kill();
          break;
        }

        await proc.exited;
      } catch (err) {
        logger.error(err);
      }
    }

    logger.success('Agent loop complete');
  },
});
