import React from 'react';
import ExecutionBoard from '../ExecutionBoard';

interface BoardViewProps {
  projects: any[];
  profiles: any[];
  profile: any;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onRecalibrateAnalytics: () => void;
  onPromoteToAsset?: (task: { title: string; description: string; projectId: string }) => void;
}

const BoardView = React.memo(function BoardView({ projects, profiles, profile, notify, onRecalibrateAnalytics, onPromoteToAsset }: BoardViewProps) {
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