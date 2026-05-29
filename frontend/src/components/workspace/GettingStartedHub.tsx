import React, { useState } from 'react';
import { CheckCircle2, Circle, Rocket, X } from 'lucide-react';
import { useOperationalData } from '../../context/OperationalDataContext';
import { useWorkspace } from '../../context/WorkspaceContext';

export function GettingStartedHub() {
  const [dismissed, setDismissed] = useState(false);
  const { workspace } = useWorkspace();
  const { raw: { projects, tasks, profiles } } = useOperationalData();

  const checklist = [
    { id: 'workspace', label: 'Create Workspace', completed: !!workspace },
    { id: 'project', label: 'Create Project', completed: projects.length > 0 },
    { id: 'invite', label: 'Invite Team', completed: profiles.length > 1 },
    { id: 'task', label: 'Create Task', completed: tasks.length > 0 },
  ];

  const completedCount = checklist.filter(c => c.completed).length;
  const progress = Math.round((completedCount / checklist.length) * 100);

  if (dismissed || progress === 100) return null;

  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-8 relative shadow-sm">
      <button 
        onClick={() => setDismissed(true)} 
        className="absolute top-4 right-4 p-1 rounded-md hover:bg-surface-2 text-text-quaternary hover:text-text-secondary transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-center gap-3 mb-4 border-b border-border-subtle pb-3">
        <Rocket className="w-5 h-5 text-accent-primary" />
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Quick Start Center</h3>
      </div>
      
      <div className="flex items-center gap-4 mb-5">
        <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
          <div className="h-full bg-accent-primary transition-all duration-1000" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs font-bold text-text-secondary w-10 text-right">{progress}%</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {checklist.map(item => (
          <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${item.completed ? 'bg-surface-2/50 border-border-subtle' : 'bg-surface border-border'}`}>
            {item.completed ? (
              <CheckCircle2 className="w-4 h-4 text-signal-safe shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-text-quaternary shrink-0" />
            )}
            <span className={`text-xs font-medium ${item.completed ? 'text-text-tertiary line-through' : 'text-text-secondary'}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
