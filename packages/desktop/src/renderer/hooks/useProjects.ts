import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export type ProjectItem = {
  name: string;
  path: string;
};

export const useProjects = () => {
  const queryClient = useQueryClient();

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.list,
    queryFn: () => api.projects.list(),
  });

  const activeQuery = useQuery({
    queryKey: queryKeys.projects.active,
    queryFn: () => api.projects.active(),
  });

  const addMutation = useMutation({
    mutationFn: () => api.projects.add(),
    onSuccess: (result) => {
      if (result.added) {
        queryClient.setQueryData<ProjectItem[]>(queryKeys.projects.list, (prev) => {
          if (!prev) {
            return [result.added!];
          }

          if (prev.some((p) => p.path === result.added!.path)) {
            return prev;
          }

          return [...prev, result.added!];
        });
        queryClient.setQueryData(queryKeys.projects.active, { path: result.added.path });
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (path: string) => {
      await api.projects.remove(path);
      return path;
    },
    onSuccess: (removedPath) => {
      queryClient.setQueryData<ProjectItem[]>(queryKeys.projects.list, (prev) =>
        prev ? prev.filter((p) => p.path !== removedPath) : [],
      );

      const currentActive = queryClient.getQueryData<{ path: string | null }>(
        queryKeys.projects.active,
      );

      if (currentActive?.path === removedPath) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.active });
      }
    },
  });

  const switchMutation = useMutation({
    mutationFn: async (path: string) => {
      const result = await api.projects.switch(path);
      return { path, ok: result.ok };
    },
    onSuccess: ({ path, ok }) => {
      if (ok) {
        queryClient.setQueryData(queryKeys.projects.active, { path });
      }
    },
  });

  useEffect(() => {
    return api.projects.onSwitched((path) => {
      queryClient.setQueryData(queryKeys.projects.active, { path });
    });
  }, [queryClient]);

  const projects: ProjectItem[] = projectsQuery.data ?? [];
  const activeProjectPath = activeQuery.data?.path ?? null;
  const isLoading = projectsQuery.isLoading || activeQuery.isLoading;

  const addProject = async () => {
    const result = await addMutation.mutateAsync();
    return result.added;
  };

  const removeProject = async (path: string) => {
    await removeMutation.mutateAsync(path);
  };

  const switchProject = async (path: string) => {
    const result = await switchMutation.mutateAsync(path);
    return result.ok;
  };

  const loadProjects = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.active }),
    ]);
  };

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
