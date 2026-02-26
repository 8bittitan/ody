import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from '@/lib/toast';
import type { ConfigLoadResult } from '@/types/ipc';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useProjects } from './useProjects';

export const useConfig = () => {
  const queryClient = useQueryClient();
  const { activeProjectPath } = useProjects();

  const configQuery = useQuery({
    queryKey: queryKeys.config.data(activeProjectPath),
    queryFn: () => api.config.load(),
    enabled: !!activeProjectPath,
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      scope,
      nextConfig,
    }: {
      scope: 'gui' | 'local';
      nextConfig: Record<string, unknown>;
    }) => {
      return api.config.save(scope, nextConfig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.config.all });
    },
    onError: (cause) => {
      const message = cause instanceof Error ? cause.message : 'Unable to save configuration';
      toast.error('Failed to save configuration', { description: message });
    },
  });

  const saveGlobalMutation = useMutation({
    mutationFn: async (nextConfig: Record<string, unknown>) => {
      return api.config.saveGlobal(nextConfig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.config.all });
    },
    onError: (cause) => {
      const message = cause instanceof Error ? cause.message : 'Unable to save global config';
      toast.error('Failed to save global configuration', { description: message });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async (nextConfig: Record<string, unknown>) => {
      return api.config.validate(nextConfig);
    },
    onError: (cause) => {
      const message = cause instanceof Error ? cause.message : 'Unable to validate config';
      toast.error('Failed to validate configuration', { description: message });
    },
  });

  const resetGuiMutation = useMutation({
    mutationFn: async () => {
      return api.config.resetGuiOverrides();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.config.all });
    },
    onError: (cause) => {
      const message = cause instanceof Error ? cause.message : 'Unable to reset GUI overrides';
      toast.error('Failed to reset GUI overrides', { description: message });
    },
  });

  const data: ConfigLoadResult | undefined = configQuery.data;
  const config = data?.merged ?? null;
  const localConfigPath = data?.localConfigPath ?? null;
  const layers = data?.layers ?? { gui: null, local: null, global: null };
  const validation = validateMutation.data ?? null;
  const isLoading = configQuery.isLoading;

  const loadConfig = useCallback(async () => {
    const result = await queryClient.fetchQuery({
      queryKey: queryKeys.config.data(activeProjectPath),
      queryFn: () => api.config.load(),
      staleTime: 0,
    });

    return result;
  }, [queryClient, activeProjectPath]);

  const saveConfig = async (scope: 'gui' | 'local', nextConfig: Record<string, unknown>) => {
    return saveMutation.mutateAsync({ scope, nextConfig });
  };

  const saveGlobal = async (nextConfig: Record<string, unknown>) => {
    return saveGlobalMutation.mutateAsync(nextConfig);
  };

  const validateConfig = async (nextConfig: Record<string, unknown>) => {
    return validateMutation.mutateAsync(nextConfig);
  };

  const resetGuiOverrides = async () => {
    return resetGuiMutation.mutateAsync();
  };

  return {
    config,
    localConfigPath,
    layers,
    validation,
    isLoading,
    loadConfig,
    saveConfig,
    saveGlobal,
    validateConfig,
    resetGuiOverrides,
  };
};
