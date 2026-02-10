import { outro, spinner, log, type SpinnerResult } from '@clack/prompts';
import { defineCommand } from 'citty';

import { Backend } from '../backends/backend';
import { buildPrompt } from '../builders/prompt';
import { Config } from '../lib/config';
import { Stream } from '../util/stream';

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
        process.exit(exitCode);
      } catch (err) {
        const message = Error.isError(err) ? err.message : String(err);

        log.error(message);

        process.exit(1);
      }
    }

    const maxIterations = config.maxIterations;
    let agentSpinner: SpinnerResult | null = null;

    if (!args.verbose) {
      agentSpinner = spinner();
    }

    agentSpinner?.start('Running agent loop');

    for (let i = 0; maxIterations === 0 || i < maxIterations; i++) {
      try {
        const proc = Bun.spawn({
          cmd: backend.buildCommand(prompt),
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

        if (completed) {
          agentSpinner?.stop('Agent finished all available tasks');
          break;
        }
      } catch (err) {
        const message = Error.isError(err) ? err.message : String(err);

        if (agentSpinner) {
          agentSpinner.stop(message);
        } else {
          log.error(message);
        }

        process.exit(1);
      }
    }

    outro('Agent loop complete');
  },
});
