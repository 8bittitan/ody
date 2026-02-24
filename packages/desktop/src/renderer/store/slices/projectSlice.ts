import type { StateCreator } from 'zustand';

import type { AppStore } from '../index';

export type ProjectItem = {
  name: string;
  path: string;
};

export type ProjectSlice = {
  projects: ProjectItem[];
  activeProjectPath: string | null;
  isLoadingProjects: boolean;
  setProjects: (projects: ProjectItem[]) => void;
  setActiveProject: (path: string | null) => void;
  setProjectsLoading: (isLoading: boolean) => void;
  addProject: (project: ProjectItem) => void;
  removeProject: (path: string) => void;
};

export const createProjectSlice: StateCreator<AppStore, [], [], ProjectSlice> = (set) => ({
  projects: [],
  activeProjectPath: null,
  isLoadingProjects: false,
  setProjects: (projects) => set({ projects }),
  setActiveProject: (path) => set({ activeProjectPath: path }),
  setProjectsLoading: (isLoadingProjects) => set({ isLoadingProjects }),
  addProject: (project) =>
    set((state) => ({
      projects: state.projects.some((entry) => entry.path === project.path)
        ? state.projects
        : [...state.projects, project],
    })),
  removeProject: (path) =>
    set((state) => ({
      projects: state.projects.filter((project) => project.path !== path),
      activeProjectPath: state.activeProjectPath === path ? null : state.activeProjectPath,
    })),
});
