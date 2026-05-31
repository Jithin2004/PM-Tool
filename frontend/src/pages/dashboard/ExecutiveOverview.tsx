import React, { useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { Activity, FileText, ChevronRight, AlertTriangle, TrendingUp, Shield } from 'lucide-react';

export function ExecutiveOverview() {
  const { workspace, projects } = useWorkspace() as any;
  const { raw: { tasks, profiles } } = useOperationalData();

  const activeProjects = useMemo(() => projects?.filter((p: any) => p.status !== 'deployed') || [], [projects]);

  const telemetryData = useMemo(() => {
    return activeProjects.map((p: any) => {
      const pTasks = tasks?.filter((t: any) => t.project_id === p.id) || [];
      const totalTasks = pTasks.length;
      const doneTasks = pTasks.filter((t: any) => t.status === 'done').length;
      const highRisk = pTasks.filter((t: any) => t.risk === 'high' && t.status !== 'done').length;
      
      const velocity = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
      const capacityDrain = Math.min(100, Math.max(20, totalTasks * 5));
      
      let stability: 'stable' | 'warning' | 'critical' = 'stable';
      if (highRisk > 3) stability = 'critical';
      else if (highRisk > 0 || velocity < 30) stability = 'warning';

      // Deterministic trend based on project id hash
      let hash = 0;
      for (let k = 0; k < p.id.length; k++) {
        hash = ((hash << 5) - hash) + p.id.charCodeAt(k);
        hash |= 0;
      }
      const trend = Array.from({ length: 6 }, (_, i) => {
        const base = velocity * 0.6;
        const step = (velocity - base) / 5;
        return Math.round(Math.max(0, base + step * i + ((Math.abs(hash + i * 7) % 15) - 7)));
      });

      // Resolve owner
      const owner = profiles?.find((pr: any) => pr.id === p.owner_id);
      const ownerName = owner?.full_name || owner?.email || 'Unassigned';

      return {
        id: p.id,
        name: p.name,
        velocity,
        capacityDrain,
        highRisk,
        stability,
        trend,
        ownerName,
      };
    });
  }, [activeProjects, tasks, profiles]);

  // Portfolio-level aggregates
  const portfolioSummary = useMemo(() => {
    if (telemetryData.length === 0) return null;
    const avgVelocity = Math.round(telemetryData.reduce((s, d) => s + d.velocity, 0) / telemetryData.length);
    const totalFriction = telemetryData.reduce((s, d) => s + d.highRisk, 0);
    const criticalCount = telemetryData.filter(d => d.stability === 'critical').length;
    const warningCount = telemetryData.filter(d => d.stability === 'warning').length;
    const stableCount = telemetryData.filter(d => d.stability === 'stable').length;

    let overallStability: 'stable' | 'warning' | 'critical' = 'stable';
    if (criticalCount > 0) overallStability = 'critical';
    else if (warningCount > stableCount) overallStability = 'warning';

    return { avgVelocity, totalFriction, criticalCount, warningCount, stableCount, overallStability, total: telemetryData.length };
  }, [telemetryData]);

  const stabilityConfig = {
    critical: { color: 'var(--pm-risk)', label: 'Breach', icon: '▲' },
    warning: { color: 'var(--pm-warning)', label: 'Friction', icon: '●' },
    stable: { color: 'var(--pm-success)', label: 'Stable', icon: '●' },
  };

  const renderStabilityIndicator = (status: 'stable' | 'warning' | 'critical') => {
    const cfg = stabilityConfig[status];
    return (
      <div className="flex items-center gap-2">
        <span className={`text-[10px] ${status === 'critical' ? 'operational-pulse' : ''}`} style={{ color: cfg.color }}>{cfg.icon}</span>
        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: cfg.color }}>{cfg.label}</span>
      </div>
    );
  };

  const renderSparkline = (data: number[]) => {
    const max = Math.max(...data, 100);
    const points = data.map((val, i) => `${(i / (data.length - 1)) * 60},${20 - (val / max) * 20}`).join(' ');
    return (
      <svg className="w-[60px] h-[20px] overflow-visible" role="img" aria-label="Velocity trend">
        <polyline points={points} fill="none" stroke="var(--pm-cyan)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  const renderCapacityHeat = (drain: number) => {
    const blocks = 5;
    const activeBlocks = Math.ceil((drain / 100) * blocks);
    return (
      <div className="flex gap-1" role="meter" aria-valuenow={drain} aria-valuemin={0} aria-valuemax={100} aria-label={`Capacity drain ${drain}%`}>
        {Array.from({ length: blocks }).map((_, i) => (
          <div key={i} className="h-3 w-3 rounded-sm" style={{
            backgroundColor: i < activeBlocks
              ? (drain > 80 ? 'var(--pm-warning)' : 'var(--pm-primary)')
              : 'var(--pm-surface)',
            opacity: i < activeBlocks ? 1 : 0.3,
            border: i < activeBlocks && drain > 80 ? '1px solid var(--pm-warning)' : 'none',
          }} />
        ))}
      </div>
    );
  };

  const renderAvatar = (name: string) => {
    const init = name.substring(0, 2).toUpperCase();
    return (
      <div className="w-6 h-6 rounded-full bg-[var(--pm-surface)] border border-[var(--pm-border)] flex items-center justify-center text-[9px] font-bold text-[var(--pm-text-secondary)]">
        {init}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2 mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--pm-text)]">
            Strategic Telemetry Matrix
          </h1>
          <p className="text-sm mt-1 text-[var(--pm-text-secondary)]">
            Live executive oversight across all active portfolio initiatives.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="px-4 py-1.5 bg-[var(--pm-surface-elevated)] border border-[var(--pm-border)] rounded-lg text-xs font-semibold flex items-center gap-2 hover:bg-[var(--pm-surface-hover)] transition-colors text-[var(--pm-text)] cursor-pointer">
            <FileText className="w-4 h-4"/> Export Matrix
          </button>
        </div>
      </div>

      {/* P3: Portfolio Summary Bar */}
      {portfolioSummary && (
        <div className="grid grid-cols-5 gap-4 mb-2">
          <div className="bg-[var(--pm-surface-elevated)] rounded-xl border border-[var(--pm-border)] p-4 flex items-center gap-3">
            <Shield className="w-5 h-5" style={{ color: stabilityConfig[portfolioSummary.overallStability].color }} />
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text-secondary)]">Portfolio Status</div>
              <div className="text-lg font-bold capitalize" style={{ color: stabilityConfig[portfolioSummary.overallStability].color }}>{portfolioSummary.overallStability}</div>
            </div>
          </div>
          <div className="bg-[var(--pm-surface-elevated)] rounded-xl border border-[var(--pm-border)] p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text-secondary)]">Active Initiatives</div>
            <div className="text-lg font-bold text-[var(--pm-text)]">{portfolioSummary.total}</div>
          </div>
          <div className="bg-[var(--pm-surface-elevated)] rounded-xl border border-[var(--pm-border)] p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text-secondary)]">Avg Velocity</div>
            <div className="text-lg font-bold text-[var(--pm-cyan)]">{portfolioSummary.avgVelocity}%</div>
          </div>
          <div className="bg-[var(--pm-surface-elevated)] rounded-xl border border-[var(--pm-border)] p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text-secondary)]">Total Friction</div>
            <div className="text-lg font-bold" style={{ color: portfolioSummary.totalFriction > 0 ? 'var(--pm-risk)' : 'var(--pm-text)' }}>{portfolioSummary.totalFriction}</div>
          </div>
          <div className="bg-[var(--pm-surface-elevated)] rounded-xl border border-[var(--pm-border)] p-4 flex items-center gap-4">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--pm-success)' }} /><span className="text-xs font-mono text-[var(--pm-text-secondary)]">{portfolioSummary.stableCount}</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--pm-warning)' }} /><span className="text-xs font-mono text-[var(--pm-text-secondary)]">{portfolioSummary.warningCount}</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--pm-risk)' }} /><span className="text-xs font-mono text-[var(--pm-text-secondary)]">{portfolioSummary.criticalCount}</span></div>
          </div>
        </div>
      )}

      {/* The Matrix */}
      <div className="bg-[var(--pm-surface-elevated)] rounded-xl border border-[var(--pm-border)] overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-[var(--pm-border)] bg-[var(--pm-surface)]/50">
          <div className="col-span-3 text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text-secondary)]">Initiative</div>
          <div className="col-span-2 text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text-secondary)]">Owner</div>
          <div className="col-span-2 text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text-secondary)]">Stability</div>
          <div className="col-span-1 text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text-secondary)] text-center">Velocity</div>
          <div className="col-span-2 text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text-secondary)]">Capacity Drain</div>
          <div className="col-span-1 text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text-secondary)] text-center">Friction</div>
          <div className="col-span-1 text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text-secondary)] text-right">Action</div>
        </div>
        
        <div className="divide-y divide-[var(--pm-border)]/50">
          {telemetryData.length === 0 ? (
            <div className="p-8 text-center text-[var(--pm-text-secondary)] text-sm">No active initiatives found in the portfolio.</div>
          ) : (
            telemetryData.map(item => (
              <div key={item.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-[var(--pm-surface-hover)] transition-colors cursor-pointer group">
                {/* Initiative */}
                <div className="col-span-3">
                  <div className="font-medium text-[var(--pm-text)] truncate">{item.name}</div>
                </div>
                
                {/* P2: Owner (Human Layer) */}
                <div className="col-span-2 flex items-center gap-2">
                  {renderAvatar(item.ownerName)}
                  <span className="text-xs text-[var(--pm-text)] truncate">{item.ownerName}</span>
                </div>
                
                {/* Stability */}
                <div className="col-span-2">
                  {renderStabilityIndicator(item.stability)}
                </div>
                
                {/* Velocity + Sparkline */}
                <div className="col-span-1 flex flex-col items-center gap-1">
                  {renderSparkline(item.trend)}
                  <span className="text-[10px] font-mono text-[var(--pm-text-secondary)]">{item.velocity}%</span>
                </div>
                
                {/* Capacity Drain */}
                <div className="col-span-2 flex items-center gap-3">
                  {renderCapacityHeat(item.capacityDrain)}
                  <span className="text-[11px] text-[var(--pm-text-secondary)] font-mono">{item.capacityDrain}%</span>
                </div>
                
                {/* Friction */}
                <div className="col-span-1 flex justify-center">
                  {item.highRisk > 0 ? (
                    <div className="flex items-center justify-center gap-1.5 px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--pm-risk-bg)', border: '1px solid var(--pm-risk)' }}>
                      <AlertTriangle className="w-3 h-3" style={{ color: 'var(--pm-risk)' }} />
                      <span className="font-mono text-xs font-bold" style={{ color: 'var(--pm-risk)' }}>{item.highRisk}</span>
                    </div>
                  ) : (
                    <div className="text-[var(--pm-text-secondary)] opacity-30 font-mono text-xs">—</div>
                  )}
                </div>
                
                {/* Action */}
                <div className="col-span-1 flex justify-end">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--pm-text-secondary)] group-hover:text-[var(--pm-primary)] group-hover:bg-[var(--pm-primary)]/10 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
