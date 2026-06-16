import React, { useMemo, useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useDashboard } from '../../context/DashboardContext';
import { CheckCircle2, Circle, ArrowRight, Server, Shield, Users, Building2, HardDrive, KanbanSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function WelcomeCenter() {
  const { workspace } = useWorkspace();
  const { teams, projects } = useDashboard();
  const [hasBackup, setHasBackup] = useState(false);
  const [hasLicense, setHasLicense] = useState(false);

  useEffect(() => {
    if (!workspace?.id) return;

    let active = true;

    async function loadChecklistData() {
      try {
        // Query license from database
        const { data: license, error: licenseErr } = await supabase
          .from('workspace_license')
          .select('workspace_id, activation_date')
          .limit(1)
          .maybeSingle();

        if (active && !licenseErr && license) {
          if (license.workspace_id && license.activation_date) {
            setHasLicense(true);
          } else {
            setHasLicense(false);
          }
        }

        // Query backup history from activity logs
        const { data: backup, error: backupErr } = await supabase
          .from('activity_logs')
          .select('id')
          .eq('workspace_id', workspace.id)
          .eq('action', 'workspace_exported')
          .limit(1);

        if (active && !backupErr && backup && backup.length > 0) {
          setHasBackup(true);
        } else {
          setHasBackup(false);
        }
      } catch (err) {
        console.error('WelcomeCenter: loadChecklistData failed:', err);
      }
    }

    loadChecklistData();
    return () => {
      active = false;
    };
  }, [workspace?.id]);

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('popstate'));
  };

  const handleSetupAction = (actionType: string) => {
    if (actionType === 'company') {
      navigateTo('/control?tab=profile');
    } else if (actionType === 'license') {
      navigateTo('/control?tab=license');
    } else if (actionType === 'backup') {
      navigateTo('/control?tab=backup');
    } else if (actionType === 'teams') {
      navigateTo('/resources/teams');
      setTimeout(() => {
        if ((window as any).openTeamRosterModal) (window as any).openTeamRosterModal();
      }, 100);
    } else if (actionType === 'projects') {
      navigateTo('/workspace');
      setTimeout(() => {
        if ((window as any).openCreateProjectModal) (window as any).openCreateProjectModal();
      }, 100);
    }
  };

  const setupMetrics = useMemo(() => {
    const hasCompany = !!workspace?.name && workspace.name !== 'Default Workspace';
    const hasTeams = teams && teams.filter(t => t.name !== 'SYSTEM_SETTINGS').length > 0;
    const hasProjects = projects && projects.length > 0;

    const checks = [
      { id: 'company', label: 'Company Profile', icon: <Building2 className="w-5 h-5" />, done: hasCompany, action: () => handleSetupAction('company') },
      { id: 'license', label: 'Enterprise License Verification', icon: <Shield className="w-5 h-5" />, done: hasLicense, action: () => handleSetupAction('license') },
      { id: 'teams', label: 'First Team Created', icon: <Users className="w-5 h-5" />, done: hasTeams, action: () => handleSetupAction('teams') },
      { id: 'projects', label: 'First Project Launched', icon: <KanbanSquare className="w-5 h-5" />, done: hasProjects, action: () => handleSetupAction('projects') },
      { id: 'backup', label: 'Disaster Recovery Setup', icon: <HardDrive className="w-5 h-5" />, done: hasBackup, action: () => handleSetupAction('backup') },
    ];

    const completed = checks.filter(c => c.done).length;
    const score = Math.round((completed / checks.length) * 100);
    const nextAction = checks.find(c => !c.done);

    return { checks, completed, total: checks.length, score, nextAction };
  }, [workspace, teams, projects, hasLicense, hasBackup]);

  if (setupMetrics.score === 100) return null;

  return (
    <div className="bg-[var(--pm-surface)] rounded-2xl border border-[var(--pm-border)] shadow-sm overflow-hidden mb-8">
      <div className="p-6 md:p-8 bg-gradient-to-r from-indigo-500/10 to-transparent border-b border-[var(--pm-border)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                <Server className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--pm-text)]">System Initialization</h2>
            </div>
            <p className="text-[var(--pm-text-secondary)] max-w-xl">
              Welcome to Resolve PM Enterprise. Your dedicated instance is active, but we need to configure a few operational baselines before you open the doors to your company.
            </p>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-4xl font-bold text-[var(--pm-text)] mb-1">{setupMetrics.score}%</div>
            <div className="text-sm font-mono-pm text-[var(--pm-text-secondary)] uppercase tracking-wider">Initialization Score</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--pm-border)]">
        <div className="bg-[var(--pm-surface)] p-6 md:p-8">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--pm-text-secondary)] mb-6 font-mono-pm">Setup Checklist</h3>
          <div className="space-y-4">
            {setupMetrics.checks.map(check => (
              <div key={check.id} className="flex items-center gap-4 group">
                <div className={`p-2 rounded-lg flex-shrink-0 transition-colors ${check.done ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--pm-surface-elevated)] text-[var(--pm-text-tertiary)] group-hover:text-[var(--pm-text)] group-hover:bg-[var(--pm-surface-hover)]'}`}>
                  {check.icon}
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-medium ${check.done ? 'text-[var(--pm-text)]' : 'text-[var(--pm-text-secondary)]'}`}>
                    {check.label}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {check.done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <button 
                      onClick={check.action}
                      className="flex items-center gap-1 text-[11px] font-mono-pm uppercase tracking-wider text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Resolve <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--pm-surface)] p-6 md:p-8 flex flex-col justify-center">
          {setupMetrics.nextAction ? (
            <div className="bg-[var(--pm-surface-high)] rounded-xl border border-indigo-500/30 p-6 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
              <div className="text-xs font-mono-pm text-indigo-400 uppercase tracking-widest mb-2">Recommended Next Action</div>
              <h3 className="text-xl font-bold text-[var(--pm-text)] mb-3">{setupMetrics.nextAction.label}</h3>
              <p className="text-sm text-[var(--pm-text-secondary)] mb-6">
                Complete this critical step to increase your system readiness score and ensure your environment is configured correctly.
              </p>
              <button 
                onClick={setupMetrics.nextAction.action}
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto"
              >
                Configure Now
              </button>
            </div>
          ) : (
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-[var(--pm-text)] mb-2">System Ready</h3>
              <p className="text-[var(--pm-text-secondary)]">All baseline configurations are complete. You may safely dismiss this welcome center.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
