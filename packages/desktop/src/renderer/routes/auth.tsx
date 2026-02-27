import { AuthPanel } from '@/components/AuthPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/auth')({
  component: AuthPage,
});

function AuthPage() {
  return (
    <ErrorBoundary title="Auth view error">
      <AuthPanel />
    </ErrorBoundary>
  );
}
