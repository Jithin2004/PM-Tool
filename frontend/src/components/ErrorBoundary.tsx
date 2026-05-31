import React from 'react';
import { activityLogService } from '../services/activityLogService';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  name: string;
  workspaceId?: string;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const wsId = this.props.workspaceId || '';
    activityLogService.appendLog({
      workspace_id: wsId,
      action: 'render_failure_events',
      metadata: { boundary: this.props.name, error: error.message, stack: error.stack?.slice(0, 500), componentStack: info.componentStack?.slice(0, 500) },
    }).catch(() => {});
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex-1 flex items-center justify-center p-8" role="alert">
          <div className="border border-red-500/25 bg-signal-critical-bg p-6 max-w-md text-center rounded">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center bg-signal-critical-bg text-signal-critical rounded-full">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold mb-1 text-text-primary" id={`${this.props.name}-error-title`}>
              {this.props.name} Error
            </h3>
            <p className="text-[11px] font-mono text-text-tertiary mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-[var(--pm-surface)]/10 text-text-primary text-[10px] font-medium uppercase tracking-wider hover:bg-[var(--pm-surface)]/20 transition-colors rounded-sm"
              aria-label={`Retry ${this.props.name}`}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function DashboardErrorBoundary({ children, workspaceId }: { children: React.ReactNode; workspaceId?: string }) {
  return <ErrorBoundary name="Dashboard" workspaceId={workspaceId}>{children}</ErrorBoundary>;
}

export function ExecutionErrorBoundary({ children, workspaceId }: { children: React.ReactNode; workspaceId?: string }) {
  return <ErrorBoundary name="Execution" workspaceId={workspaceId}>{children}</ErrorBoundary>;
}

export function IntegrationErrorBoundary({ children, workspaceId }: { children: React.ReactNode; workspaceId?: string }) {
  return <ErrorBoundary name="Integration" workspaceId={workspaceId}>{children}</ErrorBoundary>;
}
