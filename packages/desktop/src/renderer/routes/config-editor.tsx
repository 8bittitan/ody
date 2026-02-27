import { ConfigEditor } from '@/components/ConfigEditor';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod/v4';

const configEditorSearchSchema = z.object({
  path: z.string(),
});

export const Route = createFileRoute('/config-editor')({
  validateSearch: configEditorSearchSchema,
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
