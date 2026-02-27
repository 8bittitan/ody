import { AlertTriangle } from 'lucide-react';
import { Component, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
  onRetry?: () => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <section className="bg-panel border-edge flex h-full min-h-55 flex-col items-center justify-center rounded-lg border p-6 text-center">
        <AlertTriangle className="text-red mb-3 size-6" />
        <h2 className="text-light text-sm font-semibold tracking-[0.08em] uppercase">
          {this.props.title ?? 'Something went wrong'}
        </h2>
        <p className="text-mid mt-2 max-w-xl text-xs">
          {this.state.error?.message ?? 'An unexpected UI error occurred.'}
        </p>
        <button
          type="button"
          className="bg-primary text-primary-foreground hover:bg-accent-hover mt-4 rounded-md px-3 py-1.5 text-xs font-medium"
          onClick={this.handleRetry}
        >
          Retry
        </button>
      </section>
    );
  }
}
