import React from 'react';
import { Rocket, Users, Target, CheckCircle2 } from 'lucide-react';
import { navigate } from '../../lib/navigation';


export function EmptyWorkspaceWizard() {
  const navigate = (path: string) => {
    navigate(path);
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="text-center mb-12">
        <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Rocket className="w-8 h-8 text-indigo-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">Welcome to Your Command Center</h1>
        <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
          Your enterprise workspace is ready. Follow these steps to initialize your operations and start tracking delivery.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Step 1 */}
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] border border-[var(--border-soft)] rounded-xl p-6 relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-indigo-400" />
            </div>
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Step 1</span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Create First Project</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Initialize your first delivery container to start tracking milestones and tasks.
          </p>
          <button onClick={() => navigate('/workspace')} className="btn-premium-primary w-full py-2 rounded text-sm text-center block">
            Initialize Project
          </button>
        </div>

        {/* Step 2 */}
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] border border-[var(--border-soft)] rounded-xl p-6 relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-300" />
            </div>
            <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Step 2</span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Invite Your Team</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Bring your operators into the system to begin assigning and tracking work.
          </p>
          <button onClick={() => navigate('/resources/teams')} className="btn-premium-secondary w-full py-2 rounded text-sm text-center block">
            Manage Team
          </button>
        </div>

        {/* Step 3 */}
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] border border-[var(--border-soft)] rounded-xl p-6 relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-indigo-300" />
            </div>
            <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Step 3</span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Start Execution</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Head to the board to begin moving tasks through your customized workflow.
          </p>
          <button onClick={() => navigate('/execution/board')} className="btn-premium-secondary w-full py-2 rounded text-sm text-center block">
            Open Board
          </button>
        </div>
      </div>
    </div>
  );
}
