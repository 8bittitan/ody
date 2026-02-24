import { api } from '@/lib/api';
import type { ArchiveEntry } from '@/types/ipc';
import { Archive } from 'lucide-react';
import { useEffect, useState } from 'react';

import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';

export const ArchiveViewer = () => {
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadArchives = async () => {
    setIsLoading(true);

    try {
      const result = await api.archive.list();
      setArchives(result);
      setLoadError(null);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Unable to load archives');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadArchives();
  }, []);

  return (
    <section className="bg-panel/92 border-edge h-full rounded-lg border p-4 backdrop-blur-sm">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-light text-sm font-medium">Archives</h2>
        <button
          type="button"
          className="text-mid hover:text-light border-edge hover:bg-background rounded-md border px-2 py-1 text-xs"
          onClick={() => {
            void loadArchives();
          }}
        >
          Refresh
        </button>
      </header>

      <div className="space-y-2 overflow-auto">
        {isLoading ? <LoadingSpinner label="Loading archives" /> : null}

        {!isLoading && loadError ? (
          <EmptyState
            icon={<Archive className="size-5" />}
            title="Archive unavailable"
            description={loadError}
            actionLabel="Retry"
            onAction={() => {
              void loadArchives();
            }}
          />
        ) : null}

        {!isLoading && !loadError && archives.length === 0 ? (
          <EmptyState
            icon={<Archive className="size-5" />}
            title="No archives yet"
            description="No archives yet. Archive completed tasks to see them here."
          />
        ) : null}

        {!loadError &&
          archives.map((archive) => {
            const isExpanded = archive.filePath === expandedPath;

            return (
              <article
                key={archive.filePath}
                className="bg-background border-edge rounded border p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-light text-xs">{archive.createdAt}</p>
                    <p className="text-dim text-[11px]">{archive.taskCount} archived tasks</p>
                  </div>
                  <button
                    type="button"
                    className="text-mid hover:text-light text-xs"
                    onClick={() => {
                      setExpandedPath((prev) =>
                        prev === archive.filePath ? null : archive.filePath,
                      );
                    }}
                  >
                    {isExpanded ? 'Hide' : 'View'}
                  </button>
                </div>

                {isExpanded ? (
                  <pre className="border-edge bg-panel mt-2 max-h-64 overflow-auto rounded border p-2 font-mono text-[11px] whitespace-pre-wrap text-zinc-200">
                    {archive.content}
                  </pre>
                ) : null}
              </article>
            );
          })}
      </div>
    </section>
  );
};
