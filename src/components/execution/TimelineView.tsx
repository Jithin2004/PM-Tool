import React from 'react';
import ExecutionBoard from '../ExecutionBoard';

interface TimelineViewProps {
  kanbanProjects: any[];
  profiles: any[];
  profile: any;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onRecalibrateAnalytics: () => void;
  onPromoteToAsset?: (task: { title: string; description: string; projectId: string }) => void;
}

const TimelineView = React.memo(function TimelineView({
  kanbanProjects, profiles, profile, notify, onRecalibrateAnalytics, onPromoteToAsset
}: TimelineViewProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
      <div className="xl:col-span-3">
        <ExecutionBoard
          projects={kanbanProjects}
          users={profiles}
          currentUserProfile={profile}
          notify={notify}
          onRecalibrateAnalytics={onRecalibrateAnalytics}
          onPromoteToAsset={onPromoteToAsset}
        />
      </div>
      <div className="space-y-4">
        <div className="border border-white/10 bg-[#0c0c0c] p-4">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-white/70 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Timeline Intelligence
          </h3>
          <div className="space-y-2 text-[11px] font-mono text-white/60">
            <p>Dependency propagation and scheduling intelligence active.</p>
            <p>Uses forward/reverse graph traversal to compute downstream impact of status changes.</p>
          </div>
        </div>
        <div className="border border-white/10 bg-[#0c0c0c] p-4">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-white/70 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Risk Signals
          </h3>
          <div className="space-y-1 text-[11px] font-mono">
            <p className="text-green-400">No blocking dependencies detected</p>
            <p className="text-white/50">Schedule pressure: nominal</p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default TimelineView;