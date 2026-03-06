import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useStore } from '@/store';
import type { AgentCompletionReason, RunOptions } from '@/types/ipc';
import { useCallback } from 'react';

let cleanupAgentListeners: (() => void) | null = null;

const hydrateAgentStatus = async () => {
  try {
    const status = await api.agent.status();
    const state = useStore.getState();
    state.setRunning(status.isRunning);
    state.setIteration(status.iteration, status.maxIterations);
  } catch {
    // Ignore hydration failures — the store keeps its current values
  }
};

const ensureAgentListeners = () => {
  if (cleanupAgentListeners) {
    return;
  }

  const unbindStarted = api.agent.onStarted(() => {
    const state = useStore.getState();
    state.setRunning(true);
    state.setComplete(false);
    state.setError(null);
    state.setAmbiguousMarker(false);
  });

  const unbindIteration = api.agent.onIteration((nextIteration, nextMaxIterations) => {
    useStore.getState().setIteration(nextIteration, nextMaxIterations);
  });

  const unbindOutput = api.agent.onOutput((chunk) => {
    useStore.getState().appendOutput(chunk);
  });

  const unbindComplete = api.agent.onComplete((reason?: AgentCompletionReason) => {
    const state = useStore.getState();
    state.setRunning(false);
    state.setComplete(true);

    if (reason === 'no_tasks_remaining') {
      toast.accent('No tasks left to run', {
        description: 'The continuous run stopped because there are no unresolved tasks remaining.',
      });
    }
  });

  const unbindStopped = api.agent.onStopped(() => {
    useStore.getState().setRunning(false);
  });

  const unbindVerifyFailed = api.agent.onVerifyFailed((message) => {
    useStore.getState().setError(message);
  });

  const unbindAmbiguousMarker = api.agent.onAmbiguousMarker(() => {
    useStore.getState().setAmbiguousMarker(true);
  });

  const unbindSwitched = api.projects.onSwitched(() => {
    void hydrateAgentStatus();
  });

  void hydrateAgentStatus();

  cleanupAgentListeners = () => {
    unbindStarted();
    unbindIteration();
    unbindOutput();
    unbindComplete();
    unbindStopped();
    unbindVerifyFailed();
    unbindAmbiguousMarker();
    unbindSwitched();
    cleanupAgentListeners = null;
  };
};

export const useAgent = () => {
  ensureAgentListeners();

  const isRunning = useStore((state) => state.isRunning);
  const iteration = useStore((state) => state.iteration);
  const maxIterations = useStore((state) => state.maxIterations);
  const output = useStore((state) => state.output);
  const isComplete = useStore((state) => state.isComplete);
  const error = useStore((state) => state.error);
  const hasAmbiguousMarker = useStore((state) => state.hasAmbiguousMarker);
  const setRunning = useStore((state) => state.setRunning);
  const setIteration = useStore((state) => state.setIteration);
  const setComplete = useStore((state) => state.setComplete);
  const setError = useStore((state) => state.setError);
  const setAmbiguousMarker = useStore((state) => state.setAmbiguousMarker);
  const clearOutput = useStore((state) => state.clearOutput);

  const start = useCallback(
    async (opts: RunOptions) => {
      clearOutput();
      setError(null);
      setComplete(false);
      setAmbiguousMarker(false);
      setIteration(0, opts.iterations ?? 0);
      let result;

      try {
        result = await api.agent.run(opts);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Unable to start run';
        setError(message);
        toast.error('Failed to start run', { description: message });
        throw cause;
      }

      if (result.started) {
        setRunning(true);
      }

      return result;
    },
    [clearOutput, setAmbiguousMarker, setComplete, setError, setIteration, setRunning],
  );

  const stop = useCallback(
    async (force?: boolean) => {
      let result;

      try {
        result = await api.agent.stop(force);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Unable to stop run';
        setError(message);
        toast.error('Failed to stop run', { description: message });
        throw cause;
      }

      if (result.stopped) {
        setRunning(false);
      }

      return result;
    },
    [setRunning, setError],
  );

  return {
    isRunning,
    iteration,
    maxIterations,
    output,
    isComplete,
    error,
    hasAmbiguousMarker,
    start,
    stop,
    clearOutput,
  };
};
