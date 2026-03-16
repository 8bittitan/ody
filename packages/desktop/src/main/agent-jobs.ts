import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

import type { OdyConfig } from '@internal/config';
import type { BrowserWindow } from 'electron';

import type {
  AgentCompletionReason,
  AgentEditInlineRequest,
  AgentJobIdentity,
  AgentJobKey,
  AgentPlanBatchRequest,
  AgentPlanNewRequest,
  AgentRunRequest,
  AgentStatus,
  TaskChangeReason,
} from '../renderer/types/ipc';
import { buildAgentJobKey } from '../renderer/types/ipc';
import { AgentRunner } from './agent';

type RunnerCallbacks = {
  onStarted?: () => void;
  onIteration?: (iteration: number, maxIterations: number) => void;
  onIterationComplete?: (iteration: number, maxIterations: number) => void;
  onOutput?: (chunk: string) => void;
  onStopped?: () => void;
  onComplete?: (reason?: AgentCompletionReason) => void;
};

type ActiveJob = {
  identity: AgentJobIdentity;
  status: () => AgentStatus;
  stop: (force?: boolean) => Promise<boolean>;
};

const extractModifiedFile = (output: string) => {
  const match = output.match(/<modified_file>\s*([\s\S]*?)\s*<\/modified_file>/i);
  return match?.[1] ?? null;
};

export class DesktopAgentJobManager {
  private readonly jobs = new Map<AgentJobKey, ActiveJob>();

  constructor(
    private readonly win: BrowserWindow,
    private readonly options?: {
      shouldPlaySound?: () => boolean;
      playSound?: () => void;
      onTasksChanged?: (projectPath: string, reason: TaskChangeReason) => void;
    },
  ) {}

  statuses() {
    return [...this.jobs.values()].map((job) => job.status()).filter((status) => status.isRunning);
  }

  async stop(jobKey: AgentJobKey, force = false) {
    const job = this.jobs.get(jobKey);

    if (!job) {
      return false;
    }

    return job.stop(force);
  }

  hasRunningJobsForProject(projectPath: string) {
    return this.statuses().some((status) => status.projectPath === projectPath);
  }

  startRun(request: AgentRunRequest, resolvedConfig: OdyConfig) {
    const identity = this.createIdentity(request.projectPath, request.kind);

    if (this.jobs.has(identity.jobKey)) {
      return { started: false };
    }

    const runner = new AgentRunner(this.options);
    this.jobs.set(identity.jobKey, this.createRunnerJob(identity, runner));

    void runner
      .runLoop(
        {
          projectDir: request.projectPath,
          taskFiles: request.taskFiles,
          iterations: request.iterations,
        },
        resolvedConfig,
        this.createRunnerCallbacks(identity, runner),
      )
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.sendVerifyFailed(identity, message);
        this.sendStopped(identity);
      })
      .finally(() => {
        this.jobs.delete(identity.jobKey);
      });

    return { started: true, jobKey: identity.jobKey };
  }

  startPlan(
    request: AgentPlanNewRequest | AgentPlanBatchRequest,
    command: string[],
    projectPath: string,
    taskChangeReason: TaskChangeReason = 'plan-created',
  ) {
    const identity = this.createIdentity(request.projectPath, request.kind);

    if (this.jobs.has(identity.jobKey)) {
      return { started: false };
    }

    const runner = new AgentRunner(this.options);
    this.jobs.set(identity.jobKey, this.createRunnerJob(identity, runner));
    this.sendStarted(identity, runner.status());

    void runner
      .spawnAndStream(command, projectPath, {
        onOutput: (chunk) => {
          this.sendOutput(identity, chunk);
        },
      })
      .then((result) => {
        if (result.aborted) {
          this.sendStopped(identity);
          return;
        }

        this.sendComplete(identity);
        this.options?.onTasksChanged?.(identity.projectPath, taskChangeReason);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.sendVerifyFailed(identity, message);
        this.sendStopped(identity);
      })
      .finally(() => {
        this.jobs.delete(identity.jobKey);
      });

    return { started: true, jobKey: identity.jobKey };
  }

  startInlineEdit(request: AgentEditInlineRequest, command: string[]) {
    const identity = this.createIdentity(request.projectPath, request.kind);

    if (this.jobs.has(identity.jobKey)) {
      return { started: false };
    }

    const [bin, ...args] = command;

    if (!bin) {
      throw new Error('Cannot start inline edit: command is empty');
    }

    let proc: ChildProcessWithoutNullStreams | null = null;
    let snapshot: { filePath: string; content: string } | null = null;
    let running = false;

    const status = (): AgentStatus => ({
      ...identity,
      isRunning: running,
      iteration: 0,
      maxIterations: 0,
      taskFiles: [request.filePath],
    });

    const stop = async (force = false) => {
      if (!proc) {
        return Boolean(snapshot);
      }

      const closed = new Promise<boolean>((resolve) => {
        proc!.once('close', () => resolve(true));
      });
      proc.kill(force ? 'SIGKILL' : 'SIGTERM');
      return closed;
    };

    this.jobs.set(identity.jobKey, {
      identity,
      status,
      stop,
    });

    void (async () => {
      try {
        snapshot = {
          filePath: request.filePath,
          content: await readFile(request.filePath, 'utf-8'),
        };
        await writeFile(request.filePath, request.fileContent, 'utf-8');

        proc = spawn(bin, args, {
          cwd: request.projectPath,
          stdio: 'pipe',
        });
        running = true;
        this.sendStarted(identity, status());

        let fullOutput = '';
        proc.stdout.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf-8');
          fullOutput += text;
          this.sendOutput(identity, text);
        });
        proc.stderr.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf-8');
          fullOutput += text;
          this.sendOutput(identity, text);
        });

        const exitCode = await new Promise<number | null>((resolve, reject) => {
          proc!.once('error', reject);
          proc!.once('close', (code) => resolve(code));
        });

        running = false;
        proc = null;

        if (exitCode !== 0) {
          throw new Error(`Inline edit exited with code ${exitCode ?? 'unknown'}`);
        }

        const modifiedContent = extractModifiedFile(fullOutput);

        if (!modifiedContent) {
          throw new Error('Inline edit did not return <modified_file> output.');
        }

        await writeFile(request.filePath, modifiedContent, 'utf-8');
        this.win.webContents.send('agent:editResult', {
          ...identity,
          content: modifiedContent,
        });

        if (snapshot) {
          await writeFile(snapshot.filePath, snapshot.content, 'utf-8');
          snapshot = null;
        }

        this.sendComplete(identity);
      } catch (cause) {
        running = false;
        proc = null;

        if (snapshot) {
          try {
            await writeFile(snapshot.filePath, snapshot.content, 'utf-8');
          } catch {
            // ignore restore failures after inline edit errors
          }
          snapshot = null;
        }

        const message = cause instanceof Error ? cause.message : String(cause);
        this.sendVerifyFailed(identity, message);
        this.sendStopped(identity);
      } finally {
        this.jobs.delete(identity.jobKey);
      }
    })();

    return { started: true, jobKey: identity.jobKey };
  }

  private createIdentity(projectPath: string, kind: AgentJobIdentity['kind']): AgentJobIdentity {
    return {
      jobKey: buildAgentJobKey(projectPath, kind),
      projectPath,
      kind,
    };
  }

  private createRunnerJob(identity: AgentJobIdentity, runner: AgentRunner): ActiveJob {
    return {
      identity,
      status: () => ({
        ...identity,
        ...runner.status(),
      }),
      stop: (force) => runner.stop(force),
    };
  }

  private createRunnerCallbacks(identity: AgentJobIdentity, runner: AgentRunner): RunnerCallbacks {
    return {
      onStarted: () => {
        this.sendStarted(identity, runner.status());
      },
      onIteration: (iteration, maxIterations) => {
        this.win.webContents.send('agent:iteration', {
          ...identity,
          iteration,
          maxIterations,
        });
      },
      onIterationComplete: () => {
        this.options?.onTasksChanged?.(identity.projectPath, 'agent-iteration');
      },
      onOutput: (chunk) => {
        this.sendOutput(identity, chunk);
      },
      onStopped: () => {
        this.sendStopped(identity);
      },
      onComplete: (reason) => {
        this.sendComplete(identity, reason);
        this.options?.onTasksChanged?.(identity.projectPath, 'agent-complete');
      },
    };
  }

  private sendStarted(
    identity: AgentJobIdentity,
    status: Omit<AgentStatus, keyof AgentJobIdentity>,
  ) {
    this.win.webContents.send('agent:started', {
      ...identity,
      ...status,
    });
  }

  private sendOutput(identity: AgentJobIdentity, chunk: string) {
    this.win.webContents.send('agent:output', {
      ...identity,
      chunk,
    });
  }

  private sendComplete(identity: AgentJobIdentity, reason?: AgentCompletionReason) {
    this.win.webContents.send('agent:complete', {
      ...identity,
      reason,
    });
  }

  private sendStopped(identity: AgentJobIdentity) {
    this.win.webContents.send('agent:stopped', identity);
  }

  private sendVerifyFailed(identity: AgentJobIdentity, message: string) {
    this.win.webContents.send('agent:verifyFailed', {
      ...identity,
      message,
    });
  }
}
