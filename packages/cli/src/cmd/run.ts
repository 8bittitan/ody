import { outro, spinner, log, type SpinnerResult } from '@clack/prompts';
import { defineCommand } from 'citty';

import { Backend } from '../backends/backend';
import { buildRunPrompt } from '../builders/runPrompt';
import { Config } from '../lib/config';
import { sendNotification } from '../lib/notify';
import { Stream } from '../util/stream';
import { getTaskFilesByLabel } from '../util/task';

async function printOutro(completed: boolean, notifySetting: false | 'all' | 'individual') {
  const message = completed ? 'Agent completed the task' : 'Finished';

  if (notifySetting) {
    await sendNotification('ody', message);
  }

  outro(message);
}

export const runCmd = defineCommand({
  meta: {
    name: 'run',
    description: 'Run Ody in a loop',
  },
  args: {
    taskFile: {
      type: 'positional',
      description: 'Path to a specific .code-task.md file to run',
      required: false,
    },
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
    ['no-notify']: {
      description: 'Disable OS notifications even if enabled in config',
      type: 'boolean',
      default: false,
    },
  },
  async run({ args }) {
    const config = Config.all();
    const backend = new Backend(config.backend);

    const notifyRaw = args['no-notify'] ? false : (Config.get('notify') ?? false);
    const notifySetting: false | 'all' | 'individual' =
      notifyRaw === true ? 'all' : notifyRaw === false ? false : notifyRaw;

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

    let singleTaskFile: string | undefined;

    if (args.taskFile) {
      if (args.label) {
        log.error('Cannot use both a task file argument and --label. They are mutually exclusive.');
        process.exit(1);
      }

      if (!args.taskFile.endsWith('.code-task.md')) {
        log.error(`Invalid task file "${args.taskFile}". File must end with .code-task.md`);
        process.exit(1);
      }

      const fileExists = await Bun.file(args.taskFile).exists();

      if (!fileExists) {
        log.error(`Task file not found: ${args.taskFile}`);
        process.exit(1);
      }

      singleTaskFile = args.taskFile;
    }

    let taskFiles: string[] | undefined;

    if (args.label) {
      taskFiles = await getTaskFilesByLabel(args.label);

      if (taskFiles.length === 0) {
        log.warn(`No tasks found with label "${args.label}"`);
        process.exit(0);
      }
    }

    const prompt = buildRunPrompt({ taskFiles, taskFile: singleTaskFile });

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
              taskFile: singleTaskFile,
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

        await printOutro(completed, notifySetting);

        process.exit(exitCode);
      } catch (err) {
        const message = Error.isError(err) ? err.message : String(err);

        log.error(message);

        process.exit(1);
      }
    }

    const maxIterations = iterationsOverride ?? (singleTaskFile ? 1 : config.maxIterations);
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

          if (notifySetting === 'individual') {
            await sendNotification('ody', `Iteration ${i + 1} complete`);
          }

          break;
        }

        if (notifySetting === 'individual') {
          await sendNotification('ody', `Iteration ${i + 1} complete`);
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

    if (notifySetting === 'all') {
      await sendNotification('ody', 'Agent loop complete');
    }

    outro('Agent loop complete');
  },
});
