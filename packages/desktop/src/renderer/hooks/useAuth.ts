import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from '@/lib/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useAuth = () => {
  const queryClient = useQueryClient();

  const authQuery = useQuery({
    queryKey: queryKeys.auth.list,
    queryFn: () => api.auth.list(),
  });

  const saveJiraMutation = useMutation({
    mutationFn: async ({
      profile,
      credentials,
    }: {
      profile: string;
      credentials: Record<string, unknown>;
    }) => {
      return api.auth.setJira(profile, credentials);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
    onError: (cause) => {
      const message = cause instanceof Error ? cause.message : 'Unable to save Jira profile';
      toast.error('Failed to save Jira credentials', { description: message });
    },
  });

  const saveGitHubMutation = useMutation({
    mutationFn: async ({
      profile,
      credentials,
    }: {
      profile: string;
      credentials: Record<string, unknown>;
    }) => {
      return api.auth.setGitHub(profile, credentials);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
    onError: (cause) => {
      const message = cause instanceof Error ? cause.message : 'Unable to save GitHub profile';
      toast.error('Failed to save GitHub credentials', { description: message });
    },
  });

  const removeJiraMutation = useMutation({
    mutationFn: async (profile: string) => {
      return api.auth.removeJira(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
    onError: (cause) => {
      const message = cause instanceof Error ? cause.message : 'Unable to remove Jira profile';
      toast.error('Failed to remove Jira credentials', { description: message });
    },
  });

  const removeGitHubMutation = useMutation({
    mutationFn: async (profile: string) => {
      return api.auth.removeGitHub(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
    onError: (cause) => {
      const message = cause instanceof Error ? cause.message : 'Unable to remove GitHub profile';
      toast.error('Failed to remove GitHub credentials', { description: message });
    },
  });

  const authStore = authQuery.data ?? null;
  const isLoading = authQuery.isLoading;

  const loadAuth = async () => {
    const result = await queryClient.fetchQuery({
      queryKey: queryKeys.auth.list,
      queryFn: () => api.auth.list(),
      staleTime: 0,
    });

    return result;
  };

  const saveJira = async (profile: string, credentials: Record<string, unknown>) => {
    return saveJiraMutation.mutateAsync({ profile, credentials });
  };

  const saveGitHub = async (profile: string, credentials: Record<string, unknown>) => {
    return saveGitHubMutation.mutateAsync({ profile, credentials });
  };

  const removeJira = async (profile: string) => {
    return removeJiraMutation.mutateAsync(profile);
  };

  const removeGitHub = async (profile: string) => {
    return removeGitHubMutation.mutateAsync(profile);
  };

  return {
    authStore,
    isLoading,
    loadAuth,
    saveJira,
    saveGitHub,
    removeJira,
    removeGitHub,
  };
};
