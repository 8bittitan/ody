import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { TaskState, TaskSummary } from '@/types/ipc';
import type { QueryClient } from '@tanstack/react-query';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { useProjects } from './useProjects';

const EMPTY_TASKS: TaskSummary[] = [];
const EMPTY_STATES: TaskState[] = [];

let taskChangeSubscriberCount = 0;
let removeTaskChangeListener: (() => void) | null = null;

const subscribeToTaskChanges = (queryClient: QueryClient) => {
  taskChangeSubscriberCount += 1;

  if (!removeTaskChangeListener) {
    removeTaskChangeListener = api.tasks.onChanged(({ projectPath }) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(projectPath) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.states(projectPath) }),
      ]);
    });
  }

  return () => {
    taskChangeSubscriberCount = Math.max(0, taskChangeSubscriberCount - 1);

    if (taskChangeSubscriberCount === 0 && removeTaskChangeListener) {
      removeTaskChangeListener();
      removeTaskChangeListener = null;
    }
  };
};

export const useTasks = () => {
  const queryClient = useQueryClient();
  const { activeProjectPath } = useProjects();

  useEffect(() => subscribeToTaskChanges(queryClient), [queryClient]);

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks.list(activeProjectPath),
    queryFn: () => api.tasks.list(),
    enabled: !!activeProjectPath,
  });

  const statesQuery = useQuery({
    queryKey: queryKeys.tasks.states(activeProjectPath),
    queryFn: () => api.tasks.states(),
    enabled: !!activeProjectPath,
  });

  const tasks = tasksQuery.data ?? EMPTY_TASKS;
  const taskStates = statesQuery.data ?? EMPTY_STATES;
  const isLoading = tasksQuery.isLoading || statesQuery.isLoading;

  const loadTasks = useCallback(async () => {
    const [tasks] = await Promise.all([
      queryClient.fetchQuery({
        queryKey: queryKeys.tasks.list(activeProjectPath),
        queryFn: () => api.tasks.list(),
        staleTime: 0,
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.states(activeProjectPath) }),
    ]);

    return tasks ?? [];
  }, [queryClient, activeProjectPath]);

  const refreshTasks = useCallback(async () => loadTasks(), [loadTasks]);

  const readTask = useCallback((filePath: string) => api.tasks.read(filePath), []);

  return {
    tasks,
    taskStates,
    isLoading,
    loadTasks,
    refreshTasks,
    readTask,
  };
};
