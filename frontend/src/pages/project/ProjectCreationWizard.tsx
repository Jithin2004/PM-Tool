import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { ResolveLayout } from '../../app/layouts/ResolveLayout';
import { Check, CalendarDays, Users } from 'lucide-react';
import { createProject } from '../../services/projectService';
import { ProjectChipsInput } from '../../components/ui/ProjectChipsInput';

export function ProjectCreationWizard() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [milestones, setMilestones] = useState<string[]>([]);
  const [team, setTeam] = useState('');
  const [policy, setPolicy] = useState('Strict');
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    setLoading(true);
    try {
      const p = await createProject({
        workspace_id: workspace!.id,
        name: name || 'New Project',
        execution_mode: 'HYBRID'
      });
      if (p) {
        window.location.href = `/projects/${p.id}/board`;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResolveLayout eyebrow="New Initiative">
      <div className="max-w-3xl mx-auto mt-12 bg-surface-3 border border-border/50 rounded-2xl p-8 shadow-sm font-geist">
        <h2 className="text-2xl font-bold mb-6 text-[var(--pm-on-surface)]">Project Assembly Wizard</h2>
        
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <label className="block text-sm font-semibold">Step 1: Project Name</label>
            <input 
              value={name} 
              onChange={e => {
                setName(e.target.value);
                setNameError('');
              }} 
              className="w-full p-3 rounded bg-surface-4 border border-border/50" 
              placeholder="e.g. ERP Migration Phase 1" 
            />
            {nameError && (
              <p className="text-sm text-red-500 mt-1">{nameError}</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <label className="block text-sm font-semibold">Step 2: Key Milestones</label>
            <ProjectChipsInput 
              value={milestones} 
              onChange={setMilestones} 
              placeholder="Discovery, Implementation, Go-Live (Press Enter to add)" 
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <label className="block text-sm font-semibold">Step 3: Initial Team Composition</label>
            <input value={team} onChange={e => setTeam(e.target.value)} className="w-full p-3 rounded bg-surface-4 border border-border/50" placeholder="Select roles (Frontend, Backend, QA)" />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <label className="block text-sm font-semibold">Step 4: Completion Policy Governance</label>
            <select value={policy} onChange={e => setPolicy(e.target.value)} className="w-full p-3 rounded bg-surface-4 border border-border/50">
              <option>Strict (Signoffs required)</option>
              <option>Controlled (Warnings on gaps)</option>
              <option>Flexible (Self-serve)</option>
            </select>
          </div>
        )}

        <div className="mt-8 flex justify-between">
          <button disabled={step === 1} onClick={() => setStep(s => s - 1)} className="px-4 py-2 rounded border border-border/50 disabled:opacity-50 cursor-pointer">Back</button>
          {step < 4 ? (
            <button 
              onClick={() => {
                if (step === 1 && !name.trim()) {
                  setNameError('Project Name is required');
                  return;
                }
                setStep(s => s + 1);
              }} 
              className="px-4 py-2 rounded bg-[var(--pm-primary)] text-[var(--pm-text)] text-[var(--text-primary)] cursor-pointer"
            >
              Next
            </button>
          ) : (
            <button onClick={handleFinish} disabled={loading} className="px-4 py-2 rounded bg-emerald-600 text-[var(--pm-text)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer disabled:opacity-50">
              {loading ? 'Initializing...' : 'Generate Project'} <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </ResolveLayout>
  );
}
