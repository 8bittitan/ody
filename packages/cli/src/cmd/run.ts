import { outro, spinner, log, type SpinnerResult } from '@clack/prompts';
import { defineCommand } from 'citty';

import { Backend } from '../backends/backend';
import { buildRunPrompt } from '../builders/runPrompt';
import { Config } from '../lib/config';
import { sendNotification } from '../lib/notify';
import { Stream } from '../util/stream';
import { getTaskFilesByLabel } from '../util/task';

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

    const maxIterations = iterationsOverride ?? (singleTaskFile ? 1 : config.maxIterations);
    let agentSpinner: SpinnerResult | null = null;

    if (!args.verbose) {
      agentSpinner = spinner();
    }

    let completed = 0;

    for (let i = 0; maxIterations === 0 || i < maxIterations; i++) {
      const iterLabel =
        maxIterations === 0
          ? `Running agent task ${i + 1}`
          : `Running agent task ${i + 1} of ${maxIterations}`;

      agentSpinner?.start(iterLabel);

      try {
        const proc = Bun.spawn({
          cmd: backend.buildCommand(prompt),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let tasksDone = false;

        await Promise.all([
          Stream.toOutput(proc.stdout, {
            shouldPrint: args.verbose,
            onChunk(accumulated) {
              if (accumulated.includes('<woof>COMPLETE</woof>')) {
                tasksDone = true;
                proc.kill();
                return true;
              }
            },
          }),
          Stream.toOutput(proc.stderr, { shouldPrint: args.verbose }),
        ]);

        await proc.exited;

        if (tasksDone) {
          completed++;
          agentSpinner?.stop(`Agent task ${i + 1} complete`);
          log.info('All pending tasks finished');

          break;
        }

        completed++;
        agentSpinner?.stop(
          maxIterations === 0
            ? `Agent task ${i + 1} complete`
            : `Agent task ${i + 1} of ${maxIterations} complete`,
        );

        if (notifySetting === 'individual') {
          await sendNotification('ody', `Agent task ${i + 1} complete`);
        }
      } catch (err) {
        const message = Error.isError(err) ? err.message : String(err);

        if (agentSpinner) {
          agentSpinner.stop(`Agent task ${i + 1} failed: ${message}`);
        } else {
          log.error(`Agent task ${i + 1} failed: ${message}`);
        }

        process.exit(1);
      }
    }

    if (notifySetting === 'all') {
      await sendNotification('ody', 'Agent loop complete');
    }

    outro(`Agent loop complete — ${completed} task${completed === 1 ? '' : 's'}`);
  },
});
