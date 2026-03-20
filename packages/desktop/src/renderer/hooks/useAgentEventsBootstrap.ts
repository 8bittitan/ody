import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useStore } from '@/store';
import { useEffect } from 'react';

const hydrateAgentStatus = async () => {
  try {
    const statuses = await api.agent.status();
    useStore.getState().hydrateJobs(statuses);
  } catch {
    // Ignore hydration failures - the store keeps its current values.
  }
};

export const useAgentEventsBootstrap = () => {
  useEffect(() => {
    const unbindStarted = api.agent.onStarted((status) => {
      const state = useStore.getState();
      state.setJobRunning(status, true);
      state.setJobComplete(status, false);
      state.setJobError(status, null);
    });

    const unbindIteration = api.agent.onIteration((event) => {
      useStore.getState().setJobIteration(event, event.iteration, event.maxIterations);
    });

    const unbindOutput = api.agent.onOutput((event) => {
      useStore.getState().appendJobOutput(event, event.chunk);
    });

    const unbindComplete = api.agent.onComplete((event) => {
      const state = useStore.getState();
      state.setJobComplete(event, true);

      if (event.reason === 'no_tasks_remaining') {
        toast.accent('No tasks left to run', {
          description: 'The continuous run stopped because there are no unresolved tasks remaining.',
        });
      }
    });

    const unbindStopped = api.agent.onStopped((job) => {
      const state = useStore.getState();
      const current = state.jobs[job.jobKey];

      if (!current) {
        return;
      }

      state.setJobRunning(current, false);
    });

    const unbindVerifyFailed = api.agent.onVerifyFailed((event) => {
      useStore.getState().setJobError(event, event.message);
    });

    const unbindSwitched = api.projects.onSwitched(() => {
      void hydrateAgentStatus();
    });

    void hydrateAgentStatus();

    return () => {
      unbindStarted();
      unbindIteration();
      unbindOutput();
      unbindComplete();
      unbindStopped();
      unbindVerifyFailed();
      unbindSwitched();
    };
  }, []);
};
