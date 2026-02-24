import type { StateCreator } from 'zustand';

import type { AppStore } from '../index';

export type AgentSlice = {
  isRunning: boolean;
  iteration: number;
  maxIterations: number;
  output: string[];
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
  output: [],
  isComplete: false,
  error: null,
  hasAmbiguousMarker: false,
  setRunning: (isRunning) => set({ isRunning }),
  setIteration: (iteration, maxIterations) => set({ iteration, maxIterations }),
  appendOutput: (chunk) =>
    set((state) => ({
      output: [...state.output, chunk],
    })),
  setComplete: (isComplete) => set({ isComplete }),
  setError: (error) => set({ error }),
  setAmbiguousMarker: (hasAmbiguousMarker) => set({ hasAmbiguousMarker }),
  clearOutput: () => set({ output: [] }),
  resetAgentState: () =>
    set({
      isRunning: false,
      iteration: 0,
      maxIterations: 0,
      output: [],
      isComplete: false,
      error: null,
      hasAmbiguousMarker: false,
    }),
});
