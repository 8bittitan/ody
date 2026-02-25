import { useStore } from '@/store';
import { useEffect } from 'react';

export const useApp = () => {
  const isFullscreen = useStore((state) => state.isFullscreen);
  const setFullscreen = useStore((state) => state.setIsFullscreen);

  useEffect(() => {
    return window.ody.app.onFullscreen((enabled) => {
      setFullscreen(enabled);
    });
  }, [setFullscreen]);

  return {
    isFullscreen,
  };
};
