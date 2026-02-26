import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TaskBoard } from '@/components/TaskBoard';
import type { TaskStatus } from '@/types/ipc';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod/v4';

const tasksSearchSchema = z.object({
  label: z.string().optional(),
  status: z.enum(['all', 'pending', 'in_progress', 'completed']).optional(),
});

export const Route = createFileRoute('/tasks')({
  validateSearch: tasksSearchSchema,
  component: TasksPage,
});

function TasksPage() {
  const { label, status } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <ErrorBoundary title="Task view error">
      <TaskBoard
        labelFilter={label}
        statusFilter={status}
        onOpenPlan={() => {
          navigate({ to: '/plan' });
        }}
        onOpenArchive={() => {
          navigate({ to: '/archive' });
        }}
        onOpenEditor={(taskPath) => {
          navigate({ to: '/editor', search: { taskPath } });
        }}
        onFiltersChange={(filters) => {
          navigate({
            to: '/tasks',
            search: (prev: { label?: string; status?: TaskStatus | 'all' }) => ({
              ...prev,
              label:
                filters.label === undefined
                  ? prev.label
                  : filters.label === null
                    ? undefined
                    : filters.label,
              status:
                filters.status === undefined
                  ? prev.status
                  : filters.status === 'all'
                    ? undefined
                    : filters.status,
            }),
          });
        }}
      />
    </ErrorBoundary>
  );
}
