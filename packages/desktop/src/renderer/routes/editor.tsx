import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TaskEditor } from '@/components/TaskEditor';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod/v4';

const editorSearchSchema = z.object({
  taskPath: z.string(),
});

export const Route = createFileRoute('/editor')({
  validateSearch: editorSearchSchema,
  component: EditorPage,
});

function EditorPage() {
  const { taskPath } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <ErrorBoundary title="Editor view error">
      <TaskEditor
        taskPath={taskPath}
        onBack={() => {
          navigate({ to: '/tasks' });
        }}
      />
    </ErrorBoundary>
  );
}
