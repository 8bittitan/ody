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

const useAgentLifecycle = () => {
  ensureAgentListeners();
};

export const useAgentStatus = () => {
  useAgentLifecycle();

  const isRunning = useStore((state) => state.isRunning);
  const iteration = useStore((state) => state.iteration);
  const maxIterations = useStore((state) => state.maxIterations);
  const isComplete = useStore((state) => state.isComplete);

  return {
    isRunning,
    iteration,
    maxIterations,
    isComplete,
  };
};

export const useAgentOutput = () => {
  useAgentLifecycle();

  const output = useStore((state) => state.output);
  const outputPreview = useStore((state) => state.outputPreview);
  const error = useStore((state) => state.error);
  const hasAmbiguousMarker = useStore((state) => state.hasAmbiguousMarker);
  const clearOutput = useCallback(() => {
    useStore.getState().clearOutput();
  }, []);

  return {
    output,
    outputPreview,
    error,
    hasAmbiguousMarker,
    clearOutput,
  };
};

export const useAgentControls = () => {
  useAgentLifecycle();

  const start = useCallback(async (opts: RunOptions) => {
    const state = useStore.getState();
    state.clearOutput();
    state.setError(null);
    state.setComplete(false);
    state.setAmbiguousMarker(false);
    state.setIteration(0, opts.iterations ?? 0);
    let result;

    try {
      result = await api.agent.run(opts);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to start run';
      useStore.getState().setError(message);
      toast.error('Failed to start run', { description: message });
      throw cause;
    }

    if (result.started) {
      useStore.getState().setRunning(true);
    }

    return result;
  }, []);

  const stop = useCallback(async (force?: boolean) => {
    let result;

    try {
      result = await api.agent.stop(force);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to stop run';
      useStore.getState().setError(message);
      toast.error('Failed to stop run', { description: message });
      throw cause;
    }

    if (result.stopped) {
      useStore.getState().setRunning(false);
    }

    return result;
  }, []);

  return {
    start,
    stop,
  };
};

export const useAgent = () => {
  const status = useAgentStatus();
  const output = useAgentOutput();
  const controls = useAgentControls();

  return {
    ...status,
    ...output,
    ...controls,
  };
};
