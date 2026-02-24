import { Toast } from '@base-ui/react/toast';

export type ToastVariant = 'accent' | 'success' | 'warning' | 'error';

export const toastManager = Toast.createToastManager();

type ToastPayload = {
  title: string;
  description?: string;
};

const push = (variant: ToastVariant, payload: ToastPayload) => {
  return toastManager.add({
    title: payload.title,
    description: payload.description,
    data: { variant },
  });
};

export const toast = {
  accent: (title: string, options?: { description?: string }) =>
    push('accent', { title, description: options?.description }),
  success: (title: string, options?: { description?: string }) =>
    push('success', { title, description: options?.description }),
  warning: (title: string, options?: { description?: string }) =>
    push('warning', { title, description: options?.description }),
  error: (title: string, options?: { description?: string }) =>
    push('error', { title, description: options?.description }),
};
