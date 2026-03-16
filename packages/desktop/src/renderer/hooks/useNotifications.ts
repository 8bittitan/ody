import { toast } from '@/lib/toast';
import { useCallback } from 'react';

type ToastPayload = {
  title: string;
  description?: string;
};

export const useNotifications = () => {
  const accent = useCallback(({ title, description }: ToastPayload) => {
    toast.accent(title, { description });
  }, []);

  const success = useCallback(({ title, description }: ToastPayload) => {
    toast.success(title, { description });
  }, []);

  const error = useCallback(({ title, description }: ToastPayload) => {
    toast.error(title, { description });
  }, []);

  const warning = useCallback(({ title, description }: ToastPayload) => {
    toast.warning(title, { description });
  }, []);

  return {
    accent,
    success,
    error,
    warning,
    info: accent,
  };
};
