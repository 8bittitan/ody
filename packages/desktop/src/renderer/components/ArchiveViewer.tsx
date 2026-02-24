import { api } from '@/lib/api';
import type { ArchiveEntry } from '@/types/ipc';
import { Archive } from 'lucide-react';
import { useEffect, useState } from 'react';

import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';

type ExpandedSection = {
  date: string;
  section: 'tasks' | 'progress' | 'legacy';
};

export const ArchiveViewer = () => {
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);
  const [expandedSection, setExpandedSection] = useState<ExpandedSection | null>(null);
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

  const toggleSection = (date: string, section: ExpandedSection['section']) => {
    setExpandedSection((prev) =>
      prev?.date === date && prev.section === section ? null : { date, section },
    );
  };

  const isExpanded = (date: string, section: ExpandedSection['section']) =>
    expandedSection?.date === date && expandedSection.section === section;

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
            const taskCount = archive.tasks?.taskCount ?? archive.legacy?.taskCount ?? 0;

            return (
              <article key={archive.date} className="bg-background border-edge rounded border p-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-light text-xs font-medium">{archive.date}</p>
                    {taskCount > 0 ? (
                      <p className="text-dim text-[11px]">
                        {taskCount} archived task{taskCount !== 1 ? 's' : ''}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-1.5 flex gap-1.5">
                  {archive.tasks ? (
                    <button
                      type="button"
                      className={`rounded px-1.5 py-0.5 text-[11px] ${
                        isExpanded(archive.date, 'tasks')
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'text-mid hover:text-light bg-panel hover:bg-panel/80'
                      }`}
                      onClick={() => {
                        toggleSection(archive.date, 'tasks');
                      }}
                    >
                      Tasks
                    </button>
                  ) : null}

                  {archive.progress ? (
                    <button
                      type="button"
                      className={`rounded px-1.5 py-0.5 text-[11px] ${
                        isExpanded(archive.date, 'progress')
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'text-mid hover:text-light bg-panel hover:bg-panel/80'
                      }`}
                      onClick={() => {
                        toggleSection(archive.date, 'progress');
                      }}
                    >
                      Progress
                    </button>
                  ) : null}

                  {archive.legacy ? (
                    <button
                      type="button"
                      className={`rounded px-1.5 py-0.5 text-[11px] ${
                        isExpanded(archive.date, 'legacy')
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'text-mid hover:text-light bg-panel hover:bg-panel/80'
                      }`}
                      onClick={() => {
                        toggleSection(archive.date, 'legacy');
                      }}
                    >
                      View
                    </button>
                  ) : null}
                </div>

                {isExpanded(archive.date, 'tasks') && archive.tasks ? (
                  <pre className="border-edge bg-panel mt-2 max-h-64 overflow-auto rounded border p-2 font-mono text-[11px] whitespace-pre-wrap text-zinc-200">
                    {archive.tasks.content}
                  </pre>
                ) : null}

                {isExpanded(archive.date, 'progress') && archive.progress ? (
                  <pre className="border-edge bg-panel mt-2 max-h-64 overflow-auto rounded border p-2 font-mono text-[11px] whitespace-pre-wrap text-zinc-200">
                    {archive.progress.content}
                  </pre>
                ) : null}

                {isExpanded(archive.date, 'legacy') && archive.legacy ? (
                  <pre className="border-edge bg-panel mt-2 max-h-64 overflow-auto rounded border p-2 font-mono text-[11px] whitespace-pre-wrap text-zinc-200">
                    {archive.legacy.content}
                  </pre>
                ) : null}
              </article>
            );
          })}
      </div>
    </section>
  );
};
