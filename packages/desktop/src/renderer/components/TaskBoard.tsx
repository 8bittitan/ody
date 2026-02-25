import { Collapsible } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@/components/ui/scroll-area';
import { stripAnsi } from '@/lib/ansi';
import { api } from '@/lib/api';
import type { TaskSummary } from '@/types/ipc';
import { ClipboardList, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useAgent } from '../hooks/useAgent';
import { useConfig } from '../hooks/useConfig';
import { useNotifications } from '../hooks/useNotifications';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';
import { TaskCard } from './TaskCard';
import { TaskDetailDialog } from './TaskDetailDialog';
import { Button } from './ui/button';

type TaskBoardProps = {
  onOpenPlan: () => void;
  onOpenArchive: () => void;
  onOpenEditor: (taskPath: string) => void;
};

const COLUMN_META = {
  pending: {
    label: 'Pending',
    dotClassName: 'bg-amber',
  },
  in_progress: {
    label: 'In Progress',
    dotClassName: 'bg-primary',
  },
  completed: {
    label: 'Completed',
    dotClassName: 'bg-green',
  },
} as const;

export const TaskBoard = ({ onOpenPlan, onOpenArchive, onOpenEditor }: TaskBoardProps) => {
  const { activeProjectPath } = useProjects();
  const { tasks, filteredTasks, loadTasks, setFilters, labelFilter, isLoading } = useTasks();
  const { config } = useConfig();
  const { start, stop, isRunning, output, iteration, maxIterations } = useAgent();
  const { accent, warning, error } = useNotifications();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TaskSummary | null>(null);
  const [detailTarget, setDetailTarget] = useState<TaskSummary | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading) {
      setViewError(null);
    }
  }, [isLoading, tasks.length]);

  const filteredBySearch = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (query.length === 0) {
      return filteredTasks;
    }

    return filteredTasks.filter((task) => task.title.toLowerCase().includes(query));
  }, [search, filteredTasks]);

  const uniqueLabels = useMemo(() => {
    const labels = new Set<string>();

    for (const task of tasks) {
      for (const label of task.labels) {
        labels.add(label);
      }
    }

    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const groupedTasks = useMemo(
    () => ({
      pending: filteredBySearch.filter((task) => task.status === 'pending'),
      in_progress: filteredBySearch.filter((task) => task.status === 'in_progress'),
      completed: filteredBySearch.filter((task) => task.status === 'completed'),
    }),
    [filteredBySearch],
  );
  const completedTasks = useMemo(
    () => tasks.filter((task) => task.status === 'completed'),
    [tasks],
  );

  const outputPreview = useMemo(() => {
    const content = stripAnsi(output.join(''));
    const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
    return lines.slice(-6).join('\n');
  }, [output]);

  const startTaskRun = async (task: TaskSummary) => {
    if (!activeProjectPath) {
      return;
    }

    if (isRunning) {
      warning({ title: 'Agent is already running' });
      return;
    }

    const iterations = typeof config?.maxIterations === 'number' ? config.maxIterations : 1;
    const shouldCommit = typeof config?.shouldCommit === 'boolean' ? config.shouldCommit : false;

    try {
      const result = await start({
        projectDir: activeProjectPath,
        taskFiles: [task.filePath],
        iterations: Math.max(1, iterations),
      });

      if (!result.started) {
        warning({ title: 'Agent is already running' });
        return;
      }

      accent({
        title: 'Task run started',
        description: shouldCommit ? 'Auto-commit enabled.' : undefined,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to start task run';
      error({ title: 'Failed to start run', description: message });
    }
  };

  const deleteTask = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      const result = await api.tasks.delete([deleteTarget.filePath]);
      if (result.deleted.length > 0) {
        error({ title: 'Task deleted', description: deleteTarget.title });
        await loadTasks();
      } else {
        error({ title: 'Task deletion failed' });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to delete task';
      error({ title: 'Task deletion failed', description: message });
    }

    setDeleteTarget(null);
  };

  const archiveCompleted = async () => {
    if (completedTasks.length === 0) {
      warning({ title: 'No completed tasks to archive' });
      setShowArchiveConfirm(false);
      return;
    }

    try {
      const result = await api.archive.compact();

      if (result.archived.length === 0 || result.archiveFilePath === null) {
        warning({ title: 'No tasks were archived' });
        setShowArchiveConfirm(false);
        return;
      }

      accent({
        title: 'Completed tasks archived',
        description: `${result.archived.length} task${result.archived.length === 1 ? '' : 's'} archived.`,
      });
      setShowArchiveConfirm(false);
      await loadTasks();
      onOpenArchive();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to archive tasks';
      error({ title: 'Archive failed', description: message });
      return;
    }
  };

  if (isLoading) {
    return (
      <section className="border-edge bg-background/30 rounded-lg border">
        <LoadingSpinner size="lg" label="Loading task board" />
      </section>
    );
  }

  if (viewError) {
    return (
      <EmptyState
        icon={<ClipboardList className="size-5" />}
        title="Task board unavailable"
        description={viewError}
        actionLabel="Retry"
        onAction={() => {
          setViewError(null);
          void loadTasks().catch((cause) => {
            setViewError(cause instanceof Error ? cause.message : 'Unable to load tasks');
          });
        }}
      />
    );
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="size-5" />}
        title="No tasks yet"
        description="No tasks yet. Create your first plan to get started."
        actionLabel="New Plan"
        onAction={onOpenPlan}
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <section className="border-edge bg-background/40 flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
        <div className="relative max-w-sm flex-1">
          <Search className="text-dim absolute top-2 left-2.5 size-3.5" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search tasks"
            className="bg-panel border-edge text-light placeholder:text-dim h-8 w-full rounded border pr-2 pl-8 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="dark:text-amber dark:hover:bg-amber-bg dark:border-amber/30 dark:bg-background"
            onClick={() => {
              if (completedTasks.length === 0) {
                warning({ title: 'No completed tasks to archive' });
                return;
              }

              setShowArchiveConfirm(true);
            }}
          >
            Archive Completed
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenArchive}>
            View Archive
          </Button>
        </div>
      </section>

      <Collapsible
        defaultOpen={false}
        label="Filter by label"
        badge={labelFilter}
        className="min-w-0"
      >
        <section className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setFilters({ label: null });
            }}
            className={[
              'rounded-md border px-2 py-1 text-xs',
              labelFilter === null
                ? 'border-primary/35 bg-accent-bg text-primary'
                : 'border-edge text-mid hover:text-light',
            ].join(' ')}
          >
            All labels
          </button>
          {uniqueLabels.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setFilters({ label: labelFilter === label ? null : label });
              }}
              className={[
                'rounded-md border px-2 py-1 text-xs',
                labelFilter === label
                  ? 'border-primary/35 bg-accent-bg text-primary'
                  : 'border-edge text-mid hover:text-light',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </section>
      </Collapsible>

      <section className="grid min-h-0 flex-1 gap-3 md:grid-cols-3">
        {(['pending', 'in_progress', 'completed'] as const).map((status) => {
          const tasksForStatus = groupedTasks[status];

          return (
            <div
              key={status}
              className="bg-background/35 border-edge flex min-h-0 flex-col rounded-lg border p-2"
            >
              <header className="border-edge mb-2 flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      COLUMN_META[status].dotClassName,
                      'inline-block size-2 rounded-full',
                    ].join(' ')}
                  />
                  <h3 className="text-light text-xs font-semibold tracking-[0.12em] uppercase">
                    {COLUMN_META[status].label}
                  </h3>
                </div>
                <span className="text-dim border-edge rounded border px-1.5 py-0.5 text-[10px]">
                  {tasksForStatus.length}
                </span>
              </header>

              <ScrollArea className="min-h-0 flex-1">
                <ScrollAreaViewport>
                  <ScrollAreaContent className="space-y-2 pb-1">
                    {tasksForStatus.map((task, index) => (
                      <div
                        key={task.filePath}
                        className={index % 3 === 0 ? 'd1' : index % 3 === 1 ? 'd2' : 'd3'}
                      >
                        <TaskCard
                          task={task}
                          outputPreview={status === 'in_progress' ? outputPreview : undefined}
                          isRunning={isRunning}
                          onClick={setDetailTarget}
                          onRun={(target) => {
                            void startTaskRun(target);
                          }}
                          onEdit={(target) => {
                            onOpenEditor(target.filePath);
                          }}
                          onDelete={setDeleteTarget}
                          onStop={() => {
                            void stop(false);
                          }}
                        />
                      </div>
                    ))}
                    {tasksForStatus.length === 0 ? (
                      <p className="text-dim border-edge rounded border border-dashed px-3 py-8 text-center text-xs">
                        No tasks in this column.
                      </p>
                    ) : null}
                  </ScrollAreaContent>
                </ScrollAreaViewport>
                <ScrollAreaScrollbar orientation="vertical">
                  <ScrollAreaThumb />
                </ScrollAreaScrollbar>
              </ScrollArea>
            </div>
          );
        })}
      </section>

      <Dialog
        open={showArchiveConfirm}
        onOpenChange={(open) => {
          setShowArchiveConfirm(open);
        }}
      >
        <DialogContent className="bg-panel border-edge max-w-lg">
          <DialogHeader>
            <DialogTitle>Archive completed tasks?</DialogTitle>
            <DialogDescription>
              This creates an archive markdown file, removes completed task files, and clears
              progress notes.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-52 space-y-1 overflow-auto pr-1">
            {completedTasks.map((task) => (
              <p
                key={task.filePath}
                className="border-edge text-light rounded border px-2 py-1 text-xs"
              >
                {task.title}
              </p>
            ))}
          </div>

          <DialogFooter>
            <button
              type="button"
              className="text-mid hover:text-light border-edge rounded-md border px-3 py-2 text-sm"
              onClick={() => {
                setShowArchiveConfirm(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="text-amber border-amber/30 hover:bg-amber-bg rounded-md border px-3 py-2 text-sm"
              onClick={() => {
                void archiveCompleted();
              }}
            >
              Archive Tasks
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="bg-panel border-edge max-w-md">
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
            <DialogDescription>
              This removes the task file from disk and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <p className="text-light border-edge rounded border p-2 text-sm">{deleteTarget?.title}</p>

          <DialogFooter>
            <button
              type="button"
              className="text-mid hover:text-light border-edge rounded-md border px-3 py-2 text-sm"
              onClick={() => {
                setDeleteTarget(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="text-red border-red/35 hover:bg-red-bg rounded-md border px-3 py-2 text-sm"
              onClick={() => {
                void deleteTask();
              }}
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskDetailDialog
        task={detailTarget}
        open={detailTarget !== null}
        onClose={() => {
          setDetailTarget(null);
        }}
        onEdit={(filePath) => {
          onOpenEditor(filePath);
        }}
      />

      {isRunning ? (
        <div className="text-dim border-edge bg-background/40 rounded-lg border px-3 py-2 text-xs">
          Iteration {iteration} of {maxIterations || '∞'} -- Running...
        </div>
      ) : null}
    </div>
  );
};
