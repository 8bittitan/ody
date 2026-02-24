import type { TaskState, TaskStatus, TaskSummary } from '@/types/ipc';
import type { StateCreator } from 'zustand';

import type { AppStore } from '../index';

export type TaskSlice = {
  tasks: TaskSummary[];
  taskStates: TaskState[];
  labelFilter: string | null;
  statusFilter: TaskStatus | 'all';
  selectedTaskPath: string | null;
  isLoadingTasks: boolean;
  setTasks: (tasks: TaskSummary[]) => void;
  setTaskStates: (taskStates: TaskState[]) => void;
  setLabelFilter: (label: string | null) => void;
  setStatusFilter: (status: TaskStatus | 'all') => void;
  setSelectedTaskPath: (path: string | null) => void;
  setTasksLoading: (isLoading: boolean) => void;
};

export const createTaskSlice: StateCreator<AppStore, [], [], TaskSlice> = (set) => ({
  tasks: [],
  taskStates: [],
  labelFilter: null,
  statusFilter: 'all',
  selectedTaskPath: null,
  isLoadingTasks: false,
  setTasks: (tasks) => set({ tasks }),
  setTaskStates: (taskStates) => set({ taskStates }),
  setLabelFilter: (labelFilter) => set({ labelFilter }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSelectedTaskPath: (selectedTaskPath) => set({ selectedTaskPath }),
  setTasksLoading: (isLoadingTasks) => set({ isLoadingTasks }),
});
