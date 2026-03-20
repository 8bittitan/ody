import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';
import { Button } from './ui/button';

type AnsiLogViewerProps = {
  title: string;
  htmlChunks: string[];
  error: string | null;
  isRunning?: boolean;
  onClear?: () => void;
  emptyIcon?: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  loadingLabel?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  bodyClassName?: string;
  preClassName?: string;
};

export const AnsiLogViewer = ({
  title,
  htmlChunks,
  error,
  isRunning = false,
  onClear,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  loadingLabel = 'Waiting for first output',
  actionLabel,
  onAction,
  className,
  bodyClassName,
  preClassName,
}: AnsiLogViewerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLPreElement | null>(null);
  const renderedChunkCountRef = useRef(0);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }

    if (htmlChunks.length === 0) {
      content.innerHTML = '';
      renderedChunkCountRef.current = 0;
      return;
    }

    if (htmlChunks.length < renderedChunkCountRef.current) {
      content.innerHTML = htmlChunks.join('');
      renderedChunkCountRef.current = htmlChunks.length;
      return;
    }

    for (const chunk of htmlChunks.slice(renderedChunkCountRef.current)) {
      content.insertAdjacentHTML('beforeend', chunk);
    }

    renderedChunkCountRef.current = htmlChunks.length;
  }, [htmlChunks]);

  useEffect(() => {
    if (!autoScroll || !containerRef.current) {
      return;
    }

    const target = containerRef.current;
    target.scrollTop = target.scrollHeight;
  }, [autoScroll, htmlChunks.length]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    setAutoScroll(distance <= 24);
  };

  return (
    <section className={className}>
      <header className="border-edge flex items-center justify-between border-b px-3 py-2">
        <span className="text-mid text-xs font-medium">{title}</span>

        <div className="flex items-center gap-2">
          {actionLabel && onAction ? (
            <Button size="xs" variant="link" className="h-auto p-0" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
          {onClear ? (
            <Button size="xs" variant="outline" onClick={onClear}>
              Clear
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="text-red bg-red-bg border-red/35 border-b px-3 py-2 text-xs" role="alert">
          {error}
        </div>
      ) : null}

      <div ref={containerRef} className={bodyClassName} onScroll={handleScroll}>
        {htmlChunks.length > 0 ? (
          <pre
            ref={contentRef}
            className={preClassName}
            aria-live="polite"
            aria-busy={isRunning}
          />
        ) : isRunning ? (
          <LoadingSpinner size="md" label={loadingLabel} />
        ) : (
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
        )}
      </div>
    </section>
  );
};
