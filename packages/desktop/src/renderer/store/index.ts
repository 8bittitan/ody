import { create } from 'zustand';

import { createAgentSlice, type AgentSlice } from './slices/agentSlice';
import { createAuthSlice, type AuthSlice } from './slices/authSlice';
import { createConfigSlice, type ConfigSlice } from './slices/configSlice';
import { createProjectSlice, type ProjectSlice } from './slices/projectSlice';
import { createTaskSlice, type TaskSlice } from './slices/taskSlice';
import { createUISlice, type UISlice } from './slices/uiSlice';

export type AppStore = ProjectSlice & ConfigSlice & TaskSlice & AgentSlice & AuthSlice & UISlice;

export const useStore = create<AppStore>()((...args) => ({
  ...createProjectSlice(...args),
  ...createConfigSlice(...args),
  ...createTaskSlice(...args),
  ...createAgentSlice(...args),
  ...createAuthSlice(...args),
  ...createUISlice(...args),
}));
