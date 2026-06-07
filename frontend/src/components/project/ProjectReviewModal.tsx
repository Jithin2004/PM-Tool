import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ProjectReviewModalProps {
  project: any;
  workspaceId: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  estimatedHours: number;
  actualHours: number;
}

export function ProjectReviewModal({ project, workspaceId, userId, isOpen, onClose, onSuccess, notify, estimatedHours, actualHours }: ProjectReviewModalProps) {
  useEscapeKey(isOpen, onClose);
  
  const [delayReasons, setDelayReasons] = useState<string[]>([]);
  const [newDelayReason, setNewDelayReason] = useState('');
  
  const [improvementFactors, setImprovementFactors] = useState<string[]>([]);
  const [newImprovement, setNewImprovement] = useState('');

  const [loading, setLoading] = useState(false);

  const timelineDiffDays = Math.round((actualHours - estimatedHours) / 8);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    try {
      const { error } = await supabase.from('project_reviews').insert({
        workspace_id: workspaceId,
        project_id: project.id,
        original_estimate_hours: estimatedHours,
        actual_time_hours: actualHours,
        timeline_diff_days: timelineDiffDays,
        delay_reasons: JSON.stringify(delayReasons),
        improvement_factors: JSON.stringify(improvementFactors),
        created_by: userId
      });

      if (error) throw error;
      
      notify('Project completion review saved. Insights updated.', 'success');
      onSuccess();
      onClose();
    } catch (e) {
      notify('Failed to save project review.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addReason = () => {
    if (newDelayReason.trim() && !delayReasons.includes(newDelayReason.trim())) {
      setDelayReasons([...delayReasons, newDelayReason.trim()]);
      setNewDelayReason('');
    }
  };

  const addImprovement = () => {
    if (newImprovement.trim() && !improvementFactors.includes(newImprovement.trim())) {
      setImprovementFactors([...improvementFactors, newImprovement.trim()]);
      setNewImprovement('');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-premium">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="modal-premium w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] rounded-2xl"
        >
          <div className="flex items-center justify-between p-4 border-b border-border flex-none">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-text-primary tracking-tight">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Project Completion Review
            </h2>
            <button onClick={onClose} aria-label="Close modal" className="p-1 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-2 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            <form id="review-form" onSubmit={handleSubmit} className="p-6 space-y-6">
              
              <div className="bg-surface-2 p-4 rounded-lg border border-border">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Effort Summary</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-text-tertiary">Estimated</p>
                    <p className="text-lg font-bold text-text-primary">{estimatedHours}h</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary">Actual</p>
                    <p className="text-lg font-bold text-text-primary">{actualHours}h</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary">Variance (Days)</p>
                    <p className={`text-lg font-bold ${timelineDiffDays > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {timelineDiffDays > 0 ? '+' : ''}{timelineDiffDays}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-3">What caused delays or friction? (Select all that apply)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                  {[
                    'Planning mistake',
                    'Requirement change',
                    'Execution issue',
                    'External delay'
                  ].map(reason => (
                    <label key={reason} className="flex items-center gap-2 p-2 rounded border border-border bg-surface-2 cursor-pointer hover:bg-surface-3 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={delayReasons.includes(reason)}
                        onChange={(e) => {
                          if (e.target.checked) setDelayReasons([...delayReasons, reason]);
                          else setDelayReasons(delayReasons.filter(r => r !== reason));
                        }}
                        className="rounded border-border text-amber-500 focus:ring-amber-500 bg-surface"
                      />
                      <span className="text-sm text-text-primary">{reason}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">What improved delivery? (Optional)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newImprovement}
                    onChange={(e) => setNewImprovement(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addImprovement(); } }}
                    placeholder="e.g. Clear requirements, good test coverage..."
                    className="flex-1 input-premium px-3 py-2 text-sm"
                  />
                  <button type="button" onClick={addImprovement} className="px-3 py-2 btn-premium-secondary text-text-primary text-sm font-medium rounded border border-border">Add</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {improvementFactors.map(r => (
                    <span key={r} className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-xs px-2 py-1 rounded border border-emerald-500/20">
                      {r}
                      <button type="button" onClick={() => setImprovementFactors(improvementFactors.filter(x => x !== r))}><X className="w-3 h-3 hover:text-emerald-300" /></button>
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-text-tertiary">
                These insights help the intelligence engine predict future project timelines more accurately without ranking individual employees.
              </p>

            </form>
          </div>

          <div className="p-4 border-t border-border flex justify-end gap-3 flex-none">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary btn-premium-secondary rounded-lg">
              Skip
            </button>
            <button type="submit" form="review-form" disabled={loading} className="px-4 py-2 btn-premium-success rounded text-sm font-medium flex items-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Learnings'}
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
