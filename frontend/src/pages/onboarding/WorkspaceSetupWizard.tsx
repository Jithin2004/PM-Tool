import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { ResolveLayout } from '../../app/layouts/ResolveLayout';
import { Check, Layers, Users, Zap, Briefcase, Plus } from 'lucide-react';
import { demoWorkspacesService } from '../../services/demoWorkspacesService';
import { clearLicense } from '../../lib/productKey';

export function WorkspaceSetupWizard() {
  const { createWorkspace, error } = useWorkspace();
  const { refreshProfile, profile } = useAuth();
  
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [members, setMembers] = useState('');
  const [projects, setProjects] = useState('');
  const [delivery, setDelivery] = useState('Agile');
  const [policy, setPolicy] = useState('Flexible');
  const [capacity, setCapacity] = useState('Yes');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const handleFinish = async () => {
    setLoading(true);
    try {
      const created = await createWorkspace({
        name: name || 'My Workspace',
        settings: { 
          companyName: name || 'My Workspace',
          deliveryMethod: delivery,
          completionPolicy: policy,
          capacityEnabled: capacity === 'Yes'
        } as any
      });
      if (created) {
        clearLicense();
        await refreshProfile();
        window.location.href = '/overview';
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async (type: string) => {
    setDemoLoading(true);
    try {
      const ws = await createWorkspace({
        name: type,
        settings: { companyName: type } as any
      });
      if (ws) {
        await demoWorkspacesService.injectDemoData(ws.id, profile!.id, type);
        clearLicense();
        await refreshProfile();
        window.location.href = '/overview';
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <ResolveLayout eyebrow="Onboarding">
      <div className="grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto">
        <section className="bg-surface-3 border border-border/50 rounded-2xl p-8 shadow-sm font-geist">
          <h2 className="text-2xl font-bold mb-6 text-[var(--pm-on-surface)]">Guided Setup</h2>
          
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <label className="block text-sm font-semibold">Step 1: Workspace Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full p-3 rounded bg-surface-4 border border-border/50" placeholder="e.g. Acme Corp" />
            </div>
          )}
          
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <label className="block text-sm font-semibold">Step 2: Team Members</label>
              <input value={members} onChange={e => setMembers(e.target.value)} className="w-full p-3 rounded bg-surface-4 border border-border/50" placeholder="Emails, comma separated" />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <label className="block text-sm font-semibold">Step 3: Initial Projects</label>
              <input value={projects} onChange={e => setProjects(e.target.value)} className="w-full p-3 rounded bg-surface-4 border border-border/50" placeholder="Project names, comma separated" />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <label className="block text-sm font-semibold">Step 4: Delivery Method</label>
              <select value={delivery} onChange={e => setDelivery(e.target.value)} className="w-full p-3 rounded bg-surface-4 border border-border/50 text-white">
                <option className="bg-slate-900 text-white" value="Agile">Agile</option>
                <option className="bg-slate-900 text-white" value="Waterfall">Waterfall</option>
                <option className="bg-slate-900 text-white" value="Hybrid">Hybrid</option>
              </select>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <label className="block text-sm font-semibold">Step 5: Completion Policy</label>
              <select value={policy} onChange={e => setPolicy(e.target.value)} className="w-full p-3 rounded bg-surface-4 border border-border/50 text-white">
                <option className="bg-slate-900 text-white" value="Flexible">Flexible</option>
                <option className="bg-slate-900 text-white" value="Controlled">Controlled</option>
                <option className="bg-slate-900 text-white" value="Strict">Strict</option>
                <option className="bg-slate-900 text-white" value="Enterprise">Enterprise</option>
              </select>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <label className="block text-sm font-semibold">Step 6: Capacity Planning</label>
              <select value={capacity} onChange={e => setCapacity(e.target.value)} className="w-full p-3 rounded bg-surface-4 border border-border/50 text-white">
                <option className="bg-slate-900 text-white" value="Yes">Yes</option>
                <option className="bg-slate-900 text-white" value="No">No</option>
              </select>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button disabled={step === 1} onClick={() => setStep(s => s - 1)} className="px-4 py-2 rounded border border-border/50 disabled:opacity-50">Back</button>
            {step < 6 ? (
              <button onClick={() => setStep(s => s + 1)} className="px-4 py-2 rounded bg-[var(--pm-primary)] text-white">Next</button>
            ) : (
              <button onClick={handleFinish} disabled={loading} className="px-4 py-2 rounded bg-emerald-600 text-white flex items-center gap-2">
                {loading ? 'Building...' : 'Finish Setup'} <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </section>

        <aside className="bg-surface-3 border border-border/50 rounded-2xl p-8 shadow-sm font-geist h-fit space-y-6">
          <h3 className="font-semibold text-[var(--pm-on-surface)] flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400"/> Instant Demo Workspaces</h3>
          <p className="text-xs text-[var(--pm-on-surface-variant)]">Bypass manual configuration and instantiate a fully-loaded enterprise simulator.</p>
          
          <div className="space-y-3">
            {['ERP Implementation', 'Software Product Launch', 'Government Digital Transformation', 'Internal Operations Program', 'Client Delivery Agency'].map(type => (
              <button key={type} onClick={() => handleDemo(type)} disabled={demoLoading} className="w-full p-4 border border-border/50 rounded-xl hover:border-[var(--pm-primary)] text-left flex items-center justify-between group transition-colors">
                <div className="flex items-center gap-3">
                  <Briefcase className="w-5 h-5 text-[var(--pm-primary)]" />
                  <span className="text-sm font-medium">{type}</span>
                </div>
                <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 text-[var(--pm-primary)]" />
              </button>
            ))}
          </div>
          {demoLoading && <p className="text-xs text-emerald-400 animate-pulse text-center">Injecting demo topology...</p>}
        </aside>
      </div>
    </ResolveLayout>
  );
}
