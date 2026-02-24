import { useNotifications } from '@/hooks/useNotifications';
import { api } from '@/lib/api';
import { NotebookText } from 'lucide-react';
import { useEffect, useState } from 'react';

import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';

type ProgressViewerProps = {
  iteration: number;
  isRunning: boolean;
};

export const ProgressViewer = ({ iteration, isRunning }: ProgressViewerProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { error } = useNotifications();

  const loadProgress = async () => {
    setIsLoading(true);

    try {
      const result = await api.progress.read();
      setContent(result.content);
      setLoadError(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to load progress';
      setLoadError(message);
      error({ title: 'Failed to load progress', description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const clearProgress = async () => {
    try {
      await api.progress.clear();
      await loadProgress();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to clear progress';
      error({ title: 'Failed to clear progress', description: message });
    }
  };

  useEffect(() => {
    void loadProgress();
  }, []);

  useEffect(() => {
    if (iteration === 0 && !isRunning) {
      return;
    }

    void loadProgress();
  }, [iteration, isRunning]);

  return (
    <section className="bg-panel/90 border-edge rounded-lg border">
      <header className="border-edge flex items-center justify-between border-b px-3 py-2">
        <button
          type="button"
          className="text-light text-xs tracking-[0.12em] uppercase"
          onClick={() => {
            setIsOpen((prev) => !prev);
          }}
        >
          Progress Notes {isOpen ? '▲' : '▼'}
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-mid border-edge hover:text-light rounded border px-2 py-1 text-xs"
            onClick={() => {
              void loadProgress();
            }}
          >
            Refresh
          </button>
          <button
            type="button"
            className="text-red border-red/35 hover:bg-red-bg rounded border px-2 py-1 text-xs"
            onClick={() => {
              void clearProgress();
            }}
          >
            Clear Progress
          </button>
        </div>
      </header>

      {isOpen ? (
        <div className="max-h-44 overflow-auto p-3">
          {isLoading ? (
            <LoadingSpinner size="sm" label="Loading progress" />
          ) : loadError ? (
            <EmptyState
              icon={<NotebookText className="size-4" />}
              title="Progress unavailable"
              description={loadError}
              actionLabel="Retry"
              onAction={() => {
                void loadProgress();
              }}
            />
          ) : content.trim().length === 0 ? (
            <EmptyState
              icon={<NotebookText className="size-4" />}
              title="No progress notes"
              description="No progress notes recorded yet."
            />
          ) : (
            <pre className="text-light font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {content}
            </pre>
          )}
        </div>
      ) : null}
    </section>
  );
};
