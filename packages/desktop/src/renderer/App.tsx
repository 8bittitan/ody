import { QueryClientProvider } from '@tanstack/react-query';

import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Toaster } from './components/ui/sonner';
import { useTheme } from './hooks/useTheme';
import { queryClient } from './lib/queryClient';

export const App = () => {
  useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary title="Application crashed">
        <Layout />
      </ErrorBoundary>
      <Toaster
        position="top-right"
        offset={{ top: 56, right: 20 }}
        toastOptions={{
          duration: 2500,
        }}
      />
    </QueryClientProvider>
  );
};
