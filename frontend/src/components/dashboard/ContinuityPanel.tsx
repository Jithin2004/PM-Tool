import React, { useEffect, useState } from 'react';
import { generateContinuityBrief, ContinuityBrief } from '../../core/continuity/ContinuityEngine';
import { useAuth } from '../../context/AuthContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { Coffee, AlertCircle, ArrowRight, ShieldAlert, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { generatePriorityExplanation } from '../../core/intelligence/PriorityExplanationEngine';
import { PriorityExplanationBadge } from '../ui/PriorityExplanationBadge';

export function ContinuityPanel() {
  const { profile, user } = useAuth();
  const { raw: { tasks, projects, workspaceSettingsBlob } } = useOperationalData();
  const [brief, setBrief] = useState<ContinuityBrief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !user || !tasks || tasks.length === 0) return;

    let isMounted = true;

    async function loadBrief() {
      try {
        const { data: approvals } = await supabase
          .from('universal_approvals')
          .select('*')
          .eq('workspace_id', profile?.workspace_id || '');

        const blockers = (workspaceSettingsBlob?.execution_blockers as any[]) || [];

        const b = await generateContinuityBrief({
          userId: user!.id,
          workspaceId: profile!.workspace_id,
          role: profile!.role,
          tasks,
          projects,
          blockers,
          approvals: approvals || []
        });

        if (isMounted) {
          setBrief(b);
        }
      } catch (err) {
        console.error('Failed to generate continuity brief', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadBrief();

    return () => { isMounted = false; };
  }, [profile, user, tasks, projects, workspaceSettingsBlob]);

  if (loading || !brief || !brief.absenceDetected) {
    return null; // Do not show if no significant absence or still loading
  }

  const navigateTo = (path?: string) => {
    if (!path) return;
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('popstate'));
  };

  return (
    <div className="mb-8 border border-border rounded-xl overflow-hidden bg-surface-2 shadow-sm font-geist">
      {/* Header */}
      <div className={`px-6 py-4 border-b border-border/50 flex items-center justify-between
        ${brief.mode === 'deep-reorientation' ? 'bg-indigo-500/10' : brief.mode === 'catch-up' ? 'bg-blue-500/10' : 'bg-surface-3'}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${brief.mode === 'deep-reorientation' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-blue-500/20 text-blue-400'}`}>
            {brief.mode === 'deep-reorientation' ? <RefreshCw className="w-5 h-5" /> : <Coffee className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Welcome Back</h2>
            <p className="text-sm text-text-secondary">
              {brief.mode === 'deep-reorientation' ? "It's been a few days. Let's get you reoriented safely." : "Here's what changed while you were away."}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono text-text-tertiary uppercase tracking-wider block">Time Away</span>
          <span className="text-sm font-semibold text-text-secondary">{brief.awayDurationHours}h</span>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/50">
        
        {/* Left Col: Changes While Away */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-text-tertiary" /> While You Were Away
          </h3>
          {brief.changesWhileAway.length === 0 ? (
            <p className="text-sm text-text-tertiary italic">No significant changes detected in your scope.</p>
          ) : (
            <div className="space-y-3">
              {brief.changesWhileAway.slice(0, 4).map((c, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <div className="mt-0.5 shrink-0">
                    {c.type === 'assignment' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {c.type === 'priority' && <AlertCircle className="w-4 h-4 text-amber-500" />}
                    {c.type === 'blocker' && <AlertCircle className="w-4 h-4 text-signal-error" />}
                    {c.type === 'approval' && <ShieldAlert className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-text-secondary leading-snug">{c.description}</p>
                    <span className="text-xs text-text-tertiary mt-0.5 block">
                      {new Date(c.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
              {brief.changesWhileAway.length > 4 && (
                <p className="text-xs text-text-tertiary pt-2 border-t border-border/50">
                  + {brief.changesWhileAway.length - 4} more updates
                </p>
              )}
            </div>
          )}
        </div>

        {/* Mid Col: Recommended Start Order */}
        <div className="p-6 md:col-span-2">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-accent-primary" /> Recommended Start
          </h3>
          {brief.recommendedStartOrder.length === 0 ? (
            <p className="text-sm text-text-tertiary italic">Your queue is clear. Pick up any task to begin.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {brief.recommendedStartOrder.slice(0, 4).map((r, i) => (
                <div 
                  key={r.id} 
                  className={`p-3 rounded-lg border bg-surface-highest transition-colors cursor-pointer hover:bg-[var(--pm-surface-hover)]
                    ${i === 0 ? 'border-accent-primary/50 bg-accent-primary/5 shadow-sm' : 'border-border'}`}
                  onClick={() => navigateTo(r.type === 'blocker_others' ? '/workspace/approvals' : '/execution/board')}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold
                      ${i === 0 ? 'bg-accent-primary text-white' : 'bg-surface-3 text-text-secondary'}`}>
                      {i + 1}
                    </span>
                    <span className={`text-[10px] uppercase font-mono tracking-wider font-semibold
                      ${r.type === 'blocker_others' ? 'text-signal-error' : r.type === 'overdue' ? 'text-amber-500' : 'text-text-tertiary'}`}>
                      {r.type.replace('_', ' ')}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-text-primary line-clamp-1 flex items-center gap-2">
                    {r.title}
                    {r.taskId && (
                      <PriorityExplanationBadge 
                        explanation={generatePriorityExplanation(
                          tasks.find(t => t.id === r.taskId) || { id: r.taskId },
                          'task',
                          { userId: user?.id || '', role: profile?.role || 'developer' as any, tasks, projects, blockers: (workspaceSettingsBlob?.execution_blockers as any[]) || [], approvals: [] }
                        )}
                      />
                    )}
                  </h4>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">{r.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
