import { stripAnsi } from '@/lib/ansi';
import type { AgentJobIdentity, AgentJobKey, AgentStatus } from '@/types/ipc';
import type { StateCreator } from 'zustand';

import type { AppStore } from '../index';

const MAX_OUTPUT_PREVIEW_LINES = 6;

const appendOutputPreview = (currentPreview: string, chunk: string) => {
  const combined = `${currentPreview}${stripAnsi(chunk)}`
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n');
  const lines = combined.split('\n').filter((line) => line.length > 0);
  return lines.slice(-MAX_OUTPUT_PREVIEW_LINES).join('\n');
};

export type AgentJobState = AgentJobIdentity & {
  isRunning: boolean;
  iteration: number;
  maxIterations: number;
  taskFiles: string[];
  output: string;
  outputPreview: string;
  isComplete: boolean;
  error: string | null;
};

export type AgentSlice = {
  jobs: Record<AgentJobKey, AgentJobState>;
  ensureJob: (status: Pick<AgentStatus, keyof AgentStatus>) => void;
  hydrateJobs: (statuses: AgentStatus[]) => void;
  setJobRunning: (status: AgentStatus, isRunning: boolean) => void;
  setJobIteration: (job: AgentJobIdentity, iteration: number, maxIterations: number) => void;
  appendJobOutput: (job: AgentJobIdentity, chunk: string) => void;
  setJobComplete: (job: AgentJobIdentity, isComplete: boolean) => void;
  setJobError: (job: AgentJobIdentity, error: string | null) => void;
  clearJobOutput: (jobKey: AgentJobKey) => void;
  resetJob: (jobKey: AgentJobKey) => void;
  resetProjectJobs: (projectPath: string) => void;
};

const createJobState = (status: AgentStatus): AgentJobState => ({
  ...status,
  output: '',
  outputPreview: '',
  isComplete: false,
  error: null,
});

const ensureJobState = (
  jobs: Record<AgentJobKey, AgentJobState>,
  status: AgentStatus,
): Record<AgentJobKey, AgentJobState> => {
  if (jobs[status.jobKey]) {
    return jobs;
  }

  return {
    ...jobs,
    [status.jobKey]: createJobState(status),
  };
};

export const selectAgentJob = (jobs: Record<AgentJobKey, AgentJobState>, jobKey: string | null) => {
  if (!jobKey) {
    return null;
  }

  return jobs[jobKey] ?? null;
};

export const createAgentSlice: StateCreator<AppStore, [], [], AgentSlice> = (set) => ({
  jobs: {},
  ensureJob: (status) =>
    set((state) => ({
      jobs: ensureJobState(state.jobs, status),
    })),
  hydrateJobs: (statuses) =>
    set((state) => {
      const nextJobs = { ...state.jobs };

      for (const status of statuses) {
        const current = nextJobs[status.jobKey];
        nextJobs[status.jobKey] = {
          ...(current ?? createJobState(status)),
          ...status,
          isRunning: true,
        };
      }

      return { jobs: nextJobs };
    }),
  setJobRunning: (status, isRunning) =>
    set((state) => {
      const jobs = ensureJobState(state.jobs, status);
      return {
        jobs: {
          ...jobs,
          [status.jobKey]: {
            ...jobs[status.jobKey]!,
            ...status,
            isRunning,
          },
        },
      };
    }),
  setJobIteration: (job, iteration, maxIterations) =>
    set((state) => {
      const current = state.jobs[job.jobKey];

      if (!current) {
        return state;
      }

      return {
        jobs: {
          ...state.jobs,
          [job.jobKey]: {
            ...current,
            iteration,
            maxIterations,
          },
        },
      };
    }),
  appendJobOutput: (job, chunk) =>
    set((state) => {
      const current = state.jobs[job.jobKey];

      if (!current) {
        return state;
      }

      return {
        jobs: {
          ...state.jobs,
          [job.jobKey]: {
            ...current,
            output: current.output + chunk,
            outputPreview: appendOutputPreview(current.outputPreview, chunk),
          },
        },
      };
    }),
  setJobComplete: (job, isComplete) =>
    set((state) => {
      const current = state.jobs[job.jobKey];

      if (!current) {
        return state;
      }

      return {
        jobs: {
          ...state.jobs,
          [job.jobKey]: {
            ...current,
            isComplete,
            isRunning: isComplete ? false : current.isRunning,
          },
        },
      };
    }),
  setJobError: (job, error) =>
    set((state) => {
      const current = state.jobs[job.jobKey];

      if (!current) {
        return state;
      }

      return {
        jobs: {
          ...state.jobs,
          [job.jobKey]: {
            ...current,
            error,
          },
        },
      };
    }),
  clearJobOutput: (jobKey) =>
    set((state) => {
      const current = state.jobs[jobKey];

      if (!current) {
        return state;
      }

      return {
        jobs: {
          ...state.jobs,
          [jobKey]: {
            ...current,
            output: '',
            outputPreview: '',
          },
        },
      };
    }),
  resetJob: (jobKey) =>
    set((state) => {
      const current = state.jobs[jobKey];

      if (!current) {
        return state;
      }

      return {
        jobs: {
          ...state.jobs,
          [jobKey]: createJobState({
            jobKey: current.jobKey,
            projectPath: current.projectPath,
            kind: current.kind,
            isRunning: false,
            iteration: 0,
            maxIterations: 0,
            taskFiles: [],
          }),
        },
      };
    }),
  resetProjectJobs: (projectPath) =>
    set((state) => {
      const nextJobs = { ...state.jobs };

      for (const [jobKey, job] of Object.entries(nextJobs)) {
        if (job.projectPath === projectPath) {
          nextJobs[jobKey] = createJobState({
            jobKey: job.jobKey,
            projectPath: job.projectPath,
            kind: job.kind,
            isRunning: false,
            iteration: 0,
            maxIterations: 0,
            taskFiles: [],
          });
        }
      }

      return { jobs: nextJobs };
    }),
});
