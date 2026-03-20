import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useStore } from '@/store';
import { selectAgentJob } from '@/store/slices/agentSlice';
import type { AgentJobKind, AgentStatus, RunOptions } from '@/types/ipc';
import { buildAgentJobKey } from '@/types/ipc';
import { useCallback, useMemo } from 'react';

const EMPTY_JOB = {
  isRunning: false,
  iteration: 0,
  maxIterations: 0,
  outputHtmlChunks: [],
  outputPreview: '',
  totalOutputBytes: 0,
  isOutputTruncated: false,
  isComplete: false,
  error: null,
  taskFiles: [],
};

export const useAgentJob = (projectPath: string | null, kind: AgentJobKind) => {
  const jobKey = useMemo(
    () => (projectPath ? buildAgentJobKey(projectPath, kind) : null),
    [kind, projectPath],
  );
  const job = useStore((state) => selectAgentJob(state.jobs, jobKey));
  const clearOutput = useCallback(() => {
    if (!jobKey) {
      return;
    }

    useStore.getState().clearJobOutput(jobKey);
  }, [jobKey]);
  const reset = useCallback(() => {
    if (!jobKey) {
      return;
    }

    useStore.getState().resetJob(jobKey);
  }, [jobKey]);
  const stop = useCallback(
    async (force?: boolean) => {
      if (!jobKey) {
        return { stopped: false };
      }

      return api.agent.stop({ jobKey, force });
    },
    [jobKey],
  );

  return {
    jobKey,
    ...(job ?? EMPTY_JOB),
    hasOutput: (job ?? EMPTY_JOB).outputHtmlChunks.length > 0,
    clearOutput,
    reset,
    stop,
  };
};

export const useRunAgent = (projectPath: string | null) => {
  const job = useAgentJob(projectPath, 'run');

  const start = useCallback(
    async (opts: RunOptions) => {
      if (!projectPath) {
        return { started: false };
      }

      if (job.isRunning) {
        return { started: false };
      }

      const state = useStore.getState();
      const nextStatus: AgentStatus = {
        jobKey: buildAgentJobKey(projectPath, 'run'),
        projectPath,
        kind: 'run',
        isRunning: false,
        iteration: 0,
        maxIterations: opts.iterations ?? 0,
        taskFiles: opts.taskFiles ?? [],
      };

      state.setJobRunning(nextStatus, false);
      state.clearJobOutput(nextStatus.jobKey);
      state.setJobError(nextStatus, null);
      state.setJobComplete(nextStatus, false);
      state.setJobIteration(nextStatus, 0, opts.iterations ?? 0);

      try {
        return await api.agent.run({
          projectPath,
          kind: 'run',
          taskFiles: opts.taskFiles,
          iterations: opts.iterations,
        });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Unable to start run';
        useStore.getState().setJobError(nextStatus, message);
        toast.error('Failed to start run', { description: message });
        throw cause;
      }
    },
    [job.isRunning, projectPath],
  );

  return {
    ...job,
    start,
  };
};

export const usePlanAgent = (projectPath: string | null) => {
  const job = useAgentJob(projectPath, 'plan');

  const prepare = useCallback(() => {
    if (!projectPath) {
      return null;
    }

    const status: AgentStatus = {
      jobKey: buildAgentJobKey(projectPath, 'plan'),
      projectPath,
      kind: 'plan',
      isRunning: false,
      iteration: 0,
      maxIterations: 0,
      taskFiles: [],
    };

    const state = useStore.getState();
    state.setJobRunning(status, false);
    state.clearJobOutput(status.jobKey);
    state.setJobError(status, null);
    state.setJobComplete(status, false);

    return status;
  }, [projectPath]);

  const startNew = useCallback(
    async (description: string) => {
      if (!projectPath) {
        return { started: false };
      }

      if (job.isRunning) {
        return { started: false };
      }

      prepare();
      return api.agent.planNew({ projectPath, kind: 'plan', description });
    },
    [job.isRunning, prepare, projectPath],
  );

  const startBatch = useCallback(
    async (filePath: string) => {
      if (!projectPath) {
        return { started: false };
      }

      if (job.isRunning) {
        return { started: false };
      }

      prepare();
      return api.agent.planBatch({ projectPath, kind: 'plan', filePath });
    },
    [job.isRunning, prepare, projectPath],
  );

  const startImport = useCallback(
    async (source: 'jira' | 'github', input: string) => {
      if (!projectPath) {
        return { started: false };
      }

      if (job.isRunning) {
        return { started: false };
      }

      prepare();
      return source === 'jira'
        ? api.agent.importFromJira({ projectPath, kind: 'plan', input })
        : api.agent.importFromGitHub({ projectPath, kind: 'plan', input });
    },
    [job.isRunning, prepare, projectPath],
  );

  return {
    ...job,
    startNew,
    startBatch,
    startImport,
  };
};

export const useEditAgent = (projectPath: string | null) => useAgentJob(projectPath, 'edit');

export const useProjectAgentJobs = (projectPath: string | null) => {
  const hasRunningJobs = useStore((state) => {
    if (!projectPath) {
      return false;
    }

    return Object.values(state.jobs).some(
      (job) => job.projectPath === projectPath && job.isRunning,
    );
  });
  const stopAll = useCallback(async () => {
    if (!projectPath) {
      return;
    }

    const jobs = Object.values(useStore.getState().jobs).filter(
      (job) => job.projectPath === projectPath && job.isRunning,
    );

    await Promise.all(jobs.map((job) => api.agent.stop({ jobKey: job.jobKey, force: true })));
  }, [projectPath]);

  return {
    hasRunningJobs,
    stopAll,
  };
};
