import React, { Component, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoDashboard = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-surface-highest rounded-xl border border-border p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="w-8 h-8 text-rose-500" />
            </div>
            <h1 className="text-2xl font-semibold text-[var(--pm-text)] mb-3">Something went wrong</h1>
            <p className="text-[var(--pm-text-secondary)] mb-8 text-sm">
              The application encountered a critical error. {this.state.error?.message} : {this.state.error?.stack}
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 bg-accent-primary text-white py-2.5 rounded-lg font-medium hover:bg-accent-hover transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>
              <button
                onClick={this.handleGoDashboard}
                className="w-full flex items-center justify-center gap-2 bg-surface-3 text-[var(--pm-text)] py-2.5 rounded-lg font-medium hover:bg-surface-4 transition-colors border border-border"
              >
                <Home className="w-4 h-4" />
                Return to Dashboard
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-xs text-[var(--pm-text-tertiary)] mb-2">Technical Details</p>
              <div className="bg-black/5 dark:bg-black/20 p-3 rounded text-left overflow-x-auto text-[10px] font-mono text-rose-400/80 max-h-32 overflow-y-auto">
                {this.state.error?.toString()}<br/>
                {this.state.errorInfo?.componentStack}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
