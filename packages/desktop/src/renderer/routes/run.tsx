import { AgentRunner } from '@/components/AgentRunner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/run')({
  component: RunPage,
});

function RunPage() {
  return (
    <ErrorBoundary title="Run view error">
      <AgentRunner />
    </ErrorBoundary>
  );
}
