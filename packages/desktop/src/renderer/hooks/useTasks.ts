import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useStore } from '@/store';
import type { TaskState, TaskStatus, TaskSummary } from '@/types/ipc';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useProjects } from './useProjects';

const EMPTY_TASKS: TaskSummary[] = [];
const EMPTY_STATES: TaskState[] = [];

export const useTasks = () => {
  const queryClient = useQueryClient();
  const { activeProjectPath } = useProjects();

  const labelFilter = useStore((state) => state.labelFilter);
  const statusFilter = useStore((state) => state.statusFilter);
  const selectedTaskPath = useStore((state) => state.selectedTaskPath);
  const setLabelFilter = useStore((state) => state.setLabelFilter);
  const setStatusFilter = useStore((state) => state.setStatusFilter);
  const setSelectedTaskPath = useStore((state) => state.setSelectedTaskPath);

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

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesLabel = labelFilter === null || task.labels.includes(labelFilter);
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      return matchesLabel && matchesStatus;
    });
  }, [labelFilter, statusFilter, tasks]);

  const setFilters = useCallback(
    (filters: { label?: string | null; status?: TaskStatus | 'all' }) => {
      if (filters.label !== undefined) {
        setLabelFilter(filters.label);
      }

      if (filters.status !== undefined) {
        setStatusFilter(filters.status);
      }
    },
    [setLabelFilter, setStatusFilter],
  );

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
    filteredTasks,
    labelFilter,
    statusFilter,
    selectedTaskPath,
    isLoading,
    setFilters,
    setSelectedTaskPath,
    loadTasks,
    refreshTasks,
    readTask,
  };
};
