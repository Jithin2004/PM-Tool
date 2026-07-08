import React, { useEffect, useState } from 'react';
import { ProjectCard } from '../../components/project/ProjectCard';
import { deliverableService, Milestone } from '../../services/deliverableService';
import { Icon } from '../../components/ui/Icon';
import { PremiumEmptyState } from '../../components/ui/PremiumEmptyState';
import { Briefcase } from 'lucide-react';
import { navigate } from '../../lib/navigation';


export function ClientDeliveryPortal({ profile, projects, notify, workspaceId }: any) {
  // Only show projects the client has access to, and filter out internal metadata
  const clientProjects = projects.filter((p: any) => p.status !== 'archived');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'changes_requested'>('approved');
  const [reviewComments, setReviewComments] = useState('');

  useEffect(() => {
    if (workspaceId) {
      loadMilestones();
    }
  }, [workspaceId]);

  const loadMilestones = async () => {
    try {
      const data = await deliverableService.getMilestones(workspaceId, 'client_review');
      setMilestones(data);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleReviewClick = (m: Milestone) => {
    setSelectedMilestone(m);
    setReviewDecision('approved');
    setReviewComments('');
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedMilestone || !profile?.id) return;
    try {
      await deliverableService.submitSignoff(
        workspaceId,
        selectedMilestone.id,
        profile.id,
        reviewDecision,
        reviewComments
      );
      notify(`Deliverable ${reviewDecision === 'approved' ? 'Approved' : 'Changes Requested'}`, 'success');
      setReviewModalOpen(false);
      loadMilestones();
    } catch (e: any) {
      notify(e.message, 'error');
    }
  };

  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)]" style={{ color: 'var(--pm-on-surface)' }}>
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Project Delivery Portal</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Welcome {profile?.full_name?.split(' ')[0] || 'Client'}. Here is the latest progress on your initiatives.
          </p>
        </div>
      </div>

      {milestones.length > 0 && (
        <div className="mt-8 p-6 rounded-2xl border border-amber-500/30 bg-surface-lowest">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="priority_high" size={24} className="text-amber-500" />
            <h2 className="text-lg font-bold text-amber-500 uppercase tracking-wider font-mono">Needs Your Attention</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {milestones.map(m => (
              <div key={m.id} className="p-4 rounded-xl border border-[var(--pm-border)] bg-surface-2 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-[10px] uppercase text-[var(--pm-on-surface-variant)] mb-1">{m.project_name}</div>
                    <div className="font-bold">{m.title}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-amber-500/10 text-amber-500">
                    READY FOR APPROVAL
                  </span>
                </div>
                {m.description && <p className="text-sm text-[var(--pm-on-surface-variant)] line-clamp-2">{m.description}</p>}
                <div className="pt-3 border-t border-[var(--pm-border)] flex justify-end">
                  <button onClick={() => handleReviewClick(m)} className="btn-premium-primary px-4 py-1.5 text-xs font-bold uppercase tracking-wider">
                    Review Deliverable
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wider font-mono mb-4 text-[var(--text-secondary)]">Active Deliveries</h2>
        
        {clientProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clientProjects.map((project: any) => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                teams={[]}
                profiles={[]}
                onClick={() => navigate(`/workspace/portfolio`)}
              />
            ))}
          </div>
        ) : (
          <PremiumEmptyState
            icon={Briefcase}
            title="No Active Projects"
            description="You do not currently have any active projects deployed in the delivery portal. Once projects are initialized, their progress status will be visualized here."
          />
        )}
      </div>

      {reviewModalOpen && selectedMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-premium">
          <div className="modal-premium rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-[var(--pm-border)] flex items-center justify-between">
              <h2 className="font-semibold text-lg">Review Deliverable</h2>
              <button onClick={() => setReviewModalOpen(false)} className="opacity-50 hover:opacity-100">
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-bold text-xl">{selectedMilestone.title}</h3>
                <p className="text-sm text-[var(--pm-on-surface-variant)]">{selectedMilestone.project_name}</p>
              </div>
              <div className="flex gap-2">
                <button
                  className={`flex-1 p-3 rounded-lg border font-semibold flex items-center justify-center gap-2 ${reviewDecision === 'approved' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'border-[var(--pm-border)] text-[var(--pm-on-surface-variant)]'}`}
                  onClick={() => setReviewDecision('approved')}
                >
                  <Icon name="check_circle" size={18} /> Approve
                </button>
                <button
                  className={`flex-1 p-3 rounded-lg border font-semibold flex items-center justify-center gap-2 ${reviewDecision === 'changes_requested' ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'border-[var(--pm-border)] text-[var(--pm-on-surface-variant)]'}`}
                  onClick={() => setReviewDecision('changes_requested')}
                >
                  <Icon name="edit" size={18} /> Request Changes
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">Comments</label>
                <textarea
                  className="w-full bg-surface-lowest border border-[var(--pm-border)] rounded p-3 text-sm min-h-24 outline-none focus:border-primary"
                  placeholder={reviewDecision === 'approved' ? "Optional approval notes..." : "Please describe what changes are needed..."}
                  value={reviewComments}
                  onChange={e => setReviewComments(e.target.value)}
                />
              </div>
            </div>
            <div className="p-4 border-t border-[var(--pm-border)] flex justify-end gap-3 bg-black/10">
              <button onClick={() => setReviewModalOpen(false)} className="btn-premium-secondary px-4 py-2 rounded-lg text-sm font-medium">Cancel</button>
              <button onClick={handleSubmitReview} className="btn-premium-primary px-4 py-2 rounded-lg text-sm font-semibold">
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
