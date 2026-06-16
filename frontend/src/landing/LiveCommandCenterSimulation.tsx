import React, { useState, useEffect } from 'react';
import { Terminal, ShieldAlert, CheckCircle2, TrendingUp, Cpu, Database, Activity, RefreshCw } from 'lucide-react';

interface Scenario {
  id: number;
  engineName: string;
  moduleCode: string;
  colorClass: string;
  glowColor: string;
  logs: string[];
  finding: string;
  findingIcon: React.ReactNode;
  recommendation: string;
  impactLabel: string;
  impactStart: string;
  impactEnd: string;
  successTheme: {
    border: string;
    bg: string;
    text: string;
  };
}

export function LiveCommandCenterSimulation() {
  const [cycle, setCycle] = useState(0);
  const [step, setStep] = useState(0); // 0: Scanning, 1: Finding/Alert, 2: Recommendation
  const [progress, setProgress] = useState(0);
  const [visibleLogs, setVisibleLogs] = useState<number>(0);
  
  // Telemetry state
  const [cpu, setCpu] = useState('14.2');
  const [latency, setLatency] = useState(42);
  const [memory, setMemory] = useState('2.34');
  const [queries, setQueries] = useState(0);

  const scenarios: Scenario[] = [
    {
      id: 0,
      engineName: 'Project Intelligence Engine',
      moduleCode: 'PROJ_INT_SYS',
      colorClass: 'text-indigo-400',
      glowColor: 'rgba(99, 102, 241, 0.4)',
      logs: [
        'Auditing active project tasks and histories...',
        'Evaluating critical path dependencies & bottlenecks...',
        'Calculating developer workload and sprint velocities...'
      ],
      finding: 'Risk Detected: Mobile App Launch has 68% delay probability',
      findingIcon: <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5 animate-pulse" />,
      recommendation: 'Suggested Action: Move 2 developers from low priority backlog tasks to App Critical Path',
      impactLabel: 'Delivery Confidence',
      impactStart: '72%',
      impactEnd: '91%',
      successTheme: {
        border: 'border-emerald-500/30',
        bg: 'bg-emerald-500/5',
        text: 'text-emerald-400'
      }
    },
    {
      id: 1,
      engineName: 'Financial Intelligence Engine',
      moduleCode: 'FIN_INT_SYS',
      colorClass: 'text-amber-400',
      glowColor: 'rgba(245, 158, 11, 0.4)',
      logs: [
        'Analyzing aging invoices and pending client sign-offs...',
        'Cross-referencing real-time burn against project budgets...',
        'Simulating cashflow trajectories for next 90 days...'
      ],
      finding: 'Exposure Alert: ₹4.8L cashflow gap predicted in Q3 Runway',
      findingIcon: <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />,
      recommendation: 'Recommendation: Prioritize pending milestone sign-off for Client Approval',
      impactLabel: 'Cashflow Stability',
      impactStart: 'Critical (18 Days)',
      impactEnd: 'Stable (90+ Days)',
      successTheme: {
        border: 'border-amber-500/30',
        bg: 'bg-amber-500/5',
        text: 'text-amber-400'
      }
    },
    {
      id: 2,
      engineName: 'Resource Capacity Engine',
      moduleCode: 'RESC_CAP_SYS',
      colorClass: 'text-purple-400',
      glowColor: 'rgba(168, 85, 247, 0.4)',
      logs: [
        'Aggregating team capacity bounds and utilization metrics...',
        'Measuring current workload balance across specialized units...',
        'Locating structural overload risks and idle bottlenecks...'
      ],
      finding: 'Overload Warning: Design team capacity limits exceeded by 38%',
      findingIcon: <ShieldAlert className="w-5 h-5 text-purple-400 shrink-0 mt-0.5 animate-pulse" />,
      recommendation: 'Suggestion: Redistribute 14 hours design workload to underutilized resources',
      impactLabel: 'Team Burnout Risk',
      impactStart: 'High (Danger)',
      impactEnd: 'Minimal (Balanced)',
      successTheme: {
        border: 'border-purple-500/30',
        bg: 'bg-purple-500/5',
        text: 'text-purple-400'
      }
    }
  ];

  const current = scenarios[cycle];

  // Fluctuating telemetry simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setCpu((12.5 + Math.random() * 6).toFixed(1));
      setLatency(38 + Math.floor(Math.random() * 12));
      setMemory((2.31 + Math.random() * 0.08).toFixed(2));
      setQueries(Math.random() > 0.7 ? Math.floor(Math.random() * 3) : 0);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  // Main state machine control
  useEffect(() => {
    let active = true;
    setProgress(0);
    setVisibleLogs(0);
    setStep(0);

    // Step 0: Scanning phase timers
    const log1 = setTimeout(() => { if (active) setVisibleLogs(1); }, 600);
    const log2 = setTimeout(() => { if (active) setVisibleLogs(2); }, 1400);
    const log3 = setTimeout(() => { if (active) setVisibleLogs(3); }, 2200);

    // Smoothly animate progress bar
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 60);

    const alertTransition = setTimeout(() => {
      if (active) {
        clearInterval(progressInterval);
        setProgress(100);
        setStep(1); // Transition to Finding/Alert
      }
    }, 3500);

    const recommendationTransition = setTimeout(() => {
      if (active) setStep(2); // Transition to Recommendation
    }, 6500);

    const cycleTransition = setTimeout(() => {
      if (active) {
        setCycle((prev) => (prev + 1) % 3);
      }
    }, 11500); // 11.5s total per scenario cycle

    return () => {
      active = false;
      clearTimeout(log1);
      clearTimeout(log2);
      clearTimeout(log3);
      clearTimeout(alertTransition);
      clearTimeout(recommendationTransition);
      clearTimeout(cycleTransition);
      clearInterval(progressInterval);
    };
  }, [cycle]);

  return (
    <div className="relative w-full max-w-xl mx-auto font-mono-pm">
      {/* Background glow behind simulator */}
      <div 
        className="absolute -inset-6 blur-[60px] rounded-full opacity-20 transition-all duration-1000"
        style={{ backgroundColor: current.glowColor }}
      ></div>

      {/* Simulator Terminal Container */}
      <div className="relative glass-panel rounded-2xl overflow-hidden border border-white/5 bg-[#050712]/90 shadow-2xl flex flex-col min-h-[440px]">
        <style>{`
          .cursor-blink::after {
            content: '_';
            animation: cursor-blink-anim 1s step-start infinite;
          }
          @keyframes cursor-blink-anim {
            50% { opacity: 0; }
          }
          .slide-up-fade {
            animation: slide-up-fade-anim 0.4s ease-out forwards;
          }
          @keyframes slide-up-fade-anim {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* Terminal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#080b18]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
            <span className="w-3 h-3 rounded-full bg-yellow-500/80"></span>
            <span className="w-3 h-3 rounded-full bg-green-500/80"></span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-on-surface-variant/60 font-semibold tracking-wider">
            <Activity className="w-3 h-3 text-primary animate-pulse" />
            <span>RESOLVE_CORE_ENGINE v1.5.6 //</span>
            <span className={`uppercase font-bold ${current.colorClass}`}>{current.moduleCode}</span>
          </div>
          <div className="text-[9px] px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-bold">
            PHASE_0x0{step}
          </div>
        </div>

        {/* Console Workspace Area */}
        <div className="flex-1 p-6 flex flex-col gap-6 select-none">
          {/* Active Engine Name */}
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded bg-white/5 ${current.colorClass}`}>
              <Terminal className="w-4 h-4" />
            </div>
            <span className="text-xs uppercase tracking-wider text-on-surface font-bold">
              {current.engineName}
            </span>
          </div>

          {/* Typewriter logs / Scanning phase */}
          <div className="flex-1 flex flex-col gap-2 min-h-[100px] text-[11px] leading-relaxed text-on-surface-variant/80">
            {visibleLogs >= 1 && (
              <div className="flex gap-2">
                <span className="text-primary/50 font-bold">PROBE_01:</span>
                <span className={visibleLogs === 1 ? 'cursor-blink' : ''}>{current.logs[0]}</span>
              </div>
            )}
            {visibleLogs >= 2 && (
              <div className="flex gap-2">
                <span className="text-primary/50 font-bold">PROBE_02:</span>
                <span className={visibleLogs === 2 ? 'cursor-blink' : ''}>{current.logs[1]}</span>
              </div>
            )}
            {visibleLogs >= 3 && (
              <div className="flex gap-2">
                <span className="text-primary/50 font-bold">PROBE_03:</span>
                <span className={visibleLogs === 3 ? 'cursor-blink' : ''}>{current.logs[2]}</span>
              </div>
            )}

            {/* Scanning Progress Bar */}
            {step === 0 && (
              <div className="mt-4 slide-up-fade">
                <div className="flex justify-between text-[9px] text-on-surface-variant/60 mb-1.5 uppercase font-bold tracking-widest">
                  <span>Running diagnostic calculations</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-indigo-400 rounded-full transition-all duration-75"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Finding / Alert Box */}
          {step >= 1 && (
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex gap-3 slide-up-fade">
              {current.findingIcon}
              <div className="flex-1">
                <span className="block text-[10px] text-red-400 font-bold uppercase tracking-widest mb-0.5">
                  SYSTEM LOG ALERT
                </span>
                <span className="text-xs text-on-surface font-semibold block leading-normal">
                  {current.finding}
                </span>
              </div>
            </div>
          )}

          {/* AI Recommendation Panel */}
          {step >= 2 && (
            <div className={`p-4 rounded-xl border ${current.successTheme.border} ${current.successTheme.bg} flex flex-col gap-3.5 slide-up-fade shadow-[0_4px_20px_rgba(0,0,0,0.4)]`}>
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                  RESOLVE PM RECOMMENDATION
                </span>
              </div>
              <p className="text-xs text-on-surface leading-relaxed font-medium">
                {current.recommendation}
              </p>
              
              {/* Calculated Impact Metrics */}
              <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-on-surface-variant">
                <span>{current.impactLabel} Adjustment:</span>
                <div className="flex items-center gap-2 font-bold font-mono-data text-xs">
                  <span className="text-red-400 line-through opacity-70">{current.impactStart}</span>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 animate-pulse">{current.impactEnd}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Terminal Telemetry Footer */}
        <div className="grid grid-cols-4 gap-px bg-white/5 text-[9px] text-on-surface-variant/50 border-t border-white/5 font-semibold">
          <div className="p-3 bg-[#050712]/90 flex flex-col gap-1 items-center justify-center">
            <Cpu className="w-3 h-3 opacity-60 mb-0.5 text-primary" />
            <span className="uppercase text-[8px]">CPU LOAD</span>
            <span className="text-on-surface text-[10px] font-bold font-mono-data">{cpu}%</span>
          </div>
          <div className="p-3 bg-[#050712]/90 flex flex-col gap-1 items-center justify-center">
            <Activity className="w-3 h-3 opacity-60 mb-0.5 text-emerald-400" />
            <span className="uppercase text-[8px]">LATENCY</span>
            <span className="text-on-surface text-[10px] font-bold font-mono-data">{latency}ms</span>
          </div>
          <div className="p-3 bg-[#050712]/90 flex flex-col gap-1 items-center justify-center">
            <Database className="w-3 h-3 opacity-60 mb-0.5 text-purple-400" />
            <span className="uppercase text-[8px]">MEM USE</span>
            <span className="text-on-surface text-[10px] font-bold font-mono-data">{memory}GB</span>
          </div>
          <div className="p-3 bg-[#050712]/90 flex flex-col gap-1 items-center justify-center">
            <RefreshCw className={`w-3 h-3 opacity-60 mb-0.5 text-amber-400 ${queries > 0 ? 'animate-spin' : ''}`} />
            <span className="uppercase text-[8px]">QUEUED</span>
            <span className="text-on-surface text-[10px] font-bold font-mono-data">{queries} Qs</span>
          </div>
        </div>
      </div>
    </div>
  );
}
