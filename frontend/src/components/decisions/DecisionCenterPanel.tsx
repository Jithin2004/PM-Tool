import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Target, AlertTriangle, ShieldAlert, Users, Clock,
  Bell, BrainCircuit, Cpu
} from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { supabase } from '../../lib/supabase';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { calculateExpectedTime } from '../../utils/timeUtils';

export function DecisionCenterPanel() {
  const { workspace } = useWorkspace();
  const {
    projects,
    tasks,
    profiles,
    notifications,
    updateTask,
    askConfirmation,
    notify
  } = useDashboard();

  const [simulatingInsightId, setSimulatingInsightId] = useState<string | null>(null);
  const [activeRecommendationId, setActiveRecommendationId] = useState<string | null>(null);

  const handlePreviewImpact = async (insight: any) => {
    if (simulatingInsightId === insight.id) {
      setSimulatingInsightId(null);
      setActiveRecommendationId(null);
      return;
    }

    setSimulatingInsightId(insight.id);

    if (insight.simulation && workspace?.id) {
      try {
        const rec = await aiRecommendationService.createRecommendation({
          workspace_id: workspace.id,
          recommendation_type: insight.type,
          task_id: insight.simulation.taskId,
          original_assignee_id: insight.simulation.fromUserId,
          suggested_assignee_id: insight.simulation.toUserId,
          predicted_eta_improvement: Number((insight.simulation.etaBefore - insight.simulation.etaAfter).toFixed(1)),
          risk_delta: insight.simulation.riskBefore - insight.simulation.riskAfter,
          confidence_delta: insight.simulation.confidenceAfter - insight.simulation.confidenceBefore
        });

        if (rec?.id) {
          setActiveRecommendationId(rec.id);
        }

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('task_history_logs').insert({
              task_id: insight.simulation.taskId,
              actor_id: user.id,
              action_type: 'transition',
              old_status: null,
              new_status: null,
              payload: {
                timestamp: new Date().toISOString(),
                event: 'AI_RECOMMENDATION_PREVIEW',
                recommendationId: rec.id,
                details: `Previewed AI offload recommendations of "${insight.simulation.taskName}" from "${insight.simulation.fromUserName}" to "${insight.simulation.toUserName}".`
              }
            });
          }
        } catch (logErr) {
          console.warn('Failed to write preview history log:', logErr);
        }
      } catch (err) {
        console.warn('Failed to create recommendation log:', err);
      }
    }
  };

  const handleAcceptSimulation = (insight: any) => {
    if (!insight.simulation || !workspace?.id || !activeRecommendationId) return;

    askConfirmation(
      'Execute AI Mitigation',
      `Are you sure you want to offload "${insight.simulation.taskName}" to ${insight.simulation.toUserName}? This action is permanent and will trigger schedule recalculations.`,
      async () => {
        try {
          await aiRecommendationService.updateRecommendationStatus(workspace.id, activeRecommendationId, 'accepted');
          await updateTask(insight.simulation.taskId, { assignee_id: insight.simulation.toUserId });

          try {
            await supabase.from('notifications').insert({
              workspace_id: workspace.id,
              user_id: insight.simulation.toUserId,
              category: 'assignments',
              title: 'AI Mitigation Assigned',
              body: `You have been assigned "${insight.simulation.taskName}" by the AI Decision Optimizer to balance workloads.`
            });
          } catch (notifErr) {
            console.warn('Notification dispatch failed', notifErr);
          }

          notify(`Mitigation successful. Task offloaded to ${insight.simulation.toUserName}.`, 'success');
        } catch (err) {
          notify('Failed to execute mitigation.', 'error');
          console.error(err);
        } finally {
          setSimulatingInsightId(null);
          setActiveRecommendationId(null);
        }
      },
      'Execute'
    );
  };

  const handleRejectSimulation = async (insight: any) => {
    if (!workspace?.id || !activeRecommendationId) return;
    try {
      await aiRecommendationService.updateRecommendationStatus(workspace.id, activeRecommendationId, 'rejected');
      notify('AI suggestion dismissed.', 'info');
    } catch (err) {
      console.warn('Failed to reject recommendation:', err);
    } finally {
      setSimulatingInsightId(null);
      setActiveRecommendationId(null);
    }
  };

  const activeTasks = useMemo(() => tasks.filter((t: any) => t.status !== 'done'), [tasks]);
  const highRiskTasks = useMemo(() => tasks.filter((t: any) => t.risk === 'high' && t.status !== 'done'), [tasks]);
  const mediumRiskTasks = useMemo(() => tasks.filter((t: any) => t.risk === 'medium' && t.status !== 'done'), [tasks]);
  const unreadNotifs = useMemo(() => (notifications || []).filter((n: any) => !n.read_at), [notifications]);

  const projectHealth = useMemo(() => {
    if (projects.length === 0) return 100;
    const highRiskRatio = tasks.length > 0 ? highRiskTasks.length / tasks.length : 0;
    let totalVariance = 0;
    projects.forEach((p: any) => {
      const best = Number(p.pert_best) || 0;
      const worst = Number(p.pert_worst) || 0;
      totalVariance += Math.pow((worst - best) / 6, 2);
    });
    const avgStdDev = projects.length > 0 ? Math.sqrt(totalVariance) / projects.length : 0;
    let score = 100 - Math.round(highRiskRatio * 50) - Math.round(avgStdDev * 3);
    const completedProjectsCount = projects.filter((p: any) => p.status === 'deployed').length;
    if (projects.length > 0 && completedProjectsCount === projects.length) score = 100;
    return Math.max(20, Math.min(100, score));
  }, [projects, tasks, highRiskTasks]);

  const etaConfidence = useMemo(() => {
    if (projects.length === 0) return { score: 98, interval: 0.5 };
    let totalExpected = 0;
    let totalVariance = 0;
    projects.forEach((p: any) => {
      const best = Number(p.pert_best) || 0;
      const likely = Number(p.pert_likely) || 0;
      const worst = Number(p.pert_worst) || 0;
      totalExpected += (best + 4 * likely + worst) / 6;
      totalVariance += Math.pow((worst - best) / 6, 2);
    });
    const stdDev = Math.sqrt(totalVariance);
    const confidenceScore = Math.max(50, 100 - Math.round((stdDev / (totalExpected || 1)) * 100));
    return {
      score: Math.min(99, confidenceScore),
      interval: Number((stdDev * 1.96).toFixed(1))
    };
  }, [projects]);

  const teamUtilizations = useMemo(() => {
    return profiles.map((profile: any) => {
      const assigned = tasks.filter((t: any) => t.assignee_id === profile.id && t.status !== 'done');
      const totalHours = assigned.reduce((sum: number, t: any) => sum + (t.estimated_hours || 0), 0);
      const capacity = 40 * (profile.availability_factor || 1.0);
      const utilRate = Math.round((totalHours / capacity) * 100);
      return {
        id: profile.id,
        name: profile.full_name || profile.email.split('@')[0],
        util: utilRate,
        hours: totalHours,
        capacity,
        tasksCount: assigned.length
      };
    });
  }, [profiles, tasks]);

  const upcomingTasks = useMemo(() => {
    return tasks
      .filter((t: any) => t.deadline && t.status !== 'done')
      .map((t: any) => {
        const diffTime = new Date(t.deadline!).getTime() - new Date().getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const assignee = profiles.find((p: any) => p.id === t.assignee_id);
        return {
          ...t,
          daysLeft: diffDays,
          assigneeName: assignee ? (assignee.full_name || assignee.email.split('@')[0]) : 'Unassigned'
        };
      })
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  }, [tasks, profiles]);

  const recentActivities = useMemo(() => {
    const list = tasks
      .filter((t: any) => t.updated_at)
      .map((t: any) => {
        const timeStr = new Date(t.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const assignee = profiles.find((p: any) => p.id === t.assignee_id);
        return {
          id: t.id,
          time: timeStr,
          text: `"${t.name}" updated to ${t.status.replace('_', ' ')}`,
          user: assignee ? (assignee.full_name || assignee.email.split('@')[0]) : 'System'
        };
      })
      .slice(0, 5);

    if (list.length === 0) {
      list.push({ id: 'default', time: 'Now', text: 'Engine synchronized with workspace database.', user: 'Core' });
    }
    return list;
  }, [tasks, profiles]);

  const aiInsights = useMemo(() => {
    const insights: any[] = [];

    const overloaded = teamUtilizations.find((u: any) => u.util > 100);
    if (overloaded) {
      const underloaded = teamUtilizations.find((u: any) => u.util < 80);
      if (underloaded) {
        const candidateTask = tasks.find((t: any) => t.assignee_id === overloaded.id && t.status !== 'done' && (t.estimated_hours || 0) > 0);
        if (candidateTask) {
          const taskHours = candidateTask.estimated_hours || 0;
          const fromUserLoadBefore = overloaded.util;
          const fromUserLoadAfter = Math.round(((overloaded.hours - taskHours) / overloaded.capacity) * 100);
          const toUserLoadBefore = underloaded.util;
          const toUserLoadAfter = Math.round(((underloaded.hours + taskHours) / underloaded.capacity) * 100);
          const confidenceBefore = etaConfidence.score;
          const confidenceAfter = Math.min(99, confidenceBefore + 4);
          const riskBefore = highRiskTasks.length;
          const riskAfter = Math.max(0, riskBefore - 1);
          const etaBefore = Number((projects.reduce((acc: number, p: any) => acc + calculateExpectedTime(p.pert_best, p.pert_likely, p.pert_worst), 0) / 8).toFixed(1));
          const etaAfter = Number((etaBefore - (taskHours / 8) * 0.4).toFixed(1));

          insights.push({
            id: `overload-mitigation-${candidateTask.id}`,
            type: 'overload',
            message: `Overload detected: "${overloaded.name}" is at ${overloaded.util}% capacity. Recommend offloading "${candidateTask.name}" (${taskHours}h) to "${underloaded.name}" (${underloaded.util}% load).`,
            simulation: { taskName: candidateTask.name, taskId: candidateTask.id, fromUserId: overloaded.id, fromUserName: overloaded.name, toUserId: underloaded.id, toUserName: underloaded.name, taskHours, fromUserLoadBefore, fromUserLoadAfter, toUserLoadBefore, toUserLoadAfter, confidenceBefore, confidenceAfter, riskBefore, riskAfter, etaBefore, etaAfter }
          });
        } else {
          insights.push({ id: 'capacity-warning', type: 'capacity', message: `Capacity warning: ${overloaded.name} is overloaded at ${overloaded.util}% utilization. Timelines are at risk of cascading delay.` });
        }
      } else {
        insights.push({ id: 'capacity-warning', type: 'capacity', message: `Capacity warning: ${overloaded.name} is overloaded at ${overloaded.util}% utilization.` });
      }
    }

    if (etaConfidence.score < 85) {
      insights.push({ id: 'volatility-warning', type: 'volatility', message: `Estimation drift detected. Wide standard deviation in active PERT values. Re-calibrate pessimistic bounds to lift ETA confidence.` });
    }

    if (highRiskTasks.length > 0) {
      insights.push({ id: 'risk-warning', type: 'risk', message: `Delivery exposure: ${highRiskTasks.length} tasks flagged with high delivery risk. Schedule review before committing to next milestone sprint.` });
    }

    if (insights.length === 0) {
      insights.push({ id: 'all-clear', type: 'normal', message: 'All parameters operating within normal bounds. Capacity loads and timeline variances match target guidelines.' });
    }

    return insights;
  }, [teamUtilizations, etaConfidence, highRiskTasks, tasks, projects]);

  const notifSummary = useMemo(() => {
    const counts = { risk: 0, deadlines: 0, attendance: 0, tasks: 0 };
    unreadNotifs.forEach((n: any) => {
      const cat = n.category as keyof typeof counts;
      if (counts[cat] !== undefined) counts[cat]++;
      else counts.tasks++;
    });
    return counts;
  }, [unreadNotifs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-4">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-accent-secondary" />
          <h1 className="text-xl font-sans font-medium text-text-primary tracking-tight">Decision Intelligence</h1>
        </div>
        <span className="text-xs text-text-tertiary">AI-powered operational recommendations</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Project Health */}
        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-text-secondary">Portfolio Health</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-5">
            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-surface-3" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-emerald-500 transition-all duration-500" strokeDasharray={`${projectHealth}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <span className="absolute text-sm font-semibold text-text-primary">{projectHealth}%</span>
            </div>
            <div>
              <p className={`text-xs font-medium ${projectHealth >= 85 ? 'text-emerald-400' : projectHealth >= 65 ? 'text-signal-warning' : 'text-rose-400'}`}>
                {projectHealth >= 85 ? 'Optimal' : projectHealth >= 65 ? 'Attention Required' : 'Critical Risk'}
              </p>
              <p className="text-[11px] text-text-tertiary mt-0.5">
                {projects.filter((p: any) => p.status !== 'deployed').length} active workloads
              </p>
            </div>
          </div>
        </div>

        {/* ETA Confidence */}
        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-text-secondary">ETA Confidence</span>
            <Target className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-2xl font-sans tracking-tight font-semibold text-text-primary">{etaConfidence.score}%</span>
              <span className="text-[10px] text-text-tertiary">±{etaConfidence.interval}d margin</span>
            </div>
            <div className="h-1.5 w-full bg-surface-3 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${etaConfidence.score}%` }} />
            </div>
            <p className="text-[10px] text-text-tertiary mt-2">Derived from PERT statistical bounds</p>
          </div>
        </div>

        {/* Delivery Risk */}
        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-text-secondary">Delivery Risk</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="space-y-2 overflow-y-auto max-h-[120px]">
            {highRiskTasks.length === 0 && mediumRiskTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 opacity-60">
                <ShieldAlert className="w-5 h-5 mb-1 text-emerald-400" />
                <span className="text-[10px] text-text-tertiary">No high-risk slippages</span>
              </div>
            ) : (
              <>
                {highRiskTasks.slice(0, 2).map((task: any) => (
                  <div key={task.id} className="flex justify-between items-center text-[11px] p-2 rounded-md bg-rose-950/20 border border-rose-500/20">
                    <span className="truncate max-w-[130px] text-text-secondary">{task.name}</span>
                    <span className="text-[10px] font-medium text-rose-400 shrink-0 ml-2">High</span>
                  </div>
                ))}
                {mediumRiskTasks.slice(0, 2).map((task: any) => (
                  <div key={task.id} className="flex justify-between items-center text-[11px] p-2 rounded-md bg-amber-950/20 border border-amber-500/20">
                    <span className="truncate max-w-[130px] text-text-secondary">{task.name}</span>
                    <span className="text-[10px] font-medium text-amber-400 shrink-0 ml-2">Medium</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Team Utilization */}
        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-text-secondary">Team Utilization</span>
            <Users className="w-4 h-4 text-accent-secondary" />
          </div>
          <div className="space-y-2.5 overflow-y-auto max-h-[120px]">
            {teamUtilizations.map((member: any) => (
              <div key={member.id}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-text-secondary truncate max-w-[110px]">{member.name}</span>
                  <span className={`font-medium ${member.util > 100 ? 'text-rose-400' : member.util > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {member.util}%
                  </span>
                </div>
                <div className="h-1 w-full bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${member.util > 100 ? 'bg-rose-500' : member.util > 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, member.util)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Decision Optimizer */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-accent-secondary" />
          <span className="text-sm font-medium text-text-primary">AI Decision Optimizer</span>
          <span className="text-[10px] text-text-tertiary ml-auto">Auto-calibrated from real-time roster data</span>
        </div>
        <div className="space-y-3">
          {aiInsights.map((insight: any) => (
            <div key={insight.id} className="relative p-4 bg-surface-2 border border-border rounded-lg overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent-secondary rounded-l-lg" />
              <div className="flex items-start gap-3 pl-2">
                <Cpu className="w-4 h-4 text-accent-secondary shrink-0 mt-0.5" />
                <p className="text-sm text-text-secondary leading-relaxed">{insight.message}</p>
              </div>

              {insight.simulation && (
                <div className="mt-3 pt-3 border-t border-border-subtle pl-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">Simulation Ready</span>
                    <button
                      onClick={() => handlePreviewImpact(insight)}
                      className="text-[10px] font-medium px-3 py-1 rounded-md bg-surface-3 border border-border hover:border-accent-secondary text-text-secondary hover:text-accent-secondary transition-all"
                    >
                      {simulatingInsightId === insight.id ? 'Hide Preview' : 'Preview Impact'}
                    </button>
                  </div>

                  <AnimatePresence>
                    {simulatingInsightId === insight.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-surface border border-border rounded-lg p-3 space-y-3 mt-2"
                      >
                        <div className="grid grid-cols-2 gap-3 text-[11px]">
                          <div>
                            <p className="text-text-tertiary mb-0.5">"{insight.simulation.fromUserName}" Load</p>
                            <p className="font-semibold">
                              <span className="text-rose-400">{insight.simulation.fromUserLoadBefore}%</span>
                              <span className="text-text-tertiary mx-1">→</span>
                              <span className="text-emerald-400">{insight.simulation.fromUserLoadAfter}%</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-text-tertiary mb-0.5">"{insight.simulation.toUserName}" Load</p>
                            <p className="font-semibold">
                              <span className="text-amber-400">{insight.simulation.toUserLoadBefore}%</span>
                              <span className="text-text-tertiary mx-1">→</span>
                              <span className="text-emerald-400">{insight.simulation.toUserLoadAfter}%</span>
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-[11px]">
                          <div>
                            <p className="text-text-tertiary mb-0.5">ETA</p>
                            <p className="font-semibold">
                              <span className="text-indigo-400">{insight.simulation.etaBefore}d</span>
                              <span className="text-text-tertiary mx-1">→</span>
                              <span className="text-emerald-400">{insight.simulation.etaAfter}d</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-text-tertiary mb-0.5">Confidence</p>
                            <p className="font-semibold">
                              <span className="text-indigo-400">{insight.simulation.confidenceBefore}%</span>
                              <span className="text-text-tertiary mx-1">→</span>
                              <span className="text-emerald-400">{insight.simulation.confidenceAfter}%</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-text-tertiary mb-0.5">Risk Items</p>
                            <p className="font-semibold">
                              <span className="text-rose-400">{insight.simulation.riskBefore}</span>
                              <span className="text-text-tertiary mx-1">→</span>
                              <span className="text-emerald-400">{insight.simulation.riskAfter}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-border-subtle">
                          <button
                            onClick={() => handleAcceptSimulation(insight)}
                            className="flex-1 py-1.5 text-xs font-medium bg-emerald-950/30 text-emerald-400 border border-emerald-500/30 rounded-md hover:bg-emerald-950/50 transition-colors"
                          >
                            Execute Mitigation
                          </button>
                          <button
                            onClick={() => handleRejectSimulation(insight)}
                            className="px-4 py-1.5 text-xs font-medium bg-surface-2 text-text-tertiary border border-border rounded-md hover:text-text-secondary transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Upcoming Deadlines */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-text-primary">Upcoming Deadlines</span>
            <Clock className="w-4 h-4 text-text-tertiary" />
          </div>
          <div className="space-y-2 max-h-[220px] overflow-y-auto">
            {upcomingTasks.length === 0 ? (
              <p className="text-xs text-text-tertiary text-center py-8">No upcoming deadlines flagged.</p>
            ) : (
              upcomingTasks.map((task: any) => (
                <div key={task.id} className="flex justify-between items-center p-2.5 rounded-lg bg-surface-2 border border-border hover:border-border-subtle transition-colors">
                  <div>
                    <p className="text-xs font-medium text-text-primary truncate max-w-[190px]">{task.name}</p>
                    <p className="text-[10px] text-text-tertiary mt-0.5">{task.assigneeName}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${task.daysLeft <= 2 ? 'bg-rose-950/30 text-rose-400 border border-rose-500/20' : 'bg-surface-3 text-text-secondary border border-border'}`}>
                    {task.daysLeft <= 0 ? 'Overdue' : `${task.daysLeft}d left`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notification Summary */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-text-primary">Notification Summary</span>
            <Bell className="w-4 h-4 text-text-tertiary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Timeline Drift', value: notifSummary.deadlines, color: 'text-amber-400' },
              { label: 'Delivery Risk', value: notifSummary.risk, color: 'text-rose-400' },
              { label: 'Attendance', value: notifSummary.attendance, color: 'text-indigo-400' },
              { label: 'Standard Tasks', value: notifSummary.tasks, color: 'text-emerald-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-surface-2 border border-border rounded-lg p-3 text-center">
                <p className="text-[10px] text-text-tertiary mb-1">{label}</p>
                <p className={`text-xl font-semibold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center text-[10px] text-text-tertiary mt-3 pt-3 border-t border-border-subtle">
            <span>Unread alerts</span>
            <span className="font-medium text-text-secondary">{unreadNotifs.length} total</span>
          </div>
        </div>
      </div>
    </div>
  );
}
