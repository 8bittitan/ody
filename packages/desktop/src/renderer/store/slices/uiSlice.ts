import type { StateCreator } from 'zustand';

import type { AppStore } from '../index';

export type UISlice = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
};

const SIDEBAR_COLLAPSED_KEY = 'ody:sidebar-collapsed';

const getPersistedCollapsed = (): boolean => {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
};

const persistCollapsed = (collapsed: boolean) => {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  } catch {
    /* noop */
  }
};

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set, get) => ({
  sidebarCollapsed: getPersistedCollapsed(),
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    persistCollapsed(next);
    set({ sidebarCollapsed: next });
  },
  setSidebarCollapsed: (collapsed) => {
    persistCollapsed(collapsed);
    set({ sidebarCollapsed: collapsed });
  },
});
