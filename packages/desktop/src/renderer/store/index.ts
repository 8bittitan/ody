import { create } from 'zustand';

import { createAgentSlice, type AgentSlice } from './slices/agentSlice';
import { createAppSlice, type AppSlice } from './slices/appSlice';
import { createUISlice, type UISlice } from './slices/uiSlice';
import { createViewSlice, type ViewSlice } from './slices/viewSlice';

export type AppStore = AgentSlice & UISlice & ViewSlice & AppSlice;

export const useStore = create<AppStore>()((...args) => ({
  ...createAgentSlice(...args),
  ...createUISlice(...args),
  ...createViewSlice(...args),
  ...createAppSlice(...args),
}));
