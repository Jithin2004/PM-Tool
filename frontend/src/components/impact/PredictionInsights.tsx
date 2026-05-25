import React, { useEffect, useState } from 'react';
import { BrainCircuit, TrendingUp, TrendingDown, Activity, BarChart3, User, Code2, Layout, Settings, Building2, Users, Clock, AlertTriangle } from 'lucide-react';
import { confidenceCalibrationService, type CalibrationMetrics } from '../../services/confidenceCalibrationService';
import { contextPredictionService, CONTEXT_TYPES, type ContextAccuracy, type ContextType } from '../../services/contextPredictionService';
import { teamOutput, effectivenessMultiplier, getDefaultProfile } from '../../services/resourceProfileService';
import type { SkillLevel } from '../../types';

interface Props {
  workspaceId: string;
}

const contextIcons: Record<ContextType, React.ReactNode> = {
  assignee: <User className="w-3 h-3" />,
  task_category: <Code2 className="w-3 h-3" />,
  project_type: <Layout className="w-3 h-3" />,
  execution_mode: <Settings className="w-3 h-3" />,
  industry: <Building2 className="w-3 h-3" />
};

const contextLabels: Record<ContextType, string> = {
  assignee: 'Developer',
  task_category: 'Category',
  project_type: 'Project Type',
  execution_mode: 'Execution Mode',
  industry: 'Industry'
};

function BucketBar({ metrics }: { metrics: CalibrationMetrics }) {
  const barColor = metrics.accuracyRate >= 80 ? 'bg-emerald-500'
    : metrics.accuracyRate >= 60 ? 'bg-amber-500'
    : 'bg-rose-500';
  return (
    <div className="flex items-center gap-3 text-[11px] font-mono">
      <span className="w-14 text-text-tertiary shrink-0">{metrics.bucket}</span>
      <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${metrics.accuracyRate}%` }} />
      </div>
      <span className="w-10 text-right text-text-secondary">{metrics.accuracyRate}%</span>
      <span className="w-16 text-right text-text-quaternary">n={metrics.sampleCount}</span>
    </div>
  );
}

function ContextCard({ title, icon, contexts, highlight }: { title: string; icon: React.ReactNode; contexts: ContextAccuracy[]; highlight: 'best' | 'worst' }) {
  const sorted = [...contexts].sort((a, b) =>
    highlight === 'best' ? b.historical_accuracy - a.historical_accuracy : a.historical_accuracy - b.historical_accuracy
  ).slice(0, 5).filter(c => c.sample_size >= 2);

  if (sorted.length === 0) return null;

  return (
    <div className="bg-white/5 rounded-lg p-3 border border-border-subtle">
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-quaternary uppercase mb-2">
        {icon}
        {title}
      </div>
      <div className="space-y-1">
        {sorted.map(c => (
          <div key={c.context_value} className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-text-secondary truncate max-w-[120px]">{c.context_value}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className={c.historical_accuracy >= 80 ? 'text-emerald-400' : c.historical_accuracy >= 60 ? 'text-signal-warning' : 'text-rose-400'}>
                {c.historical_accuracy}%
              </span>
              <span className="text-text-quaternary w-8 text-right">n={c.sample_size}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PredictionInsights({ workspaceId }: Props) {
  const [metrics, setMetrics] = useState<CalibrationMetrics[]>([]);
  const [contextMetrics, setContextMetrics] = useState<ContextAccuracy[]>([]);

  useEffect(() => {
    confidenceCalibrationService.computeCalibration(workspaceId).then(setMetrics);
    contextPredictionService.computeContextAccuracy(workspaceId).then(setContextMetrics);
  }, [workspaceId]);

  if (metrics.length === 0 && contextMetrics.length === 0) return null;

  const totalSamples = metrics.reduce((s, m) => s + m.sampleCount, 0);
  const overallAccurate = metrics.reduce((s, m) => s + Math.round(m.accuracyRate * m.sampleCount / 100), 0);
  const overallAccuracy = totalSamples > 0 ? Math.round(overallAccurate / totalSamples * 100) : 0;
  const overRate = metrics.reduce((s, m) => s + m.overconfidenceRate * m.sampleCount, 0) / Math.max(1, totalSamples);
  const underRate = metrics.reduce((s, m) => s + m.underconfidenceRate * m.sampleCount, 0) / Math.max(1, totalSamples);

  return (
    <div className="bg-[#0c0d14]/80 border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <BrainCircuit className="w-4 h-4 text-cyan-400" />
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-text-secondary">Prediction Insights</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/5 rounded-lg p-3 border border-border-subtle">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-quaternary uppercase mb-1">
            <Activity className="w-3 h-3" />
            Historical Accuracy
          </div>
          <div className={`text-lg font-bold ${overallAccuracy >= 80 ? 'text-emerald-400' : overallAccuracy >= 60 ? 'text-signal-warning' : 'text-rose-400'}`}>
            {overallAccuracy}%
          </div>
          <div className="text-[9px] font-mono text-text-quaternary mt-0.5">{totalSamples} predictions tracked</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3 border border-border-subtle">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-quaternary uppercase mb-1">
            <BarChart3 className="w-3 h-3" />
            Calibration Trend
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            <div className="flex items-center gap-1.5 text-[10px]">
              <TrendingUp className="w-3 h-3 text-rose-400" />
              <span className="text-text-secondary">{Math.round(overRate)}% overconfident</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <TrendingDown className="w-3 h-3 text-emerald-400" />
              <span className="text-text-secondary">{Math.round(underRate)}% underconfident</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        <div className="text-[10px] font-mono text-text-quaternary uppercase mb-2">Accuracy by Confidence Bucket</div>
        {metrics.map(m => <BucketBar key={m.bucket} metrics={m} />)}
      </div>

      {contextMetrics.length > 0 && (
        <div className="space-y-3">
          <div className="text-[10px] font-mono text-cyan-400/60 uppercase tracking-wider mb-2">Context Intelligence</div>

          <div className="grid grid-cols-2 gap-2">
            <ContextCard
              title="Top Performing"
              icon={<TrendingUp className="w-3 h-3 text-emerald-400" />}
              contexts={contextMetrics}
              highlight="best"
            />
            <ContextCard
              title="Needs Improvement"
              icon={<TrendingDown className="w-3 h-3 text-rose-400" />}
              contexts={contextMetrics}
              highlight="worst"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {CONTEXT_TYPES.map(ct => {
              const filtered = contextMetrics.filter(c => c.context_type === ct && c.sample_size >= 2);
              if (filtered.length === 0) return null;
              return (
                <ContextCard
                  key={ct}
                  title={contextLabels[ct]}
                  icon={contextIcons[ct]}
                  contexts={filtered}
                  highlight="best"
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border-subtle space-y-3">
        <div className="text-[10px] font-mono text-cyan-400/60 uppercase tracking-wider mb-2">Resource Profile Intelligence</div>
        <div className="grid grid-cols-2 gap-2">
          {(['intern', 'junior', 'mid', 'senior', 'lead'] as SkillLevel[]).map(level => {
            const profile = getDefaultProfile(level);
            const eff = effectivenessMultiplier(profile);
            return (
              <div key={level} className="bg-white/5 rounded-lg p-3 border border-border-subtle">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-quaternary uppercase mb-1">
                  <User className="w-3 h-3" />
                  {level}
                </div>
                <div className="text-sm font-mono font-bold text-text-secondary">{eff.toFixed(2)}x</div>
                <div className="text-[8px] font-mono text-text-quaternary mt-0.5">{profile.experience_years}y exp</div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 5, 8].map(n => {
            const output = teamOutput(n, [getDefaultProfile('mid')]);
            const linearExpectation = n * effectivenessMultiplier(getDefaultProfile('mid'));
            const loss = linearExpectation - output;
            return (
              <div key={n} className="bg-white/5 rounded-lg p-3 border border-border-subtle">
                <div className="text-[10px] font-mono text-text-quaternary">{n} engineers</div>
                <div className="text-xs font-mono font-bold text-text-secondary">{output.toFixed(2)}x</div>
                <div className="text-[8px] font-mono text-rose-400/60">-{loss.toFixed(2)}x coordination loss</div>
              </div>
            );
          })}
        </div>

        {contextMetrics.filter(c => c.context_type === 'assignee' && c.sample_size >= 3).length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-text-quaternary uppercase mb-1">Assignee Performance</div>
            <div className="grid grid-cols-2 gap-2">
              {(['best', 'worst'] as const).map(h => {
                const sorted = contextMetrics
                  .filter(c => c.context_type === 'assignee' && c.sample_size >= 3)
                  .sort((a, b) => h === 'best' ? b.historical_accuracy - a.historical_accuracy : a.historical_accuracy - b.historical_accuracy)
                  .slice(0, 3);
                return (
                  <div key={h} className="bg-white/5 rounded-lg p-3 border border-border-subtle">
                    <div className="flex items-center gap-1 text-[10px] font-mono text-text-quaternary uppercase mb-1">
                      {h === 'best' ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-rose-400" />}
                      {h === 'best' ? 'Top' : 'Lowest'}
                    </div>
                    {sorted.map(c => (
                      <div key={c.context_value} className="flex items-center justify-between text-[9px] font-mono">
                        <span className="text-text-secondary truncate max-w-[80px]">{c.context_value.slice(0, 8)}</span>
                        <span className={c.historical_accuracy >= 80 ? 'text-emerald-400' : c.historical_accuracy >= 60 ? 'text-signal-warning' : 'text-rose-400'}>
                          {c.historical_accuracy}%
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
