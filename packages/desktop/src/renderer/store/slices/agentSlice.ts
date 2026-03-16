import { stripAnsi } from '@/lib/ansi';
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

export type AgentSlice = {
  isRunning: boolean;
  iteration: number;
  maxIterations: number;
  output: string;
  outputPreview: string;
  isComplete: boolean;
  error: string | null;
  hasAmbiguousMarker: boolean;
  setRunning: (running: boolean) => void;
  setIteration: (iteration: number, maxIterations: number) => void;
  appendOutput: (chunk: string) => void;
  setComplete: (isComplete: boolean) => void;
  setError: (error: string | null) => void;
  setAmbiguousMarker: (hasAmbiguousMarker: boolean) => void;
  clearOutput: () => void;
  resetAgentState: () => void;
};

export const createAgentSlice: StateCreator<AppStore, [], [], AgentSlice> = (set) => ({
  isRunning: false,
  iteration: 0,
  maxIterations: 0,
  output: '',
  outputPreview: '',
  isComplete: false,
  error: null,
  hasAmbiguousMarker: false,
  setRunning: (isRunning) => set({ isRunning }),
  setIteration: (iteration, maxIterations) => set({ iteration, maxIterations }),
  appendOutput: (chunk) =>
    set((state) => ({
      output: state.output + chunk,
      outputPreview: appendOutputPreview(state.outputPreview, chunk),
    })),
  setComplete: (isComplete) => set({ isComplete }),
  setError: (error) => set({ error }),
  setAmbiguousMarker: (hasAmbiguousMarker) => set({ hasAmbiguousMarker }),
  clearOutput: () => set({ output: '', outputPreview: '' }),
  resetAgentState: () =>
    set({
      isRunning: false,
      iteration: 0,
      maxIterations: 0,
      output: '',
      outputPreview: '',
      isComplete: false,
      error: null,
      hasAmbiguousMarker: false,
    }),
});
