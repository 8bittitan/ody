import { ConfigPanel } from '@/components/ConfigPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/config')({
  component: ConfigPage,
});

function ConfigPage() {
  const navigate = useNavigate();

  return (
    <ErrorBoundary title="Config view error">
      <ConfigPanel
        onOpenInitWizard={() => {
          window.dispatchEvent(new CustomEvent('ody:open-init-wizard'));
        }}
        onEditJson={(configPath) => {
          navigate({ to: '/config-editor', search: { path: configPath } });
        }}
      />
    </ErrorBoundary>
  );
}
