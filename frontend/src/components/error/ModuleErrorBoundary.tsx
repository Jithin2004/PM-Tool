import React, { Component, ErrorInfo } from 'react';
import { AlertOctagon, RefreshCw, Bug } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { issueReportService } from '../../services/issueReportService';

// Extracted button component to use hooks
const ReportIssueButton: React.FC<{ moduleName: string; error: Error; errorInfo: ErrorInfo }> = ({ moduleName, error, errorInfo }) => {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const [reported, setReported] = React.useState(false);
  const [reporting, setReporting] = React.useState(false);

  const handleReport = async () => {
    if (!workspace?.id || !profile?.id) return;
    setReporting(true);
    try {
      await issueReportService.createIssueReport({
        workspaceId: workspace.id,
        userId: profile.id,
        module: moduleName,
        severity: 'high',
        title: `Crash in ${moduleName} module`,
        description: error.message,
        errorStack: `${error.stack || ''}\n\nComponent Stack:\n${errorInfo.componentStack}`,
        browserMetadata: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          screen: `${window.screen.width}x${window.screen.height}`
        }
      });
      setReported(true);
    } catch (err) {
      console.error('Failed to report issue', err);
    } finally {
      setReporting(false);
    }
  };

  if (reported) {
    return <span className="text-emerald-500 text-xs font-medium px-3 py-1.5 bg-emerald-500/10 rounded">Issue Reported</span>;
  }

  return (
    <button
      onClick={handleReport}
      disabled={reporting}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-3 hover:bg-surface-4 text-[var(--pm-text-secondary)] rounded text-xs font-medium transition-colors border border-border"
    >
      <Bug className="w-3.5 h-3.5" />
      {reporting ? 'Reporting...' : 'Report Issue'}
    </button>
  );
};

interface Props {
  module: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ModuleErrorBoundary extends Component<Props, State> {
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
    console.error(`[ModuleErrorBoundary] ${this.props.module} crashed:`, error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError && this.state.error && this.state.errorInfo) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-rose-500/5 border border-rose-500/10 rounded-xl m-4 h-full min-h-[300px]">
          <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mb-4">
            <AlertOctagon className="w-6 h-6 text-rose-500" />
          </div>
          <h3 className="text-[var(--pm-text)] font-medium mb-2">
            {this.props.module} Module Failed
          </h3>
          <p className="text-[var(--pm-text-secondary)] text-sm mb-6 text-center max-w-md">
            Something went wrong while loading this section of the application. Other modules remain functional.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-primary hover:bg-accent-hover text-white rounded text-sm font-medium transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Module
            </button>
            <ReportIssueButton moduleName={this.props.module} error={this.state.error} errorInfo={this.state.errorInfo} />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
