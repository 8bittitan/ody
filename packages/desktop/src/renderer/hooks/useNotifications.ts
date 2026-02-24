import { toast } from '@/lib/toast';

type ToastPayload = {
  title: string;
  description?: string;
};

export const useNotifications = () => {
  const accent = ({ title, description }: ToastPayload) => {
    toast.accent(title, { description });
  };

  const success = ({ title, description }: ToastPayload) => {
    toast.success(title, { description });
  };

  const error = ({ title, description }: ToastPayload) => {
    toast.error(title, { description });
  };

  const warning = ({ title, description }: ToastPayload) => {
    toast.warning(title, { description });
  };

  return {
    accent,
    success,
    error,
    warning,
    info: accent,
  };
};
