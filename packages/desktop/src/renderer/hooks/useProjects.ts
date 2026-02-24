import { api } from '@/lib/api';
import { useStore } from '@/store';
import { useCallback, useEffect } from 'react';

export const useProjects = () => {
  const projects = useStore((state) => state.projects);
  const activeProjectPath = useStore((state) => state.activeProjectPath);
  const isLoading = useStore((state) => state.isLoadingProjects);
  const setProjects = useStore((state) => state.setProjects);
  const setActiveProject = useStore((state) => state.setActiveProject);
  const setProjectsLoading = useStore((state) => state.setProjectsLoading);
  const addProjectState = useStore((state) => state.addProject);
  const removeProjectState = useStore((state) => state.removeProject);

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);

    try {
      const [projectList, active] = await Promise.all([api.projects.list(), api.projects.active()]);
      setProjects(projectList);
      setActiveProject(active.path);
    } finally {
      setProjectsLoading(false);
    }
  }, [setActiveProject, setProjects, setProjectsLoading]);

  const addProject = useCallback(async () => {
    const result = await api.projects.add();

    if (result.added) {
      addProjectState(result.added);
      setActiveProject(result.added.path);
    }

    return result.added;
  }, [addProjectState, setActiveProject]);

  const removeProject = useCallback(
    async (path: string) => {
      await api.projects.remove(path);
      removeProjectState(path);

      if (path === activeProjectPath) {
        const active = await api.projects.active();
        setActiveProject(active.path);
      }
    },
    [activeProjectPath, removeProjectState, setActiveProject],
  );

  const switchProject = useCallback(
    async (path: string) => {
      const result = await api.projects.switch(path);
      if (!result.ok) {
        return false;
      }

      setActiveProject(path);
      return true;
    },
    [setActiveProject],
  );

  useEffect(() => {
    void loadProjects();

    return api.projects.onSwitched((path) => {
      setActiveProject(path);
    });
  }, [loadProjects, setActiveProject]);

  return {
    projects,
    activeProjectPath,
    isLoading,
    loadProjects,
    addProject,
    removeProject,
    switchProject,
  };
};
