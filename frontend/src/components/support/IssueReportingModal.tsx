import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bug, AlertTriangle, CheckCircle, Send } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { issueReportService, IssueSeverity } from '../../services/issueReportService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const IssueReportingModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [module, setModule] = useState('General');
  const [severity, setSeverity] = useState<IssueSeverity>('medium');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    if (!workspace?.id || !profile?.id) return;

    setIsSubmitting(true);
    setError(null);
    
    try {
      await issueReportService.createIssueReport({
        workspaceId: workspace.id,
        userId: profile.id,
        module,
        severity,
        title,
        description,
        browserMetadata: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          screen: `${window.screen.width}x${window.screen.height}`
        }
      });
      setSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit issue report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-surface border border-border w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center">
                <Bug className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--pm-text)]">Report an Issue</h2>
                <p className="text-xs text-[var(--pm-text-secondary)]">Internal system reporting</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-[var(--pm-text-secondary)] hover:bg-surface-3 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto">
            {submitted ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-[var(--pm-text)] mb-2">Issue Reported</h3>
                <p className="text-[var(--pm-text-secondary)] mb-6">
                  Your report has been securely logged for the internal workspace administration team.
                </p>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-surface-3 hover:bg-surface-4 text-[var(--pm-text)] rounded-lg transition-colors border border-border"
                >
                  Close
                </button>
              </div>
            ) : (
              <form id="issue-form" onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start gap-2 text-rose-500 text-sm">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--pm-text-secondary)] mb-1.5">Module / Area</label>
                    <select
                      value={module}
                      onChange={e => setModule(e.target.value)}
                      className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-[var(--pm-text)] focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all"
                    >
                      <option value="General">General App</option>
                      <option value="Projects">Projects / Stories</option>
                      <option value="Finance">Finance</option>
                      <option value="HR">HR / Leaves</option>
                      <option value="Documents">Documents</option>
                      <option value="Gantt">Timeline / Gantt</option>
                      <option value="Automations">Automations</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--pm-text-secondary)] mb-1.5">Severity</label>
                    <select
                      value={severity}
                      onChange={e => setSeverity(e.target.value as IssueSeverity)}
                      className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-[var(--pm-text)] focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all"
                    >
                      <option value="low">Low (Cosmetic/Minor)</option>
                      <option value="medium">Medium (Annoying but usable)</option>
                      <option value="high">High (Broken functionality)</option>
                      <option value="critical">Critical (Data loss / Crash)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--pm-text-secondary)] mb-1.5">Brief Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Finance ledger doesn't load"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-[var(--pm-text)] focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all placeholder-[var(--pm-text-tertiary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--pm-text-secondary)] mb-1.5">Description & Steps to Reproduce</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Please describe what happened, what you clicked, and what you expected to see..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-[var(--pm-text)] focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all resize-none placeholder-[var(--pm-text-tertiary)]"
                  />
                </div>
              </form>
            )}
          </div>

          {!submitted && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface-2/30">
              <p className="text-xs text-[var(--pm-text-tertiary)] max-w-[200px]">
                Issues are reported internally to your workspace administrators.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-[var(--pm-text-secondary)] hover:text-[var(--pm-text)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="issue-form"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 bg-accent-primary hover:bg-accent-hover text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    'Submitting...'
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Submit Report
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
