import React, { useState } from 'react';
import { CheckCircle2, Circle, Rocket, X } from 'lucide-react';
import { useOperationalData } from '../../context/OperationalDataContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { navigate } from '../../lib/navigation';


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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {checklist.map(item => (
          <div key={item.id} className={`flex flex-col gap-2 p-4 rounded-lg border transition-colors ${item.completed ? 'bg-surface-2/50 border-border-subtle opacity-70' : 'bg-surface border-border hover:border-accent-primary/50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {item.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-signal-safe shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-text-quaternary shrink-0" />
                )}
                <span className={`text-sm font-bold ${item.completed ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                  {item.label}
                </span>
              </div>
              {!item.completed && item.id === 'project' && (
                <button onClick={() => navigate('/workspace/portfolio')} className="px-3 py-1 bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 text-xs font-bold uppercase rounded transition-colors">
                  Go Create
                </button>
              )}
              {!item.completed && item.id === 'invite' && (
                <button onClick={() => navigate('/resources/teams')} className="px-3 py-1 bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 text-xs font-bold uppercase rounded transition-colors">
                  Go Invite
                </button>
              )}
              {!item.completed && item.id === 'task' && (
                <button onClick={() => navigate('/workspace/portfolio')} className="px-3 py-1 bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 text-xs font-bold uppercase rounded transition-colors">
                  Go Add
                </button>
              )}
            </div>
            {!item.completed && (
              <p className="text-xs text-text-tertiary ml-8 leading-relaxed">
                {item.id === 'workspace' && "Set up your company's isolated environment."}
                {item.id === 'project' && "A project acts as a container for milestones, tasks, and budgets. Create one to unlock timeline predictions."}
                {item.id === 'invite' && "Bring your team in to collaborate. Assign roles and manage access."}
                {item.id === 'task' && "Break down the work. Add tasks to start tracking velocity and blockers."}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
