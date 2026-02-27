export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    list: ['projects', 'list'] as const,
    active: ['projects', 'active'] as const,
  },
  config: {
    all: ['config'] as const,
    data: (projectPath: string | null) => ['config', 'data', projectPath] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    list: (projectPath: string | null) => ['tasks', 'list', projectPath] as const,
    states: (projectPath: string | null) => ['tasks', 'states', projectPath] as const,
  },
  auth: {
    all: ['auth'] as const,
    list: ['auth', 'list'] as const,
  },
};
