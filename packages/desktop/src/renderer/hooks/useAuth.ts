import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useStore } from '@/store';
import { useCallback } from 'react';

export const useAuth = () => {
  const authStore = useStore((state) => state.authStore);
  const isLoading = useStore((state) => state.isLoadingAuth);
  const setAuthStore = useStore((state) => state.setAuthStore);
  const setAuthLoading = useStore((state) => state.setAuthLoading);

  const loadAuth = useCallback(async () => {
    setAuthLoading(true);

    try {
      const result = await api.auth.list();
      setAuthStore(result);
      return result;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to load credentials';
      toast.error('Failed to load credentials', { description: message });
      throw cause;
    } finally {
      setAuthLoading(false);
    }
  }, [setAuthLoading, setAuthStore]);

  const saveJira = useCallback(
    async (profile: string, credentials: Record<string, unknown>) => {
      try {
        const result = await api.auth.setJira(profile, credentials);
        await loadAuth();
        return result;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Unable to save Jira profile';
        toast.error('Failed to save Jira credentials', { description: message });
        throw cause;
      }
    },
    [loadAuth],
  );

  const saveGitHub = useCallback(
    async (profile: string, credentials: Record<string, unknown>) => {
      try {
        const result = await api.auth.setGitHub(profile, credentials);
        await loadAuth();
        return result;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Unable to save GitHub profile';
        toast.error('Failed to save GitHub credentials', { description: message });
        throw cause;
      }
    },
    [loadAuth],
  );

  const removeJira = useCallback(
    async (profile: string) => {
      try {
        const result = await api.auth.removeJira(profile);
        await loadAuth();
        return result;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Unable to remove Jira profile';
        toast.error('Failed to remove Jira credentials', { description: message });
        throw cause;
      }
    },
    [loadAuth],
  );

  const removeGitHub = useCallback(
    async (profile: string) => {
      try {
        const result = await api.auth.removeGitHub(profile);
        await loadAuth();
        return result;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Unable to remove GitHub profile';
        toast.error('Failed to remove GitHub credentials', { description: message });
        throw cause;
      }
    },
    [loadAuth],
  );

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
