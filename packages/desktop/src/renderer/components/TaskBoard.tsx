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
import { useRunAgent } from '@/hooks/useAgent';
import { useConfig } from '@/hooks/useConfig';
import { useNotifications } from '@/hooks/useNotifications';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { api } from '@/lib/api';
import type { TaskStatus, TaskSummary } from '@/types/ipc';
import { ClipboardList } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';
import { TaskCard } from './TaskCard';
import { TaskDetailDialog } from './TaskDetailDialog';
import { TaskFilters } from './TaskFilters';
import { Button } from './ui/button';

type TaskBoardProps = {
  onOpenPlan: () => void;
  onOpenArchive: () => void;
  onOpenEditor: (taskPath: string) => void;
  labelFilter?: string;
  statusFilter?: TaskStatus | 'all';
  onFiltersChange?: (filters: { label?: string | null; status?: TaskStatus | 'all' }) => void;
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

const LARGE_COLUMN_THRESHOLD = 40;

export const TaskBoard = ({
  onOpenPlan,
  onOpenArchive,
  onOpenEditor,
  labelFilter,
  statusFilter = 'all',
  onFiltersChange,
}: TaskBoardProps) => {
  const { activeProjectPath } = useProjects();
  const { tasks, loadTasks, isLoading } = useTasks();
  const { config } = useConfig();
  const {
    start,
    stop,
    isRunning: isRunActive,
    outputPreview,
    iteration,
    maxIterations,
  } = useRunAgent(activeProjectPath);
  const { accent, warning, error } = useNotifications();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TaskSummary | null>(null);
  const [detailTarget, setDetailTarget] = useState<TaskSummary | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);

  const computed = useMemo(() => {
    const query = search.trim().toLowerCase();
    const activeLabel = labelFilter ?? null;
    const activeStatus = statusFilter === 'all' ? null : statusFilter;
    const uniqueLabels = new Set<string>();
    const grouped: Record<TaskStatus, TaskSummary[]> = {
      pending: [],
      in_progress: [],
      completed: [],
    };
    const completedTasks: TaskSummary[] = [];

    for (const task of tasks) {
      for (const label of task.labels) {
        uniqueLabels.add(label);
      }

      if (task.status === 'completed') {
        completedTasks.push(task);
      }

      if (activeLabel && !task.labels.includes(activeLabel)) {
        continue;
      }

      if (activeStatus && task.status !== activeStatus) {
        continue;
      }

      if (query.length > 0) {
        const searchable =
          `${task.title}\n${task.description}\n${task.labels.join(' ')}`.toLowerCase();
        if (!searchable.includes(query)) {
          continue;
        }
      }

      grouped[task.status].push(task);
    }

    return {
      grouped,
      completedTasks,
      labelOptions: [...uniqueLabels]
        .sort((left, right) => left.localeCompare(right))
        .map((label) => ({ label, value: label })),
    };
  }, [labelFilter, search, statusFilter, tasks]);

  const startTaskRun = async (task: TaskSummary) => {
    if (!activeProjectPath) {
      return;
    }

    if (isRunActive) {
      warning({ title: 'Agent is already running' });
      return;
    }

    const iterations = typeof config?.maxIterations === 'number' ? config.maxIterations : 1;
    const autoCommit = typeof config?.autoCommit === 'boolean' ? config.autoCommit : false;

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
        description: autoCommit ? 'Auto-commit enabled.' : undefined,
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
        accent({ title: 'Task deleted', description: deleteTarget.title });
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
    if (computed.completedTasks.length === 0) {
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
      <TaskFilters
        search={search}
        onSearchChange={setSearch}
        labelOptions={computed.labelOptions}
        selectedLabel={labelFilter ?? null}
        onLabelChange={(value) => {
          onFiltersChange?.({ label: value });
        }}
        selectedStatus={statusFilter}
        onStatusChange={(value) => {
          onFiltersChange?.({ status: value });
        }}
      />

      <section className="flex items-center justify-between gap-2">
        <div className="text-dim border-edge bg-background/40 rounded-lg border px-3 py-2 text-xs">
          {isRunActive ? `Iteration ${iteration} of ${maxIterations || '∞'} - Running...` : 'Idle'}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (computed.completedTasks.length === 0) {
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

      <section className="grid min-h-0 flex-1 gap-3 md:grid-cols-3">
        {(['pending', 'in_progress', 'completed'] as const).map((status) => {
          const tasksForStatus = computed.grouped[status];
          const useContentVisibility = tasksForStatus.length >= LARGE_COLUMN_THRESHOLD;

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
                    {tasksForStatus.map((task) => (
                      <div
                        key={task.filePath}
                        style={useContentVisibility ? { contentVisibility: 'auto' } : undefined}
                      >
                        <TaskCard
                          task={task}
                          outputPreview={status === 'in_progress' ? outputPreview : undefined}
                          isRunning={status === 'in_progress' ? isRunActive : undefined}
                          onClick={setDetailTarget}
                          onRun={(target) => {
                            void startTaskRun(target);
                          }}
                          onEdit={(target) => {
                            onOpenEditor(target.filePath);
                          }}
                          onDelete={setDeleteTarget}
                          onStop={
                            status === 'in_progress'
                              ? () => {
                                  void stop(false);
                                }
                              : undefined
                          }
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

      <Dialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <DialogContent className="bg-panel border-edge max-w-lg">
          <DialogHeader>
            <DialogTitle>Archive completed tasks?</DialogTitle>
            <DialogDescription>
              This creates an archive markdown file, removes completed task files, and clears
              progress notes.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-52 space-y-1 overflow-auto pr-1">
            {computed.completedTasks.map((task) => (
              <p
                key={task.filePath}
                className="border-edge text-light rounded border px-2 py-1 text-xs"
              >
                {task.title}
              </p>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchiveConfirm(false)}>
              Cancel
            </Button>
            <Button variant="primary-outline" onClick={() => void archiveCompleted()}>
              Archive Tasks
            </Button>
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
              {deleteTarget
                ? `This will permanently remove "${deleteTarget.title}".`
                : 'This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void deleteTask()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskDetailDialog
        task={detailTarget}
        open={detailTarget !== null}
        onClose={() => setDetailTarget(null)}
        onEdit={onOpenEditor}
      />
    </div>
  );
};
