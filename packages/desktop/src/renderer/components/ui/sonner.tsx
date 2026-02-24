import { toastManager, type ToastVariant } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { Toast } from '@base-ui/react/toast';
import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon, XIcon } from 'lucide-react';

type ToasterProps = {
  position?: 'top-right' | 'top-left';
  offset?: { top?: number; right?: number; left?: number };
  toastOptions?: {
    duration?: number;
  };
};

const VARIANT_STYLES: Record<ToastVariant, string> = {
  accent: 'border-edge bg-panel text-light',
  success: 'border-green/40 bg-green-bg/50 text-green',
  warning: 'border-amber/40 bg-amber-bg/50 text-amber',
  error: 'border-red/40 bg-red-bg/50 text-red',
};

const VariantIcon = ({ variant }: { variant: ToastVariant }) => {
  if (variant === 'success') {
    return <CircleCheckIcon className="size-4" />;
  }

  if (variant === 'warning') {
    return <TriangleAlertIcon className="size-4" />;
  }

  if (variant === 'error') {
    return <OctagonXIcon className="size-4" />;
  }

  return <InfoIcon className="size-4" />;
};

const ToastList = () => {
  const { toasts } = Toast.useToastManager();

  return toasts.map((item) => {
    const variant = ((item.data as { variant?: ToastVariant } | undefined)?.variant ??
      'accent') as ToastVariant;

    return (
      <Toast.Root
        key={item.id}
        toast={item}
        className={cn(
          'w-full overflow-hidden rounded-md border px-3 py-2 shadow-[0_8px_24px_rgb(0_0_0_/_0.14)] backdrop-blur-sm transition-all data-[ending-style]:translate-y-1 data-[ending-style]:opacity-0 data-[starting-style]:-translate-y-1 data-[starting-style]:opacity-0',
          VARIANT_STYLES[variant],
        )}
      >
        <Toast.Content className="flex items-start gap-2">
          <span className="mt-0.5">
            <VariantIcon variant={variant} />
          </span>
          <div className="min-w-0 flex-1">
            <Toast.Title className="truncate text-sm font-medium" />
            <Toast.Description className="text-mid text-xs" />
          </div>
          <Toast.Close
            aria-label="Close"
            className="text-current/80 transition-opacity hover:opacity-100"
          >
            <XIcon className="size-3.5" />
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>
    );
  });
};

const Toaster = ({ position = 'top-right', offset, toastOptions }: ToasterProps) => {
  const top = offset?.top ?? 56;
  const right = offset?.right ?? 20;
  const left = offset?.left ?? 20;

  return (
    <Toast.Provider toastManager={toastManager} timeout={toastOptions?.duration ?? 2500} limit={4}>
      <Toast.Portal>
        <Toast.Viewport
          className={cn(
            'fixed z-[120] flex w-full max-w-sm flex-col gap-2',
            position === 'top-right' ? 'items-end' : 'items-start',
          )}
          style={{
            top,
            right: position === 'top-right' ? right : 'auto',
            left: position === 'top-left' ? left : 'auto',
          }}
        >
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
};

export { Toaster };
