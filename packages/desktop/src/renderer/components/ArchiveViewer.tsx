import { api } from '@/lib/api';
import type { ArchiveEntry } from '@/types/ipc';
import { Archive } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';
import { Button } from './ui/button';

type ExpandedSection = {
  date: string;
  section: 'tasks' | 'progress' | 'legacy';
};

type ArchiveSectionState = {
  content: string;
  error: string | null;
  isLoading: boolean;
  loaded: boolean;
  missing: boolean;
};

const getSectionKey = (date: string, section: ExpandedSection['section']) => `${date}:${section}`;

export const ArchiveViewer = () => {
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);
  const [expandedSection, setExpandedSection] = useState<ExpandedSection | null>(null);
  const [sectionState, setSectionState] = useState<Record<string, ArchiveSectionState>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadArchives = useCallback(async () => {
    setIsLoading(true);

    try {
      const result = await api.archive.list();
      setArchives(result);
      setSectionState({});
      setExpandedSection(null);
      setLoadError(null);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Unable to load archives');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArchives();
  }, [loadArchives]);

  const loadSection = useCallback(
    async (archive: ArchiveEntry, section: ExpandedSection['section']) => {
      const target = archive[section];

      if (!target) {
        return;
      }

      const key = getSectionKey(archive.date, section);
      let shouldLoad = false;

      setSectionState((prev) => {
        const current = prev[key];

        if (current?.isLoading || current?.loaded) {
          return prev;
        }

        shouldLoad = true;

        return {
          ...prev,
          [key]: {
            content: '',
            error: null,
            isLoading: true,
            loaded: false,
            missing: false,
          },
        };
      });

      if (!shouldLoad) {
        return;
      }

      try {
        const result = await api.archive.read(target.filePath);
        setSectionState((prev) => ({
          ...prev,
          [key]: {
            content: result.content,
            error: null,
            isLoading: false,
            loaded: true,
            missing: result.missing,
          },
        }));
      } catch (cause) {
        setSectionState((prev) => ({
          ...prev,
          [key]: {
            content: '',
            error: cause instanceof Error ? cause.message : 'Unable to load archive content',
            isLoading: false,
            loaded: true,
            missing: false,
          },
        }));
      }
    },
    [],
  );

  const toggleSection = (archive: ArchiveEntry, section: ExpandedSection['section']) => {
    const isOpen = expandedSection?.date === archive.date && expandedSection.section === section;

    if (isOpen) {
      setExpandedSection(null);
      return;
    }

    setExpandedSection({ date: archive.date, section });
    void loadSection(archive, section);
  };

  const isExpanded = (date: string, section: ExpandedSection['section']) =>
    expandedSection?.date === date && expandedSection.section === section;

  const renderSectionContent = (archive: ArchiveEntry, section: ExpandedSection['section']) => {
    const key = getSectionKey(archive.date, section);
    const state = sectionState[key];

    if (state?.isLoading) {
      return <LoadingSpinner size="sm" label={`Loading ${section}`} />;
    }

    if (state?.error) {
      return (
        <div className="border-red/30 bg-red-bg mt-2 rounded border px-3 py-2">
          <p className="text-red text-xs">{state.error}</p>
        </div>
      );
    }

    if (state?.missing) {
      return (
        <div className="border-edge bg-panel mt-2 rounded border px-3 py-2">
          <p className="text-dim text-xs">This archive file is no longer available.</p>
        </div>
      );
    }

    if (!state?.loaded) {
      return null;
    }

    return (
      <pre className="border-edge bg-panel mt-2 max-h-64 overflow-auto rounded border p-2 font-mono text-[11px] whitespace-pre-wrap text-zinc-200">
        {state.content}
      </pre>
    );
  };

  return (
    <section className="bg-panel/92 border-edge h-full rounded-lg border p-4 backdrop-blur-sm">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-light text-sm font-medium">Archives</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void loadArchives();
          }}
        >
          Refresh
        </Button>
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
                    <Button
                      variant={isExpanded(archive.date, 'tasks') ? 'default' : 'secondary'}
                      size="xs"
                      onClick={() => {
                        toggleSection(archive, 'tasks');
                      }}
                    >
                      Tasks
                    </Button>
                  ) : null}

                  {archive.progress ? (
                    <Button
                      variant={isExpanded(archive.date, 'progress') ? 'default' : 'secondary'}
                      size="xs"
                      onClick={() => {
                        toggleSection(archive, 'progress');
                      }}
                    >
                      Progress
                    </Button>
                  ) : null}

                  {archive.legacy ? (
                    <Button
                      variant={isExpanded(archive.date, 'legacy') ? 'default' : 'secondary'}
                      size="xs"
                      onClick={() => {
                        toggleSection(archive, 'legacy');
                      }}
                    >
                      View
                    </Button>
                  ) : null}
                </div>

                {isExpanded(archive.date, 'tasks') && archive.tasks
                  ? renderSectionContent(archive, 'tasks')
                  : null}

                {isExpanded(archive.date, 'progress') && archive.progress
                  ? renderSectionContent(archive, 'progress')
                  : null}

                {isExpanded(archive.date, 'legacy') && archive.legacy
                  ? renderSectionContent(archive, 'legacy')
                  : null}
              </article>
            );
          })}
      </div>
    </section>
  );
};
