import { outro, spinner, log, type SpinnerResult } from '@clack/prompts';
import { defineCommand } from 'citty';

import { Backend } from '../backends/backend';
import { buildRunPrompt } from '../builders/runPrompt';
import { Config } from '../lib/config';
import { sendNotification } from '../lib/notify';
import { Stream, type StreamChunk } from '../util/stream';
import {
  getTaskFilesByLabel,
  getTaskStates,
  getTaskStatus,
  resolveTasksDir,
  type TaskState,
} from '../util/task';

const COMPLETE_MARKER = '<woof>COMPLETE</woof>';

type MarkerDetectionResult = {
  hasStrictMatch: boolean;
  hasAmbiguousMention: boolean;
};

function createCompletionMarkerDetector() {
  let partialLine = '';
  let hasStrictMatch = false;
  let hasAmbiguousMention = false;

  const inspectLine = (line: string) => {
    const trimmedLine = line.trim();

    if (trimmedLine === '') {
      return;
    }

    if (trimmedLine === COMPLETE_MARKER) {
      hasStrictMatch = true;
      return;
    }

    if (line.includes(COMPLETE_MARKER) || line.includes('<woof>') || line.includes('</woof>')) {
      hasAmbiguousMention = true;
    }
  };

  return {
    onChunk(data: StreamChunk) {
      for (const line of data.lines) {
        inspectLine(line);
      }

      partialLine = data.partialLine;
    },
    finalize(): MarkerDetectionResult {
      inspectLine(partialLine);

      return {
        hasStrictMatch,
        hasAmbiguousMention: hasAmbiguousMention && !hasStrictMatch,
      };
    },
  };
}

function findUnresolvedTaskStates(taskStates: TaskState[]) {
  return taskStates.filter((taskState) => taskState.status !== 'completed');
}

function formatTaskStates(taskStates: TaskState[]) {
  return taskStates.map((taskState) => `${taskState.taskFile} (${taskState.status})`).join(', ');
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
    const model = Config.resolveModel('run', config);
    const tasksDirPath = resolveTasksDir(config.tasksDir);

    const notifyRaw = args['no-notify'] ? false : (config.notify ?? false);
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
      taskFiles = await getTaskFilesByLabel(args.label, tasksDirPath);

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
          cmd: backend.buildCommand(prompt, model),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        const markerDetector = createCompletionMarkerDetector();

        await Promise.all([
          Stream.toOutput(proc.stdout, {
            shouldPrint: args.verbose,
            onChunk(chunk) {
              markerDetector.onChunk(chunk);
            },
          }),
          Stream.toOutput(proc.stderr, { shouldPrint: args.verbose }),
        ]);

        const markerDetection = markerDetector.finalize();
        const exitCode = await proc.exited;

        if (exitCode !== 0) {
          throw new Error(`Process exit failure: backend exited with code ${exitCode}`);
        }

        if (markerDetection.hasAmbiguousMention) {
          throw new Error(
            `Marker ambiguity: found marker-like output without standalone ${COMPLETE_MARKER}`,
          );
        }

        if (singleTaskFile) {
          const taskStatus = await getTaskStatus(singleTaskFile);

          if (taskStatus !== 'completed') {
            throw new Error(
              `Post-run task state verification failed: ${singleTaskFile} status is "${taskStatus ?? 'unknown'}"`,
            );
          }
        }

        if (!singleTaskFile && markerDetection.hasStrictMatch) {
          const taskStates = await getTaskStates(taskFiles, tasksDirPath);
          const unresolvedTaskStates = findUnresolvedTaskStates(taskStates);

          if (unresolvedTaskStates.length > 0) {
            throw new Error(
              `Post-run task state verification failed: completion marker received with unresolved tasks: ${formatTaskStates(unresolvedTaskStates)}`,
            );
          }
        }

        if (markerDetection.hasStrictMatch) {
          completed++;
          agentSpinner?.stop(`Agent task ${i + 1} complete`);

          if (!singleTaskFile) {
            log.info('All pending tasks finished');
          }

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
