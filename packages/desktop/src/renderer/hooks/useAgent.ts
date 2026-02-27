import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useStore } from '@/store';
import type { RunOptions } from '@/types/ipc';
import { useCallback, useEffect } from 'react';

export const useAgent = () => {
  const isRunning = useStore((state) => state.isRunning);
  const iteration = useStore((state) => state.iteration);
  const maxIterations = useStore((state) => state.maxIterations);
  const output = useStore((state) => state.output);
  const isComplete = useStore((state) => state.isComplete);
  const error = useStore((state) => state.error);
  const hasAmbiguousMarker = useStore((state) => state.hasAmbiguousMarker);
  const setRunning = useStore((state) => state.setRunning);
  const setIteration = useStore((state) => state.setIteration);
  const appendOutput = useStore((state) => state.appendOutput);
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

  useEffect(() => {
    const unbindStarted = api.agent.onStarted(() => {
      setRunning(true);
      setComplete(false);
      setError(null);
      setAmbiguousMarker(false);
    });

    const unbindIteration = api.agent.onIteration((nextIteration, nextMaxIterations) => {
      setIteration(nextIteration, nextMaxIterations);
    });

    const unbindOutput = api.agent.onOutput((chunk) => {
      appendOutput(chunk);
    });

    const unbindComplete = api.agent.onComplete(() => {
      setRunning(false);
      setComplete(true);
    });

    const unbindStopped = api.agent.onStopped(() => {
      setRunning(false);
    });

    const unbindVerifyFailed = api.agent.onVerifyFailed((message) => {
      setError(message);
    });

    const unbindAmbiguousMarker = api.agent.onAmbiguousMarker(() => {
      setAmbiguousMarker(true);
    });

    return () => {
      unbindStarted();
      unbindIteration();
      unbindOutput();
      unbindComplete();
      unbindStopped();
      unbindVerifyFailed();
      unbindAmbiguousMarker();
    };
  }, [appendOutput, setAmbiguousMarker, setComplete, setError, setIteration, setRunning]);

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
