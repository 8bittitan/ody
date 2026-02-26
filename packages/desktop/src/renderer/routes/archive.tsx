import { ArchiveViewer } from '@/components/ArchiveViewer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/archive')({
  component: ArchivePage,
});

function ArchivePage() {
  return (
    <ErrorBoundary title="Archive view error">
      <ArchiveViewer />
    </ErrorBoundary>
  );
}
