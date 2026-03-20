import { appendAnsiHtml, createAnsiRenderState, stripAnsi, type AnsiRenderState } from '@/lib/ansi';
import type { AgentJobIdentity, AgentJobKey, AgentStatus } from '@/types/ipc';
import type { StateCreator } from 'zustand';

import type { AppStore } from '../index';

const MAX_OUTPUT_PREVIEW_LINES = 6;
const MAX_OUTPUT_BYTES = 256 * 1024;
const MAX_OUTPUT_CHUNKS = 400;
const TRUNCATED_OUTPUT_HTML =
  '<span style="color:var(--muted-foreground);font-style:italic">... earlier output truncated ...</span>\n';

type OutputPreviewState = {
  lines: string[];
  partialLine: string;
};

const appendOutputPreview = (currentPreview: OutputPreviewState, chunk: string): OutputPreviewState => {
  const normalized = stripAnsi(chunk).replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  const segments = normalized.split('\n');
  const lines = [...currentPreview.lines];
  let partialLine = currentPreview.partialLine;

  for (const [index, segment] of segments.entries()) {
    partialLine += segment;

    if (index === segments.length - 1) {
      continue;
    }

    if (partialLine.length > 0) {
      lines.push(partialLine);
    }

    partialLine = '';
  }

  return {
    lines: lines.slice(-MAX_OUTPUT_PREVIEW_LINES),
    partialLine,
  };
};

export type AgentJobState = AgentJobIdentity & {
  isRunning: boolean;
  iteration: number;
  maxIterations: number;
  taskFiles: string[];
  outputHtmlChunks: string[];
  outputChunkSizes: number[];
  outputPreview: string;
  outputPreviewState: OutputPreviewState;
  totalOutputBytes: number;
  isOutputTruncated: boolean;
  ansiState: AnsiRenderState;
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
  outputHtmlChunks: [],
  outputChunkSizes: [],
  outputPreview: '',
  outputPreviewState: {
    lines: [],
    partialLine: '',
  },
  totalOutputBytes: 0,
  isOutputTruncated: false,
  ansiState: createAnsiRenderState(),
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

const appendAgentOutput = (current: AgentJobState, chunk: string): AgentJobState => {
  const chunkBytes = Buffer.byteLength(chunk, 'utf8');
  const rendered = appendAnsiHtml(chunk, current.ansiState);
  const previewState = appendOutputPreview(current.outputPreviewState, chunk);
  const outputHtmlChunks = [...current.outputHtmlChunks, rendered.html];
  const outputChunkSizes = [...current.outputChunkSizes, chunkBytes];
  let totalOutputBytes = current.totalOutputBytes + chunkBytes;
  let isOutputTruncated = current.isOutputTruncated;

  while (
    outputHtmlChunks.length > 1 &&
    (totalOutputBytes > MAX_OUTPUT_BYTES || outputHtmlChunks.length > MAX_OUTPUT_CHUNKS)
  ) {
    outputHtmlChunks.shift();
    totalOutputBytes -= outputChunkSizes.shift() ?? 0;
    isOutputTruncated = true;
  }

  if (isOutputTruncated) {
    if (outputHtmlChunks[0] !== TRUNCATED_OUTPUT_HTML) {
      outputHtmlChunks.unshift(TRUNCATED_OUTPUT_HTML);
    }
  } else if (outputHtmlChunks[0] === TRUNCATED_OUTPUT_HTML) {
    outputHtmlChunks.shift();
  }

  return {
    ...current,
    outputHtmlChunks,
    outputChunkSizes,
    outputPreview: previewState.lines.join('\n'),
    outputPreviewState: previewState,
    totalOutputBytes,
    isOutputTruncated,
    ansiState: rendered.state,
  };
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
            ...appendAgentOutput(current, chunk),
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
            outputHtmlChunks: [],
            outputChunkSizes: [],
            outputPreview: '',
            outputPreviewState: {
              lines: [],
              partialLine: '',
            },
            totalOutputBytes: 0,
            isOutputTruncated: false,
            ansiState: createAnsiRenderState(),
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
