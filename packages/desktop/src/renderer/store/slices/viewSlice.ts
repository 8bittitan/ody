import type { TaskStatus } from '@/types/ipc';
import type { StateCreator } from 'zustand';

import type { AppStore } from '../index';

export type ViewSlice = {
  labelFilter: string | null;
  statusFilter: TaskStatus | 'all';
  selectedTaskPath: string | null;
  configEditorPath: string | null;
  setLabelFilter: (label: string | null) => void;
  setStatusFilter: (status: TaskStatus | 'all') => void;
  setSelectedTaskPath: (path: string | null) => void;
  setConfigEditorPath: (path: string | null) => void;
};

export const createViewSlice: StateCreator<AppStore, [], [], ViewSlice> = (set) => ({
  labelFilter: null,
  statusFilter: 'all',
  selectedTaskPath: null,
  configEditorPath: null,
  setLabelFilter: (labelFilter) => set({ labelFilter }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSelectedTaskPath: (selectedTaskPath) => set({ selectedTaskPath }),
  setConfigEditorPath: (configEditorPath) => set({ configEditorPath }),
});
