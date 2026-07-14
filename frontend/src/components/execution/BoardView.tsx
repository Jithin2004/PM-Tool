import React from 'react';
import ExecutionBoard from '../ExecutionBoard';
import { EmptyState } from '../core';
import { LayoutGrid } from 'lucide-react';

interface BoardViewProps {
  projects: any[];
  profiles: any[];
  profile: any;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onRecalibrateAnalytics: () => void;
  onPromoteToAsset?: (task: { title: string; description: string; projectId: string }) => void;
}

const BoardView = React.memo(function BoardView({ projects, profiles, profile, notify, onRecalibrateAnalytics, onPromoteToAsset }: BoardViewProps) {
  if (!projects || projects.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <EmptyState
          icon={LayoutGrid}
          title="No Active Projects"
          description="Create a project to start managing tasks in the Kanban board."
        />
      </div>
    );
  }

  return (
    <ExecutionBoard
      projects={projects}
      users={profiles}
      currentUserProfile={profile}
      notify={notify}
      onRecalibrateAnalytics={onRecalibrateAnalytics}
      onPromoteToAsset={onPromoteToAsset}
    />
  );
});

export default BoardView;
