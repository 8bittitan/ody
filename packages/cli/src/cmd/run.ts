import { outro, spinner, log, type SpinnerResult } from '@clack/prompts';
import { defineCommand } from 'citty';

import { Backend } from '../backends/backend';
import { buildRunPrompt } from '../builders/runPrompt';
import { Config } from '../lib/config';
import { getTaskFilesByLabel } from '../lib/tasks';
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
    label: {
      description: 'Filter tasks by label',
      type: 'string',
      alias: 'l',
      required: false,
    },
    iterations: {
      description: 'Override the number of loop iterations (0 for unlimited)',
      type: 'string',
      alias: 'i',
      required: false,
    },
  },
  async run({ args }) {
    const config = Config.all();
    const backend = new Backend(config.backend);

    let iterationsOverride: number | undefined;

    if (args.iterations !== undefined) {
      const parsed = parseInt(args.iterations, 10);

      if (Number.isNaN(parsed) || parsed < 0) {
        log.error(
          `Invalid --iterations value "${args.iterations}". Must be a non-negative integer.`,
        );
        process.exit(1);
      }

      iterationsOverride = parsed;
    }

    let taskFiles: string[] | undefined;

    if (args.label) {
      taskFiles = await getTaskFilesByLabel(args.label);

      if (taskFiles.length === 0) {
        log.warn(`No tasks found with label "${args.label}"`);
        process.exit(0);
      }
    }

    const prompt = buildRunPrompt({ taskFiles });

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
              labelFilter: args.label,
              matchingTasks: taskFiles,
            },
            null,
            2,
          ),
        );
        return;
      }

      try {
        let completed = false;
        let accumulated = '';
        const decoder = new TextDecoder('utf-8', { fatal: false });

        const proc = Bun.spawn({
          cmd,
          terminal: {
            cols: process.stdout.columns || 80,
            rows: process.stdout.rows || 24,
            data(_terminal, data) {
              process.stdout.write(data);

              accumulated += decoder.decode(data, { stream: true });

              if (accumulated.includes('<woof>COMPLETE</woof>')) {
                completed = true;
                proc.kill();
              }
            },
          },
        });

        const exitCode = await proc.exited;
        proc.terminal?.close();

        if (completed) {
          outro('Agent completed the task');
        } else {
          outro('Finished');
        }

        process.exit(exitCode);
      } catch (err) {
        const message = Error.isError(err) ? err.message : String(err);

        log.error(message);

        process.exit(1);
      }
    }

    const maxIterations = iterationsOverride ?? config.maxIterations;
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
