import type { StateCreator } from 'zustand';

import type { AppStore } from '../index';

export type AuthStore = {
  jira: Record<string, unknown>;
  github: Record<string, unknown>;
};

export type AuthSlice = {
  authStore: AuthStore | null;
  isLoadingAuth: boolean;
  setAuthStore: (authStore: AuthStore | null) => void;
  setAuthLoading: (isLoading: boolean) => void;
  clearAuthStore: () => void;
};

export const createAuthSlice: StateCreator<AppStore, [], [], AuthSlice> = (set) => ({
  authStore: null,
  isLoadingAuth: false,
  setAuthStore: (authStore) => set({ authStore }),
  setAuthLoading: (isLoadingAuth) => set({ isLoadingAuth }),
  clearAuthStore: () => set({ authStore: null }),
});
