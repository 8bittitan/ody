import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useStore } from '@/store';
import { useCallback } from 'react';

export const useConfig = () => {
  const config = useStore((state) => state.config);
  const layers = useStore((state) => state.layers);
  const validation = useStore((state) => state.validation);
  const isLoading = useStore((state) => state.isLoadingConfig);
  const setConfigData = useStore((state) => state.setConfigData);
  const setConfigLoading = useStore((state) => state.setConfigLoading);
  const setValidation = useStore((state) => state.setValidation);
  const resetGuiOverridesState = useStore((state) => state.resetGuiOverridesState);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);

    try {
      const result = await api.config.load();
      setConfigData({ config: result.merged, layers: result.layers });
      return result;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to load configuration';
      toast.error('Failed to load configuration', { description: message });
      throw cause;
    } finally {
      setConfigLoading(false);
    }
  }, [setConfigData, setConfigLoading]);

  const saveConfig = useCallback(
    async (scope: 'gui' | 'local', nextConfig: Record<string, unknown>) => {
      try {
        const result = await api.config.save(scope, nextConfig);
        await loadConfig();
        return result;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Unable to save configuration';
        toast.error('Failed to save configuration', { description: message });
        throw cause;
      }
    },
    [loadConfig],
  );

  const saveGlobal = useCallback(
    async (nextConfig: Record<string, unknown>) => {
      try {
        const result = await api.config.saveGlobal(nextConfig);
        await loadConfig();
        return result;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Unable to save global config';
        toast.error('Failed to save global configuration', { description: message });
        throw cause;
      }
    },
    [loadConfig],
  );

  const validateConfig = useCallback(
    async (nextConfig: Record<string, unknown>) => {
      try {
        const result = await api.config.validate(nextConfig);
        setValidation(result);
        return result;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Unable to validate config';
        toast.error('Failed to validate configuration', { description: message });
        throw cause;
      }
    },
    [setValidation],
  );

  const resetGuiOverrides = useCallback(async () => {
    try {
      const result = await api.config.resetGuiOverrides();
      resetGuiOverridesState();
      await loadConfig();
      return result;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to reset GUI overrides';
      toast.error('Failed to reset GUI overrides', { description: message });
      throw cause;
    }
  }, [loadConfig, resetGuiOverridesState]);

  return {
    config,
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
