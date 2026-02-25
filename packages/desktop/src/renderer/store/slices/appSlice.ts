import { StateCreator } from 'zustand';

import { AppStore } from '../index';

export type AppSlice = {
  isFullscreen: boolean;
  setIsFullscreen: (enabled: boolean) => void;
};

export const createAppSlice: StateCreator<AppStore, [], [], AppSlice> = (set) => ({
  isFullscreen: false,
  setIsFullscreen: (enabled) => {
    set({ isFullscreen: enabled });
  },
});
