import type { StateCreator } from 'zustand';

import type { AppStore } from '../index';

type ConfigLayers = {
  gui: Record<string, unknown> | null;
  local: Record<string, unknown> | null;
  global: Record<string, unknown> | null;
};

type ConfigValidation = {
  valid: boolean;
  issues: string[];
} | null;

export type ConfigSlice = {
  config: Record<string, unknown> | null;
  layers: ConfigLayers;
  validation: ConfigValidation;
  isLoadingConfig: boolean;
  setConfigData: (payload: {
    config: Record<string, unknown> | null;
    layers: ConfigLayers;
  }) => void;
  setConfigLoading: (isLoading: boolean) => void;
  setValidation: (validation: ConfigValidation) => void;
  resetGuiOverridesState: () => void;
};

export const createConfigSlice: StateCreator<AppStore, [], [], ConfigSlice> = (set) => ({
  config: null,
  layers: {
    gui: null,
    local: null,
    global: null,
  },
  validation: null,
  isLoadingConfig: false,
  setConfigData: ({ config, layers }) =>
    set({
      config,
      layers,
    }),
  setConfigLoading: (isLoadingConfig) => set({ isLoadingConfig }),
  setValidation: (validation) => set({ validation }),
  resetGuiOverridesState: () =>
    set((state) => ({
      layers: {
        ...state.layers,
        gui: null,
      },
    })),
});
