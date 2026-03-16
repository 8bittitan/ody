import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TaskEditor } from '@/components/TaskEditor';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createLazyFileRoute('/editor')({
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
