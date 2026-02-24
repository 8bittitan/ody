import { api } from '@/lib/api';
import type { ThemeResolved, ThemeSource } from '@/types/ipc';
import { useCallback, useEffect, useState } from 'react';

const applyThemeClass = (resolvedTheme: ThemeResolved) => {
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
};

export const useTheme = () => {
  const [theme, setThemeState] = useState<ThemeSource>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ThemeResolved>('light');

  const loadTheme = useCallback(async () => {
    const current = await api.theme.get();
    setThemeState(current.source);
    setResolvedTheme(current.resolved);
    applyThemeClass(current.resolved);
    return current;
  }, []);

  const setTheme = useCallback(async (source: ThemeSource) => {
    const nextTheme = await api.theme.set(source);
    setThemeState(nextTheme.source);
    setResolvedTheme(nextTheme.resolved);
    applyThemeClass(nextTheme.resolved);
    return nextTheme;
  }, []);

  useEffect(() => {
    void loadTheme();

    return api.theme.onChanged(({ source, resolved }) => {
      setThemeState(source);
      setResolvedTheme(resolved);
      applyThemeClass(resolved);
    });
  }, [loadTheme]);

  return {
    theme,
    resolvedTheme,
    setTheme,
  };
};
