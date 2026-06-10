import React, { useState } from 'react';
import { HelpCircle, AlertTriangle, Send, X, Shield, FileJson } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hasCapability } from '../../core/auth/permissions';
import { supportService } from '../../services/supportService';

interface SupportEscalationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export function SupportEscalationModal({ isOpen, onClose, notify }: SupportEscalationModalProps) {
  const { profile } = useAuth();
  const [issue, setIssue] = useState('');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const isAdmin = profile?.role ? hasCapability(profile.role, 'platform_governance') : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue.trim()) return;
    
    setIsSending(true);
    try {
      // If admin, we generate a diagnostic package to send to external Resolve support.
      // If employee, we just simulate sending an internal ticket to their company IT.
      if (isAdmin) {
        const diagnostics = await supportService.generateSupportPackage(profile?.workspace_id || '');
        console.log("Escalating to Resolve PM HQ with diagnostics:", diagnostics);
        notify("Ticket escalated to Resolve PM Support with attached system diagnostics.", "success");
      } else {
        console.log("Sending internal ticket to Company Admin:", issue);
        notify("Support ticket submitted to your internal Company Administrator.", "success");
      }
      onClose();
    } catch (err: any) {
      notify(err.message || "Failed to submit ticket.", "error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--pm-surface)] rounded-xl border border-[var(--pm-border)] shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--pm-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-[var(--pm-text)]">Support Escalation</h2>
          </div>
          <button onClick={onClose} className="text-[var(--pm-text-secondary)] hover:text-[var(--pm-text)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className={`p-4 rounded-lg border flex gap-3 text-sm ${isAdmin ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-[var(--pm-surface-elevated)] border-[var(--pm-border)] text-[var(--pm-text-secondary)]'}`}>
            {isAdmin ? <Shield className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <div>
              <p className="font-bold mb-1">{isAdmin ? 'External Escalation (Resolve Support)' : 'Internal IT Escalation'}</p>
              <p className="text-[11px] leading-relaxed">
                {isAdmin 
                  ? 'As a system administrator, this ticket will be escalated directly to Resolve PM. A privacy-safe diagnostic package will be automatically attached to help resolve your issue faster.' 
                  : 'Your request will be routed to your internal Company Administrator. They will review your issue and assist you directly.'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono-pm uppercase tracking-widest text-[var(--pm-text-secondary)] mb-2">Issue Description</label>
            <textarea
              required
              rows={4}
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="Describe what you were trying to do..."
              className="w-full bg-[var(--pm-surface-high)] border border-[var(--pm-border)] rounded-lg p-3 text-sm text-[var(--pm-text)] focus:border-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 text-[10px] font-mono-pm text-indigo-400">
              <FileJson className="w-3.5 h-3.5" />
              system_diagnostics.json will be attached
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSending || !issue.trim()}
              className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-bold transition-colors"
            >
              {isSending ? 'Routing...' : 'Submit Ticket'}
              {!isSending && <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
