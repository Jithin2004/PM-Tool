import React, { useEffect, useState } from 'react';
import { issueReportService, SystemIssueReport, IssueStatus } from '../../services/issueReportService';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Bug, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

export const IssueManagementPanel: React.FC = () => {
  const { workspace } = useWorkspace();
  const [issues, setIssues] = useState<SystemIssueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchIssues = async () => {
    if (!workspace?.id) return;
    try {
      setLoading(true);
      const data = await issueReportService.getWorkspaceIssues(workspace.id);
      setIssues(data);
    } catch (err) {
      console.error('Failed to fetch issues', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [workspace?.id]);

  const handleStatusChange = async (id: string, status: IssueStatus) => {
    try {
      await issueReportService.updateIssueStatus(id, status);
      await fetchIssues();
    } catch (err) {
      console.error('Failed to update issue status', err);
    }
  };

  if (loading) return <div className="p-4 text-sm text-[var(--pm-text-secondary)]">Loading issues...</div>;
  if (issues.length === 0) return <div className="p-4 text-sm text-[var(--pm-text-secondary)]">No system issues reported.</div>;

  return (
    <div className="space-y-4">
      {issues.map(issue => (
        <div key={issue.id} className="bg-surface-2 border border-border rounded-lg overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-surface-3 transition-colors"
            onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
          >
            <div className="flex items-center gap-3">
              {issue.status === 'open' ? <AlertTriangle className="w-5 h-5 text-rose-500" /> :
               issue.status === 'investigating' ? <Clock className="w-5 h-5 text-amber-500" /> :
               <CheckCircle className="w-5 h-5 text-emerald-500" />}
              <div>
                <h4 className="font-medium text-[var(--pm-text)]">{issue.title}</h4>
                <div className="text-xs text-[var(--pm-text-secondary)] flex items-center gap-2 mt-1">
                  <span className="capitalize">{issue.severity}</span> • 
                  <span>Module: {issue.module}</span> •
                  <span>{new Date(issue.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={issue.status}
                onChange={(e) => handleStatusChange(issue.id, e.target.value as IssueStatus)}
                onClick={e => e.stopPropagation()}
                className="bg-surface-highest border border-border rounded px-2 py-1 text-xs"
              >
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
              </select>
              {expandedId === issue.id ? <ChevronUp className="w-4 h-4 text-[var(--pm-text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--pm-text-secondary)]" />}
            </div>
          </div>
          
          {expandedId === issue.id && (
            <div className="p-4 border-t border-border bg-surface-highest text-sm">
              <div className="mb-4">
                <p className="font-medium text-[var(--pm-text)] mb-1">Description</p>
                <p className="text-[var(--pm-text-secondary)] whitespace-pre-wrap">{issue.description}</p>
              </div>
              
              {issue.error_stack && (
                <div className="mb-4">
                  <p className="font-medium text-[var(--pm-text)] mb-1">Stack Trace</p>
                  <pre className="bg-black/10 dark:bg-black/30 p-3 rounded overflow-x-auto text-xs font-mono text-rose-400/80 max-h-40 overflow-y-auto">
                    {issue.error_stack}
                  </pre>
                </div>
              )}

              {issue.browser_metadata && (
                <div>
                  <p className="font-medium text-[var(--pm-text)] mb-1">Browser Metadata</p>
                  <pre className="bg-black/10 dark:bg-black/30 p-3 rounded overflow-x-auto text-xs font-mono text-[var(--pm-text-secondary)]">
                    {JSON.stringify(issue.browser_metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
