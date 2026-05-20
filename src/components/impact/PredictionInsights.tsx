import React, { useEffect, useState } from 'react';
import { BrainCircuit, TrendingUp, TrendingDown, Activity, BarChart3, User, Code2, Layout, Settings, Building2 } from 'lucide-react';
import { confidenceCalibrationService, type CalibrationMetrics } from '../../services/confidenceCalibrationService';
import { contextPredictionService, CONTEXT_TYPES, type ContextAccuracy, type ContextType } from '../../services/contextPredictionService';

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
      <span className="w-14 text-white/60 shrink-0">{metrics.bucket}</span>
      <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${metrics.accuracyRate}%` }} />
      </div>
      <span className="w-10 text-right text-white/80">{metrics.accuracyRate}%</span>
      <span className="w-16 text-right text-white/40">n={metrics.sampleCount}</span>
    </div>
  );
}

function ContextCard({ title, icon, contexts, highlight }: { title: string; icon: React.ReactNode; contexts: ContextAccuracy[]; highlight: 'best' | 'worst' }) {
  const sorted = [...contexts].sort((a, b) =>
    highlight === 'best' ? b.historical_accuracy - a.historical_accuracy : a.historical_accuracy - b.historical_accuracy
  ).slice(0, 5).filter(c => c.sample_size >= 2);

  if (sorted.length === 0) return null;

  return (
    <div className="bg-white/5 rounded-lg p-3 border border-white/5">
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/40 uppercase mb-2">
        {icon}
        {title}
      </div>
      <div className="space-y-1">
        {sorted.map(c => (
          <div key={c.context_value} className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-white/70 truncate max-w-[120px]">{c.context_value}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className={c.historical_accuracy >= 80 ? 'text-emerald-400' : c.historical_accuracy >= 60 ? 'text-amber-400' : 'text-rose-400'}>
                {c.historical_accuracy}%
              </span>
              <span className="text-white/30 w-8 text-right">n={c.sample_size}</span>
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
    <div className="bg-[#0c0d14]/80 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <BrainCircuit className="w-4 h-4 text-cyan-400" />
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-white/80">Prediction Insights</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/5 rounded-lg p-3 border border-white/5">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/40 uppercase mb-1">
            <Activity className="w-3 h-3" />
            Historical Accuracy
          </div>
          <div className={`text-lg font-bold ${overallAccuracy >= 80 ? 'text-emerald-400' : overallAccuracy >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
            {overallAccuracy}%
          </div>
          <div className="text-[9px] font-mono text-white/30 mt-0.5">{totalSamples} predictions tracked</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3 border border-white/5">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/40 uppercase mb-1">
            <BarChart3 className="w-3 h-3" />
            Calibration Trend
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            <div className="flex items-center gap-1.5 text-[10px]">
              <TrendingUp className="w-3 h-3 text-rose-400" />
              <span className="text-white/70">{Math.round(overRate)}% overconfident</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <TrendingDown className="w-3 h-3 text-emerald-400" />
              <span className="text-white/70">{Math.round(underRate)}% underconfident</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        <div className="text-[10px] font-mono text-white/30 uppercase mb-2">Accuracy by Confidence Bucket</div>
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
    </div>
  );
}
