import type { ReactNode } from 'react';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const EmptyState = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) => {
  return (
    <section className="border-edge bg-background/30 rounded-lg border border-dashed px-4 py-10 text-center">
      {icon ? (
        <div className="text-dim mx-auto mb-3 flex w-fit items-center justify-center">{icon}</div>
      ) : null}
      <h3 className="text-light text-sm font-semibold tracking-[0.08em] uppercase">{title}</h3>
      <p className="text-mid mx-auto mt-2 max-w-md text-sm">{description}</p>
      {onAction && actionLabel ? (
        <button
          type="button"
          className="bg-primary text-primary-foreground hover:bg-accent-hover mt-4 rounded-md px-3 py-1.5 text-xs font-medium"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
};
