import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export const useTaskEventsBootstrap = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    return api.tasks.onChanged(({ projectPath }) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(projectPath) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.states(projectPath) }),
      ]);
    });
  }, [queryClient]);
};
