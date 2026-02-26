import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TaskImport } from '@/components/TaskImport';
import { useConfig } from '@/hooks/useConfig';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/import')({
  component: ImportPage,
});

function ImportPage() {
  const navigate = useNavigate();
  const { config } = useConfig();

  return (
    <ErrorBoundary title="Import view error">
      <TaskImport
        config={config}
        onOpenAuth={() => {
          navigate({ to: '/auth' });
        }}
        onOpenTaskBoard={() => {
          navigate({ to: '/tasks' });
        }}
      />
    </ErrorBoundary>
  );
}
