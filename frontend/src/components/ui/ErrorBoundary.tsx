import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { observabilityService } from '../../services/observabilityService';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    observabilityService.captureReactError(error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-6 bg-surface">
          <div className="max-w-md w-full bg-surface-2 border border-[var(--signal-critical)] bg-[var(--signal-critical-bg)]/30 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-orange-500" />
            
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <h2 className="text-lg font-bold text-text-primary mb-2">Unexpected System Error</h2>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              We encountered a critical runtime error in this module. The execution state has been paused to prevent data corruption.
            </p>
            
            {this.state.error && (
              <div className="bg-[var(--pm-surface)] dark:bg-black/30 border border-border p-3 rounded-lg mb-8 text-left overflow-auto max-h-32">
                <p className="text-[10px] font-mono text-red-400">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-surface-3 hover:bg-surface-4 text-text-primary text-xs font-bold uppercase tracking-widest rounded-lg transition-colors border border-border flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Reload System
              </button>
              
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/workspace';
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-[var(--pm-text)] text-[var(--text-primary)] text-xs font-bold uppercase tracking-widest rounded-lg transition-colors shadow-lg shadow-accent-primary/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" /> Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
