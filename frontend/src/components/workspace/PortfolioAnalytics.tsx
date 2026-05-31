import React, { useMemo, useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Users, Target, AlertTriangle, ShieldCheck, Clock, CheckCircle2, UserCheck, Settings, Plus, Tag } from 'lucide-react';

export function PortfolioAnalytics() {
  const { projects, tasks, profiles, handleUpdateProjectMetadata, notify } = useDashboard();
  const { workspace } = useWorkspace();
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [sponsorName, setSponsorName] = useState('');

  // 1. Calculate SLA stats
  const portfolioMetrics = useMemo(() => {
    const total = projects.length;
    let slaBreaches = 0;
    let sponsoredCount = 0;

    projects.forEach((p: any) => {
      // Check if predicted completion exceeds client deadline
      if (p.client_deadline && p.predicted_completion) {
        if (new Date(p.predicted_completion) > new Date(p.client_deadline)) {
          slaBreaches++;
        }
      } else if (p.delay_drift_days > 0) {
        slaBreaches++;
      }

      // Check if has a sponsor tag/owner
      if (p.owner_id || p.tags?.some((t: string) => t.startsWith('SPONSOR:'))) {
        sponsoredCount++;
      }
    });

    const slaCompliance = total > 0 ? Math.round(((total - slaBreaches) / total) * 100) : 100;
    const sponsorCoverage = total > 0 ? Math.round((sponsoredCount / total) * 100) : 100;

    return {
      slaCompliance,
      sponsorCoverage,
      totalProjects: total,
      slaBreaches
    };
  }, [projects]);

  // 2. Group projects by Portfolio Sectors (using tags or fallbacks)
  const groupedPortfolios = useMemo(() => {
    const groups: Record<string, typeof projects> = {
      'Enterprise SLA Portfolio': [],
      'Public Sector Accounts': [],
      'Internal R&D Initiatives': []
    };

    projects.forEach((proj: any) => {
      if (proj.tags?.includes('ENTERPRISE')) {
        groups['Enterprise SLA Portfolio'].push(proj);
      } else if (proj.tags?.includes('PUBLIC')) {
        groups['Public Sector Accounts'].push(proj);
      } else if (proj.tags?.includes('R&D') || proj.tags?.includes('NEW')) {
        groups['Internal R&D Initiatives'].push(proj);
      } else {
        // Fallback round-robin based on name length for mock variation
        if (proj.name.length % 3 === 0) {
          groups['Enterprise SLA Portfolio'].push(proj);
        } else if (proj.name.length % 3 === 1) {
          groups['Public Sector Accounts'].push(proj);
        } else {
          groups['Internal R&D Initiatives'].push(proj);
        }
      }
    });

    return Object.entries(groups).filter(([_, list]) => list.length > 0);
  }, [projects]);

  // 3. Sponsor alignments from profiles
  const sponsorAlignments = useMemo(() => {
    return profiles.map((prof: any) => {
      const sponsoredProjects = projects.filter((p: any) => p.owner_id === prof.id);
      return {
        profile: prof,
        name: prof.full_name || prof.email.split('@')[0],
        role: prof.role,
        projects: sponsoredProjects
      };
    });
  }, [profiles, projects]);

  const handleSaveSponsor = async (projectId: string, ownerId: string) => {
    try {
      await handleUpdateProjectMetadata(projectId, { owner_id: ownerId });
      setEditingProjectId(null);
      notify("Portfolio sponsor aligned successfully.", "success");
    } catch (err) {
      notify("Failed to update sponsor alignment.", "error");
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12 space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-3xl font-medium tracking-tight mb-1 uppercase font-sans">Portfolio Alignment Hub</h2>
        <p className="text-sm text-text-secondary font-mono tracking-tighter">Client SLA tracking, stakeholder mapping, and project sponsor assignment</p>
      </div>

      {/* Portfolio Health Summary Index */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border border-border bg-surface p-6 rounded-sm flex items-center justify-between">
          <div>
            <p className="text-[9px] font-mono uppercase text-text-tertiary tracking-wide mb-1.5">Client SLA Compliance</p>
            <p className="text-2xl font-sans tracking-tight text-emerald-400 font-bold">{portfolioMetrics.slaCompliance}%</p>
            <p className="text-[9px] font-mono text-text-quaternary mt-1">Target: &gt;90% compliance bounds</p>
          </div>
          <ShieldCheck className="w-10 h-10 text-emerald-500/20" />
        </div>

        <div className="border border-border bg-surface p-6 rounded-sm flex items-center justify-between">
          <div>
            <p className="text-[9px] font-mono uppercase text-text-tertiary tracking-wide mb-1.5">Sponsor Coverage</p>
            <p className="text-2xl font-sans tracking-tight text-indigo-400 font-bold">{portfolioMetrics.sponsorCoverage}%</p>
            <p className="text-[9px] font-mono text-text-quaternary mt-1">Aligned stakeholder sponsors</p>
          </div>
          <UserCheck className="w-10 h-10 text-indigo-500/20" />
        </div>

        <div className="border border-border bg-surface p-6 rounded-sm flex items-center justify-between">
          <div>
            <p className="text-[9px] font-mono uppercase text-text-tertiary tracking-wide mb-1.5">SLA Risks Detected</p>
            <p className="text-2xl font-sans tracking-tight text-rose-400 font-bold">{portfolioMetrics.slaBreaches} alerts</p>
            <p className="text-[9px] font-mono text-text-quaternary mt-1">Timeline variances exceeding SLAs</p>
          </div>
          <AlertTriangle className="w-10 h-10 text-rose-500/20" />
        </div>
      </div>

      {/* Portfolio sector groups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left/Middle: Client Portfolios */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border border-border bg-surface p-6">
            <h3 className="text-xs font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-6 pb-3 border-b border-border-subtle flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-400" /> Client Portfolios &amp; SLAs
            </h3>

            <div className="space-y-8">
              {groupedPortfolios.map(([sector, list]) => (
                <div key={sector} className="space-y-4">
                  <div className="flex justify-between items-center bg-[var(--pm-surface)]/5 p-2 px-3 border border-border-subtle">
                    <span className="text-[10px] font-mono uppercase text-text-secondary font-bold">{sector}</span>
                    <span className="text-[8px] font-mono text-text-tertiary">{list.length} aligned construct(s)</span>
                  </div>

                  <div className="divide-y divide-white/5 space-y-2">
                    {list.map((proj: any) => {
                      const hasBreach = proj.client_deadline && proj.predicted_completion && 
                        new Date(proj.predicted_completion) > new Date(proj.client_deadline);
                      const sponsor = profiles.find((p: any) => p.id === proj.owner_id);

                      return (
                        <div key={proj.id} className="p-4 border border-border-subtle hover:border-border transition-all space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">{proj.name}</h4>
                              <p className="text-[9px] font-mono text-text-quaternary uppercase mt-0.5">Mode: {proj.execution_mode}</p>
                            </div>

                            <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 border rounded-sm uppercase ${
                              hasBreach ? 'border-rose-500/20 bg-rose-500/10 text-rose-400' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                            }`}>
                              {hasBreach ? 'SLA Breach Risk' : 'SLA Compliant'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-[9px] font-mono text-text-tertiary">
                            <div>
                              <span className="text-text-quaternary uppercase block">Client Due Date</span>
                              <span>{proj.client_deadline ? new Date(proj.client_deadline).toLocaleDateString() : 'NO DEADLINE SET'}</span>
                            </div>
                            <div>
                              <span className="text-text-quaternary uppercase block">Forecast Completion</span>
                              <span>{proj.predicted_completion ? new Date(proj.predicted_completion).toLocaleDateString() : 'ESTIMATING...'}</span>
                            </div>
                            <div>
                              <span className="text-text-quaternary uppercase block">Aligned Sponsor</span>
                              {editingProjectId === proj.id ? (
                                <select
                                  onChange={(e) => handleSaveSponsor(proj.id, e.target.value)}
                                  defaultValue={proj.owner_id || ''}
                                  className="bg-bg border border-border text-text-primary text-[9px] p-0.5 font-mono outline-none"
                                >
                                  <option value="">No Sponsor</option>
                                  {profiles.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                                  ))}
                                </select>
                              ) : (
                                <span
                                  onClick={() => setEditingProjectId(proj.id)}
                                  className="text-indigo-400 hover:underline cursor-pointer font-semibold uppercase"
                                >
                                  {sponsor ? (sponsor.full_name || sponsor.email.split('@')[0]) : 'Align Sponsor'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side: Stakeholder Alignments */}
        <div className="space-y-6">
          <div className="border border-border bg-surface p-6">
            <h3 className="text-xs font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-6 pb-3 border-b border-border-subtle flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" /> Sponsor Directory
            </h3>

            <div className="space-y-4 max-h-[30rem] overflow-y-auto pr-1">
              {sponsorAlignments.map(align => (
                <div key={align.profile.id} className="p-3 border border-border-subtle bg-bg rounded-sm space-y-2 font-mono text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-text-primary">{align.name}</span>
                    <span className="text-[8px] bg-[var(--pm-surface)]/5 border border-border px-1 text-text-tertiary uppercase">{align.role}</span>
                  </div>

                  <div className="text-[9px] text-text-quaternary">
                    <span className="block uppercase font-bold">Sponsored Projects ({align.projects.length})</span>
                    {align.projects.length === 0 ? (
                      <span className="italic">No active sponsorships aligned.</span>
                    ) : (
                      <div className="mt-1 space-y-1 pl-2 border-l border-border">
                        {align.projects.map((p: any) => (
                          <span key={p.id} className="block text-text-secondary uppercase truncate">{p.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
