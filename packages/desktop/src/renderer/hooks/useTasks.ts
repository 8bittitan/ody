import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useStore } from '@/store';
import type { TaskStatus } from '@/types/ipc';
import { useCallback, useMemo } from 'react';

export const useTasks = () => {
  const tasks = useStore((state) => state.tasks);
  const taskStates = useStore((state) => state.taskStates);
  const labelFilter = useStore((state) => state.labelFilter);
  const statusFilter = useStore((state) => state.statusFilter);
  const selectedTaskPath = useStore((state) => state.selectedTaskPath);
  const isLoading = useStore((state) => state.isLoadingTasks);
  const setTasks = useStore((state) => state.setTasks);
  const setTaskStates = useStore((state) => state.setTaskStates);
  const setLabelFilter = useStore((state) => state.setLabelFilter);
  const setStatusFilter = useStore((state) => state.setStatusFilter);
  const setSelectedTaskPath = useStore((state) => state.setSelectedTaskPath);
  const setTasksLoading = useStore((state) => state.setTasksLoading);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);

    try {
      const [taskList, states] = await Promise.all([api.tasks.list(), api.tasks.states()]);
      setTasks(taskList);
      setTaskStates(states);
      return taskList;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to load tasks';
      toast.error('Failed to load tasks', { description: message });
      throw cause;
    } finally {
      setTasksLoading(false);
    }
  }, [setTaskStates, setTasks, setTasksLoading]);

  const refreshTasks = useCallback(async () => loadTasks(), [loadTasks]);

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

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesLabel = labelFilter === null || task.labels.includes(labelFilter);
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      return matchesLabel && matchesStatus;
    });
  }, [labelFilter, statusFilter, tasks]);

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
