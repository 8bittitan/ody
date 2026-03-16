import { ConfigEditor } from '@/components/ConfigEditor';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createLazyFileRoute('/config-editor')({
  component: ConfigEditorPage,
});

function ConfigEditorPage() {
  const { path } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <ErrorBoundary title="Config editor view error">
      <ConfigEditor
        configPath={path}
        onBack={() => {
          navigate({ to: '/config' });
        }}
      />
    </ErrorBoundary>
  );
}
