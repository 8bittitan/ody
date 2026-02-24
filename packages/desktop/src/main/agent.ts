import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';

import { Backend } from '@internal/backends';
import { buildRunPrompt } from '@internal/builders';
import { Config, TASKS_DIR, type OdyConfig } from '@internal/config';
import { getTaskStates, getTaskStatus, type TaskState } from '@internal/tasks';
import { Notification, type BrowserWindow } from 'electron';

import type { RunOptions } from '../renderer/types/ipc';

const COMPLETE_MARKER = '<woof>COMPLETE</woof>';

type MarkerDetectionResult = {
  hasStrictMatch: boolean;
  hasAmbiguousMention: boolean;
};

type CompletionMarkerDetector = {
  onChunk: (chunk: string) => void;
  finalize: () => MarkerDetectionResult;
};

type SpawnResult = MarkerDetectionResult;

function createCompletionMarkerDetector(): CompletionMarkerDetector {
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
    onChunk(chunk: string) {
      partialLine += chunk;
      const lines = partialLine.split(/\r?\n/);
      partialLine = lines.pop() ?? '';

      for (const line of lines) {
        inspectLine(line);
      }
    },
    finalize() {
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

function resolveTaskPath(taskFile: string, projectDir: string, tasksDirPath: string) {
  if (path.isAbsolute(taskFile)) {
    return taskFile;
  }

  if (taskFile.includes(path.sep)) {
    return path.join(projectDir, taskFile);
  }

  return path.join(tasksDirPath, taskFile);
}

export class AgentRunner {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private aborted = false;
  private forceStop = false;

  constructor(
    private readonly options?: {
      shouldPlaySound?: () => boolean;
      playSound?: () => void;
    },
  ) {}

  isRunning() {
    return this.proc !== null;
  }

  async runLoop(win: BrowserWindow, opts: RunOptions, resolvedConfig?: OdyConfig) {
    if (this.proc) {
      throw new Error('Agent is already running');
    }

    let config = resolvedConfig;

    if (!config) {
      await Config.load();
      config = Config.all();
    }

    const backend = new Backend(config.backend, config);
    const model = Config.resolveModel('run', config);
    const notifyRaw = config.notify ?? false;
    const notifySetting: false | 'all' | 'individual' = notifyRaw === true ? 'all' : notifyRaw;
    const singleTaskFile = opts.taskFiles?.length === 1 ? opts.taskFiles[0] : undefined;
    const prompt = buildRunPrompt({
      taskFiles: opts.taskFiles,
      taskFile: singleTaskFile,
      config,
    });
    const maxIterations = Math.max(0, opts.iterations ?? config.maxIterations);
    const tasksDirPath = path.join(opts.projectDir, '.ody', config.tasksDir ?? TASKS_DIR);

    this.aborted = false;
    this.forceStop = false;
    win.webContents.send('agent:started');

    for (
      let iteration = 1;
      !this.aborted && (maxIterations === 0 || iteration <= maxIterations);
      iteration++
    ) {
      win.webContents.send('agent:iteration', iteration, maxIterations);

      const cmd = backend.buildCommand(prompt, model);
      const result = await this.spawnAndStream(win, cmd, opts.projectDir);

      if (this.forceStop) {
        break;
      }

      if (result.hasAmbiguousMention) {
        win.webContents.send('agent:ambiguousMarker');
      }

      await this.verifyTaskStates({
        opts,
        tasksDirPath,
        markerDetection: result,
        singleTaskFile,
      });

      if (result.hasStrictMatch) {
        break;
      }

      if (notifySetting === 'individual') {
        this.sendNotification('Ody', `Agent iteration ${iteration} complete`);
      }
    }

    if (!this.forceStop) {
      win.webContents.send('agent:complete');
      if (notifySetting === 'all') {
        this.sendNotification('Ody', 'Agent run complete');
      }

      if (this.options?.shouldPlaySound?.()) {
        this.options.playSound?.();
      }
    }
  }

  async spawnAndStream(win: BrowserWindow, cmd: string[], cwd: string): Promise<SpawnResult> {
    const [bin, ...args] = cmd;

    if (!bin) {
      throw new Error('Cannot start agent process: command is empty');
    }

    const proc = spawn(bin, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.proc = proc;

    const markerDetector = createCompletionMarkerDetector();

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      markerDetector.onChunk(text);
      win.webContents.send('agent:output', text);
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      markerDetector.onChunk(text);
      win.webContents.send('agent:output', text);
    });

    const [exitCode] = await once(proc, 'close');

    this.proc = null;

    if (this.forceStop) {
      win.webContents.send('agent:stopped');
      return { hasStrictMatch: false, hasAmbiguousMention: false };
    }

    if (exitCode !== 0) {
      throw new Error(`Process exit failure: backend exited with code ${exitCode ?? 'unknown'}`);
    }

    return markerDetector.finalize();
  }

  stop(force = false) {
    if (!this.proc) {
      this.aborted = true;
      return;
    }

    if (force) {
      this.forceStop = true;
      this.proc.kill('SIGKILL');
      this.proc = null;
      return;
    }

    this.aborted = true;
  }

  private async verifyTaskStates(input: {
    opts: RunOptions;
    tasksDirPath: string;
    markerDetection: MarkerDetectionResult;
    singleTaskFile?: string;
  }) {
    const { opts, tasksDirPath, markerDetection, singleTaskFile } = input;

    if (singleTaskFile) {
      const taskStatus = await getTaskStatus(
        resolveTaskPath(singleTaskFile, opts.projectDir, tasksDirPath),
      );

      if (taskStatus !== 'completed') {
        throw new Error(
          `Post-run task state verification failed: ${singleTaskFile} status is "${taskStatus ?? 'unknown'}"`,
        );
      }

      return;
    }

    if (!markerDetection.hasStrictMatch) {
      return;
    }

    const taskStates = await getTaskStates(opts.taskFiles, tasksDirPath);
    const unresolvedTaskStates = findUnresolvedTaskStates(taskStates);

    if (unresolvedTaskStates.length > 0) {
      throw new Error(
        `Post-run task state verification failed: completion marker received with unresolved tasks: ${formatTaskStates(unresolvedTaskStates)}`,
      );
    }
  }

  private sendNotification(title: string, body: string) {
    if (!Notification.isSupported()) {
      return;
    }

    new Notification({ title, body }).show();
  }
}
