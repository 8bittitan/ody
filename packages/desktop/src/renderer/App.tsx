import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';

import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/sonner';
import { useTheme } from './hooks/useTheme';
import { queryClient } from './lib/queryClient';
import { router } from './router';

export const App = () => {
  useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary title="Application crashed">
        <RouterProvider router={router} />
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
