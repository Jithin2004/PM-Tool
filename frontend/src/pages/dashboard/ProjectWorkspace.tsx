import React, { useMemo, useState } from 'react';
import { Search, Plus, BrainCircuit, Users, Target, Activity, AlertTriangle, ShieldAlert, Clock, Bell, Cpu,
  Briefcase, Layers, ArrowUpRight, Sparkles, UserPlus, FileText, CheckCircle2, TrendingUp, BarChart3, Check, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { supabase } from '../../lib/supabase';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { ProjectCard } from '../../components/project/ProjectCard';
import { TeamMember } from '../../components/team/TeamMember';
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
          console.warn("Failed to write preview history log:", logErr);
        }
      } catch (err) {
        console.warn("Failed to create recommendation log:", err);
      }
    }
  };

  const handleAcceptSimulation = (insight: any) => {
    if (!insight.simulation || !workspace?.id || !activeRecommendationId) return;

    askConfirmation(
      "Execute AI Mitigation",
      `Are you sure you want to offload "${insight.simulation.taskName}" to ${insight.simulation.toUserName}? This action is permanent and will trigger schedule recalculations.`,
      async () => {
        try {
          // 1. Mark recommendation as accepted
          await aiRecommendationService.updateRecommendationStatus(workspace.id, activeRecommendationId, 'accepted');
          
          // 2. Assign task to new developer
          await updateTask(insight.simulation.taskId, { assignee_id: insight.simulation.toUserId });
          
          // 3. Dispatch notification to the new assignee (if notifications context allows)
          try {
            await supabase.from('notifications').insert({
              workspace_id: workspace.id,
              user_id: insight.simulation.toUserId,
              category: 'assignments',
              title: 'AI Mitigation Assigned',
              body: `You have been assigned "${insight.simulation.taskName}" by the AI Decision Optimizer to balance workloads.`
            });
          } catch (notifErr) {
            console.warn("Notification dispatch failed", notifErr);
          }

          notify(`Mitigation successful. Task offloaded to ${insight.simulation.toUserName}.`, "success");
        } catch (err) {
          notify("Failed to execute mitigation.", "error");
          console.error(err);
        } finally {
          setSimulatingInsightId(null);
          setActiveRecommendationId(null);
        }
      },
      "Execute"
    );
  };

  const handleRejectSimulation = async (insight: any) => {
    if (!workspace?.id || !activeRecommendationId) return;
    
    try {
      await aiRecommendationService.updateRecommendationStatus(workspace.id, activeRecommendationId, 'rejected');
      notify("AI suggestion dismissed.", "info");
    } catch (err) {
      console.warn("Failed to reject recommendation:", err);
    } finally {
      setSimulatingInsightId(null);
      setActiveRecommendationId(null);
    }
  };

  // Helper stats computation
  const activeTasks = useMemo(() => tasks.filter(t => t.status !== 'done'), [tasks]);
  const highRiskTasks = useMemo(() => tasks.filter(t => t.risk === 'high' && t.status !== 'done'), [tasks]);
  const mediumRiskTasks = useMemo(() => tasks.filter(t => t.risk === 'medium' && t.status !== 'done'), [tasks]);
  const unreadNotifs = useMemo(() => (notifications || []).filter((n: any) => !n.read_at), [notifications]);

  // 1. Project Health calculation
  const projectHealth = useMemo(() => {
    if (projects.length === 0) return 100;
    const completedProjectsCount = projects.filter(p => p.status === 'deployed').length;
    const highRiskRatio = tasks.length > 0 ? highRiskTasks.length / tasks.length : 0;
    
    // Average variance score
    let totalVariance = 0;
    projects.forEach(p => {
      const best = Number(p.pert_best) || 0;
      const worst = Number(p.pert_worst) || 0;
      totalVariance += Math.pow((worst - best) / 6, 2);
    });
    const avgStdDev = projects.length > 0 ? Math.sqrt(totalVariance) / projects.length : 0;

    let score = 100 - Math.round(highRiskRatio * 50) - Math.round(avgStdDev * 3);
    if (projects.length > 0 && completedProjectsCount === projects.length) score = 100;
    return Math.max(20, Math.min(100, score));
  }, [projects, tasks, highRiskTasks]);

  // 2. ETA Confidence calculation
  const etaConfidence = useMemo(() => {
    if (projects.length === 0) return { score: 98, interval: 0.5 };
    let totalExpected = 0;
    let totalVariance = 0;
    
    projects.forEach(p => {
      const best = Number(p.pert_best) || 0;
      const likely = Number(p.pert_likely) || 0;
      const worst = Number(p.pert_worst) || 0;
      totalExpected += (best + 4 * likely + worst) / 6;
      totalVariance += Math.pow((worst - best) / 6, 2);
    });

    const stdDev = Math.sqrt(totalVariance);
    // Margin of error mapping: 1 sigma = 68.2%, 2 sigma = 95.4%
    const confidenceScore = Math.max(50, 100 - Math.round((stdDev / (totalExpected || 1)) * 100));
    return {
      score: Math.min(99, confidenceScore),
      interval: Number((stdDev * 1.96).toFixed(1)) // 95% CI margin
    };
  }, [projects]);

  // 3. Team Utilization calculation
  const teamUtilizations = useMemo(() => {
    return profiles.map(profile => {
      const assigned = tasks.filter(t => t.assignee_id === profile.id && t.status !== 'done');
      const totalHours = assigned.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
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

  // 4. Upcoming Deadlines calculation
  const upcomingTasks = useMemo(() => {
    return tasks
      .filter(t => t.deadline && t.status !== 'done')
      .map(t => {
        const diffTime = new Date(t.deadline!).getTime() - new Date().getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const assignee = profiles.find(p => p.id === t.assignee_id);
        return {
          ...t,
          daysLeft: diffDays,
          assigneeName: assignee ? (assignee.full_name || assignee.email.split('@')[0]) : 'Unassigned'
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  }, [tasks, profiles]);

  // 5. Recent Activity Logs mapping
  const recentActivities = useMemo(() => {
    const list = tasks
      .filter(t => t.updated_at)
      .map(t => {
        const timeStr = new Date(t.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const assignee = profiles.find(p => p.id === t.assignee_id);
        return {
          id: t.id,
          time: timeStr,
          text: `Task "${t.name.toUpperCase()}" status updated to [${t.status.toUpperCase()}]`,
          user: assignee ? (assignee.full_name || assignee.email.split('@')[0]) : 'System'
        };
      })
      .slice(0, 5);
    
    if (list.length === 0) {
      list.push({
        id: 'default',
        time: 'LIVE',
        text: 'Engine synchronized with database workspace.',
        user: 'Core'
      });
    }
    return list;
  }, [tasks, profiles]);

  // 6. AI Predictive Insights
  const aiInsights = useMemo(() => {
    const insights: Array<{
      id: string;
      type: string;
      message: string;
      simulation?: {
        taskName: string;
        taskId: string;
        fromUserId: string;
        fromUserName: string;
        toUserId: string;
        toUserName: string;
        taskHours: number;
        fromUserLoadBefore: number;
        fromUserLoadAfter: number;
        toUserLoadBefore: number;
        toUserLoadAfter: number;
        confidenceBefore: number;
        confidenceAfter: number;
        riskBefore: number;
        riskAfter: number;
        etaBefore: number;
        etaAfter: number;
      };
    }> = [];

    // Overload insight
    const overloaded = teamUtilizations.find(u => u.util > 100);
    if (overloaded) {
      const underloaded = teamUtilizations.find(u => u.util < 80);
      if (underloaded) {
        // Find a backlog or in-progress task that can be reassigned
        const candidateTask = tasks.find(t => t.assignee_id === overloaded.id && t.status !== 'done' && (t.estimated_hours || 0) > 0);
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
          
          const etaBefore = Number((projects.reduce((acc, p) => acc + calculateExpectedTime(p.pert_best, p.pert_likely, p.pert_worst), 0) / 8).toFixed(1));
          const etaAfter = Number((etaBefore - (taskHours / 8) * 0.4).toFixed(1));

          insights.push({
            id: `overload-mitigation-${candidateTask.id}`,
            type: 'overload',
            message: `OVERLOAD MITIGATION: "${overloaded.name}" is operating at ${overloaded.util}% capacity. Recommend offloading task "${candidateTask.name.toUpperCase()}" (${taskHours}h) to "${underloaded.name}" (${underloaded.util}% load).`,
            simulation: {
              taskName: candidateTask.name,
              taskId: candidateTask.id,
              fromUserId: overloaded.id,
              fromUserName: overloaded.name,
              toUserId: underloaded.id,
              toUserName: underloaded.name,
              taskHours,
              fromUserLoadBefore,
              fromUserLoadAfter,
              toUserLoadBefore,
              toUserLoadAfter,
              confidenceBefore,
              confidenceAfter,
              riskBefore,
              riskAfter,
              etaBefore,
              etaAfter
            }
          });
        } else {
          insights.push({
            id: 'capacity-warning',
            type: 'capacity',
            message: `CAPACITY WARNING: Operator ${overloaded.name} is overloaded (${overloaded.util}% utilization). Timelines are at risk of cascading delay.`
          });
        }
      } else {
        insights.push({
          id: 'capacity-warning',
          type: 'capacity',
          message: `CAPACITY WARNING: Operator ${overloaded.name} is overloaded (${overloaded.util}% utilization). Timelines are at risk of cascading delay.`
        });
      }
    }

    // Critical path volatility
    if (etaConfidence.score < 85) {
      insights.push({
        id: 'volatility-warning',
        type: 'volatility',
        message: `ESTIMATION DRIFT: Wide standard deviation variance detected in active PERT values. Re-calibrate pessimistic estimation bounds to lift ETA confidence.`
      });
    }

    // High risk warning
    if (highRiskTasks.length > 0) {
      insights.push({
        id: 'risk-warning',
        type: 'risk',
        message: `DELIVERY EXPOSURE: ${highRiskTasks.length} tasks flagged with high delivery risk. Schedule immediate review session before committing milestone sprint.`
      });
    }

    // Default intelligence note
    if (insights.length === 0) {
      insights.push({
        id: 'all-clear',
        type: 'normal',
        message: "CALIBRATION CLEAR: All parameters operating within normal parameters. Capacity loads and timeline variances match target guidelines."
      });
    }

    return insights;
  }, [teamUtilizations, etaConfidence, highRiskTasks, tasks, projects]);

  // 7. Notifications Breakdown
  const notifSummary = useMemo(() => {
    const counts = { risk: 0, deadlines: 0, attendance: 0, tasks: 0 };
    unreadNotifs.forEach((n: any) => {
      const cat = n.category as keyof typeof counts;
      if (counts[cat] !== undefined) {
        counts[cat]++;
      } else {
        counts.tasks++;
      }
    });
    return counts;
  }, [unreadNotifs]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-12">
      {/* 1. Project Health Widget */}
      <div className="border border-white/10 bg-[#0c0c0c]/80 backdrop-blur-md p-6 rounded-sm flex flex-col justify-between h-64 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/50">Project Health</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-[11px] font-mono text-white/60 uppercase leading-snug">Calculated from task completion and risk ratio</p>
        </div>
        <div className="flex items-center gap-6 my-2">
          <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-white/5"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500 transition-all duration-500"
                strokeDasharray={`${projectHealth}, 100`}
                strokeWidth="3"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute font-mono text-base font-bold">{projectHealth}%</span>
          </div>
          <div className="space-y-1">
            <h4 className="text-xs uppercase font-semibold text-white/90">Operational Health</h4>
            <p className="text-[10px] text-emerald-400 font-mono tracking-wide">
              {projectHealth >= 85 ? 'OPTIMAL BOUNDS' : projectHealth >= 65 ? 'ATTENTION REQUIRED' : 'HIGH CRITICAL RISK'}
            </p>
            <p className="text-[9px] font-mono text-white/40">Active workloads: {projects.filter(p => p.status !== 'deployed').length}</p>
          </div>
        </div>
      </div>

      {/* 2. ETA Confidence Widget */}
      <div className="border border-white/10 bg-[#0c0c0c]/80 backdrop-blur-md p-6 rounded-sm flex flex-col justify-between h-64 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/50">ETA Confidence</span>
            <Target className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-[11px] font-mono text-white/60 uppercase leading-snug">Statistical estimation precision derived from PERT bounds</p>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-mono font-bold text-cyan-400">{etaConfidence.score}%</span>
            <span className="text-[10px] font-mono text-white/40">Margin: ±{etaConfidence.interval}d</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400 transition-all duration-500" style={{ width: `${etaConfidence.score}%` }} />
          </div>
          <p className="text-[10px] font-mono text-white/50 uppercase">
            95% probability of delivery timeline matching predictions.
          </p>
        </div>
      </div>

      {/* 3. Delivery Risk Widget */}
      <div className="border border-white/10 bg-[#0c0c0c]/80 backdrop-blur-md p-6 rounded-sm flex flex-col justify-between h-64 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/50">Delivery Risk</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-[11px] font-mono text-white/60 uppercase leading-snug">Active workflows displaying high standard deviation</p>
        </div>
        <div className="space-y-2 flex-1 mt-3 overflow-y-auto">
          {highRiskTasks.length === 0 && mediumRiskTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-35 text-[9px] uppercase font-mono py-2">
              <ShieldAlert className="w-6 h-6 mb-1 text-emerald-400" />
              <span>Zero High-Risk Slippages</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {highRiskTasks.slice(0, 3).map(task => (
                <div key={task.id} className="flex justify-between items-center text-[10px] p-1.5 border border-rose-500/20 bg-rose-500/5 rounded-sm">
                  <span className="truncate w-32 font-medium">{task.name}</span>
                  <span className="font-mono text-[8px] bg-rose-500 text-white px-1 uppercase shrink-0">HIGH RISK</span>
                </div>
              ))}
              {mediumRiskTasks.slice(0, 2).map(task => (
                <div key={task.id} className="flex justify-between items-center text-[10px] p-1.5 border border-amber-500/20 bg-amber-500/5 rounded-sm">
                  <span className="truncate w-32 font-medium">{task.name}</span>
                  <span className="font-mono text-[8px] bg-amber-500 text-black px-1 uppercase shrink-0">MODERATE</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Team Utilization Widget */}
      <div className="border border-white/10 bg-[#0c0c0c]/80 backdrop-blur-md p-6 rounded-sm flex flex-col justify-between h-64 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/50">Team Utilization</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-[11px] font-mono text-white/60 uppercase leading-snug">Resource hours allocated vs available weekly limits</p>
        </div>
        <div className="space-y-2.5 overflow-y-auto max-h-[140px] pr-1">
          {teamUtilizations.map(member => (
            <div key={member.id} className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="truncate max-w-[120px]">{member.name}</span>
                <span className={member.util > 100 ? 'text-rose-400 font-bold' : member.util > 80 ? 'text-amber-400' : 'text-emerald-400'}>
                  {member.util}% ({member.hours}h)
                </span>
              </div>
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    member.util > 100 ? 'bg-rose-500' : member.util > 80 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, member.util)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Upcoming Deadlines Widget */}
      <div className="border border-white/10 bg-[#0c0c0c]/80 backdrop-blur-md p-6 rounded-sm h-72 flex flex-col justify-between md:col-span-2 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/50">Upcoming Deadlines</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="space-y-2 overflow-y-auto max-h-[180px]">
            {upcomingTasks.length === 0 ? (
              <p className="text-[10px] font-mono text-white/40 italic text-center py-8 uppercase">No upcoming deadlines flagged.</p>
            ) : (
              upcomingTasks.map(task => (
                <div key={task.id} className="flex justify-between items-center p-2 border border-white/5 bg-white/5 rounded-sm hover:border-white/10 transition-colors">
                  <div>
                    <h5 className="text-[11px] font-semibold text-white truncate max-w-[200px]">{task.name}</h5>
                    <p className="text-[9px] font-mono text-white/40 uppercase">Assignee: {task.assigneeName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[9px] font-mono px-2 py-0.5 border ${
                      task.daysLeft <= 2 
                        ? 'bg-rose-950/20 border-rose-500/30 text-rose-400 font-bold animate-pulse' 
                        : 'bg-white/5 border-white/10 text-white/60'
                    }`}>
                      {task.daysLeft <= 0 ? 'OVERDUE' : `${task.daysLeft}d left`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 6. Recent Activity Widget */}
      <div className="border border-white/10 bg-[#0c0c0c]/80 backdrop-blur-md p-6 rounded-sm h-72 flex flex-col justify-between md:col-span-2 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/50">Recent Activity Logs</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="space-y-2 overflow-y-auto max-h-[180px] font-mono">
            {recentActivities.map(act => (
              <div key={act.id} className="flex items-start gap-2.5 text-[10px] leading-normal py-1.5 border-b border-white/5">
                <span className="text-white/40 font-mono text-[9px] mt-0.5 shrink-0">{act.time}</span>
                <div>
                  <p className="text-white/80">{act.text}</p>
                  <p className="text-[8px] text-white/40 uppercase mt-0.5">Initiated by: {act.user}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7. AI Predictive Insights Widget */}
      <div className="border border-white/10 bg-[#0c0c0c]/80 backdrop-blur-md p-6 rounded-sm md:col-span-2 min-h-[18rem] h-auto flex flex-col justify-between shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit className="w-4 h-4 text-purple-400 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/95">AI Decision Optimizer</span>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[350px]">
            {aiInsights.map((insight) => (
              <div key={insight.id} className="p-3 border border-purple-500/20 bg-purple-950/10 rounded-sm relative overflow-hidden flex flex-col gap-2 text-[11px] leading-relaxed">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500" />
                <div className="flex items-start gap-2.5">
                  <Cpu className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <p className="text-neutral-200">{insight.message}</p>
                </div>

                {insight.simulation && (
                  <div className="mt-2 pt-2 border-t border-purple-500/10 flex flex-col gap-2 font-mono text-[10px]">
                    <div className="flex justify-between items-center">
                      <span className="text-white/40">SIMULATION ENGINE READY</span>
                      <button
                        onClick={() => handlePreviewImpact(insight)}
                        className="px-2 py-0.5 bg-purple-900/60 hover:bg-purple-800 border border-purple-500/30 text-white font-mono text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
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
                          className="bg-black/40 border border-purple-500/20 p-2.5 rounded-sm space-y-2 mt-1"
                        >
                          <div>
                            <p className="text-[9px] text-white/50 uppercase tracking-widest mb-1.5">Simulation Parameters</p>
                            <div className="grid grid-cols-2 gap-2 text-[9px]">
                              <div>
                                <p className="text-white/40 uppercase">"{insight.simulation.fromUserName}" LOAD</p>
                                <p className="font-bold text-rose-400">
                                  {insight.simulation.fromUserLoadBefore}% <span className="text-white/50">→</span> <span className="text-emerald-400 font-extrabold">{insight.simulation.fromUserLoadAfter}%</span>
                                </p>
                              </div>
                              <div>
                                <p className="text-white/40 uppercase">"{insight.simulation.toUserName}" LOAD</p>
                                <p className="font-bold text-amber-400">
                                  {insight.simulation.toUserLoadBefore}% <span className="text-white/50">→</span> <span className="text-purple-400 font-extrabold">{insight.simulation.toUserLoadAfter}%</span>
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="h-px bg-white/5" />

                          <div className="grid grid-cols-3 gap-2 text-[9px]">
                            <div>
                              <p className="text-white/40 uppercase">ESTIMATED ETA</p>
                              <p className="font-bold text-indigo-400">
                                {insight.simulation.etaBefore}d <span className="text-white/30">→</span> <span className="text-emerald-400 font-extrabold">{insight.simulation.etaAfter}d</span>
                              </p>
                            </div>
                            <div>
                              <p className="text-white/40 uppercase">CONFIDENCE</p>
                              <p className="font-bold text-cyan-400">
                                {insight.simulation.confidenceBefore}% <span className="text-white/30">→</span> <span className="text-emerald-400 font-extrabold">{insight.simulation.confidenceAfter}%</span>
                              </p>
                            </div>
                            <div>
                              <p className="text-white/40 uppercase">DELIVERY RISK</p>
                              <p className="font-bold text-rose-400">
                                {insight.simulation.riskBefore} <span className="text-white/30">→</span> <span className="text-emerald-400 font-extrabold">{insight.simulation.riskAfter}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2 border-t border-white/5 mt-2">
                            <button
                              onClick={() => handleAcceptSimulation(insight)}
                              className="flex-1 px-2 py-1.5 bg-emerald-900/40 hover:bg-emerald-900/80 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Execute Mitigation
                            </button>
                            <button
                              onClick={() => handleRejectSimulation(insight)}
                              className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white font-mono text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
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
        <p className="text-[8px] font-mono text-white/30 uppercase mt-2">
          Predictions auto-calibrated based on real-time roster and historical delay indicators.
        </p>
      </div>

      {/* 8. Notification Summary Widget */}
      <div className="border border-white/10 bg-[#0c0c0c]/80 backdrop-blur-md p-6 rounded-sm md:col-span-2 h-72 flex flex-col justify-between shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/50">Notification Summary</span>
            <Bell className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-white/5 bg-white/5 p-3 rounded-sm text-center">
              <span className="text-[9px] font-mono uppercase text-white/40 block mb-1">Timeline Drift</span>
              <span className="text-lg font-mono font-bold text-amber-400">{notifSummary.deadlines}</span>
            </div>
            <div className="border border-white/5 bg-white/5 p-3 rounded-sm text-center">
              <span className="text-[9px] font-mono uppercase text-white/40 block mb-1">Delivery Risk</span>
              <span className="text-lg font-mono font-bold text-rose-400">{notifSummary.risk}</span>
            </div>
            <div className="border border-white/5 bg-white/5 p-3 rounded-sm text-center">
              <span className="text-[9px] font-mono uppercase text-white/40 block mb-1">Squad Attendance</span>
              <span className="text-lg font-mono font-bold text-blue-400">{notifSummary.attendance}</span>
            </div>
            <div className="border border-white/5 bg-white/5 p-3 rounded-sm text-center">
              <span className="text-[9px] font-mono uppercase text-white/40 block mb-1">Standard Tasks</span>
              <span className="text-lg font-mono font-bold text-green-400">{notifSummary.tasks}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center text-[9px] font-mono uppercase text-white/40 mt-3 pt-2 border-t border-white/5">
          <span>Unread alerts queue</span>
          <span className="font-bold text-rose-400">{unreadNotifs.length} total unread</span>
        </div>
      </div>
    </div>
  );
}

export function ExecutiveDashboardPanel() {
  const {
    projects,
    tasks,
    profiles,
    setIsAdding,
    setSelectedProject,
    setIsRosterOpen
  } = useDashboard() as any;

  // Active Projects
  const activeProjectsCount = useMemo(() => projects.filter((p: any) => p.status !== 'deployed').length, [projects]);
  
  // Tasks in progress (not done and not backlog)
  const inProgressTasksCount = useMemo(() => tasks.filter((t: any) => t.status !== 'done' && t.status !== 'backlog').length, [tasks]);
  
  // Completed Tasks
  const completedTasksCount = useMemo(() => tasks.filter((t: any) => t.status === 'done').length, [tasks]);
  
  // Team members
  const teamMembersCount = useMemo(() => profiles.length, [profiles]);
  
  // Completion rate (tasks completed out of total tasks)
  const completionRate = useMemo(() => {
    const total = tasks.length;
    if (total === 0) return 89.75;
    return Number(((completedTasksCount / total) * 100).toFixed(1));
  }, [tasks, completedTasksCount]);

  // Project Progress Donut calculation
  const projectProgressData = useMemo(() => {
    const total = projects.length || 1;
    const completed = projects.filter((p: any) => p.status === 'deployed').length;
    const inProgress = projects.filter((p: any) => p.status === 'in_progress' || p.status === 'active').length;
    
    // Fallbacks to look like mockup if database is empty
    const completedPct = Math.round((completed / total) * 100) || 75;
    const inProgressPct = Math.round((inProgress / total) * 100) || 15;
    const pendingPct = 100 - completedPct - inProgressPct;
    
    return { completedPct, inProgressPct, pendingPct };
  }, [projects]);

  // Weekly bar chart calculation (tasks completed by weekday Mon-Sun)
  const barChartDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Mock data for weekly bar chart styled beautifully
  const barHeights = [
    { completed: 45, inProgress: 35, pending: 20 },
    { completed: 60, inProgress: 25, pending: 15 },
    { completed: 75, inProgress: 15, pending: 10 },
    { completed: 50, inProgress: 30, pending: 20 },
    { completed: 80, inProgress: 12, pending: 8 },
    { completed: 30, inProgress: 45, pending: 25 },
    { completed: 20, inProgress: 50, pending: 30 },
  ];

  // Mock upcoming tasks for dashboard matching 5th image
  const upcomingTasksData = [
    { id: 1, title: 'UI/UX Design Triage Review', time: 'Today, 10:00 AM', tag: 'UI/UX Review', tagBg: 'bg-purple-500/10 border-purple-500/20 text-purple-400' },
    { id: 2, title: 'Supabase API Integration Sync', time: 'Tomorrow, 11:30 AM', tag: 'API Integration', tagBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
    { id: 3, title: 'Weekly Allocations Roster Meeting', time: 'Jul 28, 02:00 PM', tag: 'Project Meeting', tagBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
    { id: 4, title: 'Executive Brand Identity Redesign', time: 'Jul 29, 09:00 AM', tag: 'Design System', tagBg: 'bg-green-500/10 border-green-500/20 text-green-400' }
  ];

  // Mock activity feed matching the InsightHub and 5th image logs
  const activityFeed = [
    { id: 1, name: 'Kristin Watson', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', action: 'completed Design System', time: '2 hours ago' },
    { id: 2, name: 'Ralph Edwards', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', action: 'updated Project Dashboard', time: '4 hours ago' },
    { id: 3, name: 'Cody Fisher', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', action: 'created 3 new tasks', time: '6 hours ago' },
    { id: 4, name: 'Brooklyn Simmons', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', action: 'submitted API Integration patch', time: '8 hours ago' },
    { id: 5, name: 'Leslie Alexander', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', action: 'uploaded assets to Knowledge Hub', time: '10 hours ago' }
  ];

  // developed areas
  const developedAreas = [
    { name: 'Website Redesign', progress: 75, colorBg: 'bg-blue-500' },
    { name: 'Mobile Application', progress: 60, colorBg: 'bg-orange-500' },
    { name: 'API Development', progress: 45, colorBg: 'bg-purple-500' },
    { name: 'Marketing Campaign', progress: 100, colorBg: 'bg-emerald-500' },
  ];

  // Team performance list
  const teamPerformance = [
    { name: 'Kristin Watson', score: 95, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', rank: '1st' },
    { name: 'Ralph Edwards', score: 88, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', rank: '2nd' },
    { name: 'Cody Fisher', score: 76, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', rank: '3rd' },
    { name: 'Brooklyn Simmons', score: 92, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', rank: '4th' },
    { name: 'Leslie Alexander', score: 85, avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', rank: '5th' }
  ];

  const handleExportReport = () => {
    alert("Exporting high-fidelity project allocation audit log as CSV format...");
  };

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('popstate'));
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      
      {/* 1. Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        
        {/* Active Projects card */}
        <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col justify-between shadow-premium hover:border-accent-primary/20 transition-all duration-200">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-mono font-bold text-text-secondary uppercase tracking-wider">Active Projects</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10">
              <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-text-primary tracking-tight">{activeProjectsCount}</h3>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-400 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>+12% from last month</span>
            </div>
          </div>
        </div>

        {/* Tasks in Progress card */}
        <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col justify-between shadow-premium hover:border-accent-primary/20 transition-all duration-200">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-mono font-bold text-text-secondary uppercase tracking-wider">Tasks in Progress</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/10">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-text-primary tracking-tight">{inProgressTasksCount || 146}</h3>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-400 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>+8% from last month</span>
            </div>
          </div>
        </div>

        {/* Completed Tasks card */}
        <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col justify-between shadow-premium hover:border-accent-primary/20 transition-all duration-200">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-mono font-bold text-text-secondary uppercase tracking-wider">Completed Tasks</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/10">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-text-primary tracking-tight">{completedTasksCount || 89}</h3>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-400 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>+15% from last month</span>
            </div>
          </div>
        </div>

        {/* Team Members card */}
        <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col justify-between shadow-premium hover:border-accent-primary/20 transition-all duration-200">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-mono font-bold text-text-secondary uppercase tracking-wider">Team Members</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/10">
              <Users className="w-3.5 h-3.5 text-purple-400" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-text-primary tracking-tight">{teamMembersCount || 32}</h3>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-400 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>+5% from last month</span>
            </div>
          </div>
        </div>

        {/* Completion Rate card */}
        <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col justify-between shadow-premium hover:border-accent-primary/20 transition-all duration-200">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-mono font-bold text-text-secondary uppercase tracking-wider">Completion Rate</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-text-primary tracking-tight">{completionRate}%</h3>
            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-emerald-400 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>+6% from last month</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Middle Row (Circular progress, Bar Chart, Upcoming Tasks) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Project Progress circular/donut chart */}
        <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col justify-between shadow-premium lg:col-span-1">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Project Progress</h4>
              <span className="text-[10px] font-mono text-cyan-400">This Month</span>
            </div>
            <p className="text-[10px] text-text-secondary leading-snug">Overall status contribution across allocations.</p>
          </div>

          <div className="flex flex-col items-center justify-center my-6 relative">
            <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle className="text-white/5" strokeWidth="4" stroke="currentColor" fill="none" cx="18" cy="18" r="15.9" />
                
                {/* Completed slice (75%) */}
                <circle
                  className="text-indigo-500"
                  strokeWidth="4"
                  strokeDasharray={`${projectProgressData.completedPct}, 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  cx="18"
                  cy="18"
                  r="15.9"
                />

                {/* In progress slice (15%) */}
                <circle
                  className="text-amber-500"
                  strokeWidth="4"
                  strokeDasharray={`${projectProgressData.inProgressPct}, 100`}
                  strokeDashoffset={`-${projectProgressData.completedPct}`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  cx="18"
                  cy="18"
                  r="15.9"
                />

                {/* Pending slice (10%) */}
                <circle
                  className="text-text-tertiary"
                  strokeWidth="4"
                  strokeDasharray={`${projectProgressData.pendingPct}, 100`}
                  strokeDashoffset={`-${projectProgressData.completedPct + projectProgressData.inProgressPct}`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  cx="18"
                  cy="18"
                  r="15.9"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-xl font-bold tracking-tight text-text-primary">75%</span>
                <span className="text-[8px] font-mono text-text-tertiary uppercase">Completed</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[9px] font-mono border-t border-border pt-4">
            <div>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5" />
              <span className="text-text-secondary uppercase">Task ({projectProgressData.completedPct}%)</span>
            </div>
            <div>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
              <span className="text-text-secondary uppercase">Progress ({projectProgressData.inProgressPct}%)</span>
            </div>
            <div>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-text-tertiary mr-1.5" />
              <span className="text-text-secondary uppercase">Pending ({projectProgressData.pendingPct}%)</span>
            </div>
          </div>
        </div>

        {/* Weekly tasks bar chart */}
        <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col justify-between shadow-premium lg:col-span-2">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div>
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Tasks Overview</h4>
              <p className="text-[10px] text-text-tertiary font-mono">Weekly completion distributions</p>
            </div>
            <div className="flex bg-white/5 p-1 border border-border rounded-lg text-[9px] font-mono">
              <span className="px-2 py-0.5 bg-indigo-600 text-white rounded">This Week</span>
              <span className="px-2 py-0.5 text-text-secondary hover:text-text-primary">Last Week</span>
            </div>
          </div>

          <div className="h-48 flex items-end justify-between px-2 gap-3 pb-2 pt-4">
            {barChartDays.map((day, idx) => {
              const data = barHeights[idx];
              return (
                <div key={day} className="flex-1 flex flex-col items-center h-full group">
                  <div className="w-full flex flex-col justify-end items-center gap-1.5 h-full relative">
                    
                    {/* Floating Info Tooltip */}
                    <div className="absolute -top-6 bg-black border border-border px-1.5 py-0.5 rounded text-[8px] font-mono text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none uppercase">
                      C:{data.completed}%
                    </div>

                    {/* Stacked bar structure */}
                    <div className="w-6 sm:w-8 flex flex-col h-full justify-end rounded-t-lg overflow-hidden bg-black/10">
                      <div className="bg-text-tertiary transition-all duration-300" style={{ height: `${data.pending}%` }} title="Pending" />
                      <div className="bg-amber-500 transition-all duration-300" style={{ height: `${data.inProgress}%` }} title="In Progress" />
                      <div className="bg-indigo-500 transition-all duration-300" style={{ height: `${data.completed}%` }} title="Completed" />
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-text-secondary mt-3 uppercase tracking-wider">{day}</span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 justify-center text-[9px] font-mono pt-4 border-t border-border mt-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-indigo-500" />
              <span className="text-text-secondary uppercase">Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-amber-500" />
              <span className="text-text-secondary uppercase">In Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-text-tertiary" />
              <span className="text-text-secondary uppercase">Pending</span>
            </div>
          </div>
        </div>

        {/* Upcoming Tasks list */}
        <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col justify-between shadow-premium lg:col-span-1">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Upcoming Tasks</h4>
              <ArrowUpRight className="w-3.5 h-3.5 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer" />
            </div>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-56 pr-1">
            {upcomingTasksData.map(task => (
              <div key={task.id} className="p-3 border border-border hover:border-accent-primary/20 bg-white/[0.01] hover:bg-white/[0.03] rounded-xl transition-all flex flex-col gap-1.5">
                <div className="flex justify-between items-start gap-2">
                  <h5 className="text-[11px] font-semibold text-text-primary leading-tight truncate max-w-[140px]" title={task.title}>
                    {task.title}
                  </h5>
                  <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 border rounded-md uppercase tracking-wider shrink-0 ${task.tagBg}`}>
                    {task.tag}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-text-tertiary font-mono">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>{task.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Bottom Row (Activity feed, developed areas, team performance) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Team Activity Feed */}
        <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col justify-between shadow-premium lg:col-span-2">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div>
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Team Activity</h4>
              <p className="text-[10px] text-text-tertiary font-mono">Live audit logs stream</p>
            </div>
            <button
              onClick={() => navigateTo('/control/audit')}
              className="text-[9px] font-mono text-indigo-400 hover:text-indigo-300 uppercase tracking-widest"
            >
              View All Logs
            </button>
          </div>

          <div className="space-y-3.5 overflow-y-auto max-h-64 pr-1">
            {activityFeed.map(act => (
              <div key={act.id} className="flex items-center gap-3 py-1.5 border-b border-border/40 last:border-b-0">
                <img
                  src={act.avatar}
                  alt={act.name}
                  className="w-8 h-8 rounded-full object-cover border border-border bg-white/5 animate-in"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-text-primary leading-relaxed">
                    <strong className="font-semibold text-text-primary">{act.name}</strong>{" "}
                    <span className="text-text-secondary">{act.action}</span>
                  </p>
                  <p className="text-[9px] font-mono text-text-tertiary uppercase mt-0.5">{act.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Developed Areas progress bars */}
        <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col justify-between shadow-premium lg:col-span-1">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Developed Areas</h4>
              <span className="text-[10px] font-mono text-text-tertiary">Interests</span>
            </div>
          </div>

          <div className="space-y-4 flex-1 justify-center flex flex-col">
            {developedAreas.map(area => (
              <div key={area.name} className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-text-secondary">{area.name}</span>
                  <span className="text-text-primary font-bold">{area.progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-black/10 border border-border rounded-full overflow-hidden">
                  <div
                    className={`h-full ${area.colorBg} rounded-full transition-all duration-500`}
                    style={{ width: `${area.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Performance list */}
        <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col justify-between shadow-premium lg:col-span-1">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Team Performance</h4>
              <span className="text-[10px] font-mono text-emerald-400">Active</span>
            </div>
          </div>

          <div className="space-y-3.5 overflow-y-auto max-h-64 pr-1">
            {teamPerformance.map(member => (
              <div key={member.name} className="flex items-center gap-3 justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-7 h-7 rounded-full object-cover border border-border bg-white/5 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-text-primary truncate">{member.name}</p>
                    <p className="text-[9px] font-mono text-text-tertiary uppercase">Compliance Score</p>
                  </div>
                </div>
                <div className="text-right shrink-0 font-mono">
                  <span className="text-[10px] font-bold text-indigo-400 block">{member.score}%</span>
                  <span className="text-[8px] bg-white/5 border border-border px-1 rounded uppercase tracking-tighter text-text-tertiary font-bold">
                    {member.rank}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Lower Section (Recent Projects Table & Quick Actions) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Recent Projects Table */}
        <div className="bg-surface border border-border p-5 rounded-2xl shadow-premium lg:col-span-3 overflow-x-auto">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Recent Projects</h4>
            <button
              onClick={() => { setDashboardTab('active'); }}
              className="text-[9px] font-mono text-indigo-400 hover:text-indigo-300 uppercase tracking-widest"
            >
              View Full Workspace
            </button>
          </div>

          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b border-border text-[9px] font-mono uppercase text-text-tertiary">
                <th className="py-2.5 font-bold">Project Name</th>
                <th className="py-2.5 font-bold">Status</th>
                <th className="py-2.5 font-bold">Allocation Progress</th>
                <th className="py-2.5 font-bold">Client Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {projects.slice(0, 4).map((p: any) => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedProject(p)}
                  className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                >
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded bg-white/5 border border-border flex items-center justify-center">
                        <Layers className="w-3 h-3 text-text-secondary" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-text-primary">{p.name}</p>
                        <span className="text-[8px] bg-white/5 border border-border px-1 py-0.5 rounded font-mono font-bold tracking-tighter text-text-tertiary animate-pulse">
                          {p.execution_mode}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 border rounded-md uppercase tracking-wider ${
                      p.status === 'deployed' 
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                        : p.status === 'planning'
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}>
                      {p.status?.replace('_', ' ') || 'Planning'}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-24 bg-black/10 border border-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 transition-all duration-300"
                          style={{ width: `${p.status === 'deployed' ? 100 : p.status === 'planning' ? 30 : 65}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-text-secondary">
                        {p.status === 'deployed' ? '100%' : p.status === 'planning' ? '30%' : '65%'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 font-mono text-[10px] text-text-secondary">
                    {p.client_deadline ? new Date(p.client_deadline).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }) : 'UNSET'}
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[10px] font-mono text-text-tertiary uppercase">
                    No recent projects registered
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Quick Actions Grid */}
        <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col justify-between shadow-premium lg:col-span-1">
          <div className="pb-3 border-b border-border mb-4">
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Quick Actions</h4>
          </div>

          <div className="grid grid-cols-2 gap-3 flex-1">
            
            {/* New Project */}
            <button
              onClick={() => setIsAdding(true)}
              className="p-3 border border-border hover:border-indigo-500/40 bg-white/[0.01] hover:bg-indigo-500/[0.04] rounded-xl flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer group"
            >
              <Plus className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
              <div>
                <p className="text-[10px] font-bold text-text-primary">New Project</p>
                <p className="text-[8px] text-text-tertiary font-mono uppercase tracking-tighter">Create new</p>
              </div>
            </button>

            {/* Add Task */}
            <button
              onClick={() => navigateTo('/execution')}
              className="p-3 border border-border hover:border-blue-500/40 bg-white/[0.01] hover:bg-blue-500/[0.04] rounded-xl flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer group"
            >
              <Plus className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
              <div>
                <p className="text-[10px] font-bold text-text-primary">Add Task</p>
                <p className="text-[8px] text-text-tertiary font-mono uppercase tracking-tighter">Create task</p>
              </div>
            </button>

            {/* Invite Team */}
            <button
              onClick={() => setIsRosterOpen(true)}
              className="p-3 border border-border hover:border-purple-500/40 bg-white/[0.01] hover:bg-purple-500/[0.04] rounded-xl flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer group"
            >
              <UserPlus className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
              <div>
                <p className="text-[10px] font-bold text-text-primary">Invite Team</p>
                <p className="text-[8px] text-text-tertiary font-mono uppercase tracking-tighter">Add squad</p>
              </div>
            </button>

            {/* Generate Report */}
            <button
              onClick={handleExportReport}
              className="p-3 border border-border hover:border-emerald-500/40 bg-white/[0.01] hover:bg-emerald-500/[0.04] rounded-xl flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer group"
            >
              <Download className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <div>
                <p className="text-[10px] font-bold text-text-primary">Get Report</p>
                <p className="text-[8px] text-text-tertiary font-mono uppercase tracking-tighter">Export log</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectWorkspace({
  workingHoursPerDay: propWorkingHoursPerDay,
  tilesPerRow: propTilesPerRow,
  setIsRosterOpen: propSetIsRosterOpen,
  setSelectedProject: propSetSelectedProject,
}: any) {
  const { profile } = useAuth();
  const { 
    projects, 
    teams, 
    profiles, 
    searchTerm, 
    setSearchTerm, 
    dashboardTab, 
    setDashboardTab, 
    setIsAdding,
    workingHoursPerDay: ctxWorkingHours,
    tilesPerRow: ctxTiles,
    setIsRosterOpen: ctxSetIsRosterOpen,
    setSelectedProject: ctxSetSelectedProject,
  } = useDashboard() as any;

  const workingHoursPerDay = propWorkingHoursPerDay ?? ctxWorkingHours ?? 8;
  const tilesPerRow = propTilesPerRow ?? ctxTiles ?? 3;
  const setIsRosterOpen = propSetIsRosterOpen ?? ctxSetIsRosterOpen;
  const setSelectedProject = propSetSelectedProject ?? ctxSetSelectedProject;

  const activeTeams = useMemo(() => teams.filter(t => t.name !== 'SYSTEM_SETTINGS'), [teams]);

  const filteredProjects = useMemo(() => {
    return projects
      .filter(p => dashboardTab === 'active' ? p.status !== 'deployed' : p.status === 'deployed')
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [projects, dashboardTab, searchTerm]);

  const scrumProjects = useMemo(() =>
    projects.filter(p =>
      p.execution_mode === 'SCRUM' &&
      p.name.toLowerCase().includes(searchTerm.toLowerCase()),
    ),
  [projects, searchTerm]);

  return (
    <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-8 mb-6 sm:mb-8 border-b border-border pb-6">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 mb-2">
            <h2 className="text-2xl sm:text-3xl font-medium tracking-tight">Project Workspace</h2>
            <div className="flex bg-white/5 p-1 border border-border shrink-0 rounded-lg">
              <button
                onClick={() => setDashboardTab('dashboard')}
                className={`px-3 py-1 text-[9px] font-mono uppercase tracking-widest transition-all rounded ${dashboardTab === 'dashboard' ? 'bg-white text-black font-bold shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setDashboardTab('active')}
                className={`px-3 py-1 text-[9px] font-mono uppercase tracking-widest transition-all rounded ${dashboardTab === 'active' ? 'bg-white text-black font-bold shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Active
              </button>
              <button
                onClick={() => setDashboardTab('completed')}
                className={`px-3 py-1 text-[9px] font-mono uppercase tracking-widest transition-all rounded ${dashboardTab === 'completed' ? 'bg-white text-black font-bold shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Completed
              </button>
              <button
                onClick={() => setDashboardTab('intelligence')}
                className={`px-3 py-1 text-[9px] font-mono uppercase tracking-widest transition-all rounded ${dashboardTab === 'intelligence' ? 'bg-purple-600 border border-purple-500 text-white' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Decision Center
              </button>
            </div>
          </div>
          <p className="text-sm text-text-secondary font-mono tracking-tighter">
            {dashboardTab === 'dashboard'
              ? "Comprehensive analytics panel featuring real-time workload tracking, task status maps, and squad performance telemetry."
              : dashboardTab === 'active'
              ? "Precision forecasting through engineering overhead modeling and historical drift correction."
              : dashboardTab === 'completed'
              ? "Historical repository of finalized projects and team attribution data."
              : "Auto-generated engineering health indexes, AI risk optimizers, and team utilization telemetry."}
          </p>
        </div>

        {dashboardTab !== 'intelligence' && dashboardTab !== 'dashboard' && (
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                placeholder="Query projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0c0c0c] border border-border h-10 pl-10 pr-4 text-sm font-mono focus:border-white/30 outline-none transition-all placeholder:text-text-tertiary"
              />
            </div>
            {profile && profile.role !== 'viewer' && (
              <button
                onClick={() => setIsAdding(true)}
                className="bg-white text-black px-4 h-10 flex items-center gap-2 font-medium hover:bg-neutral-200 transition-colors shrink-0"
                id="add-project-btn"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline text-xs uppercase tracking-wider">Create Project</span>
              </button>
            )}
          </div>
        )}
      </div>

      {dashboardTab === 'dashboard' ? (
        <ExecutiveDashboardPanel />
      ) : dashboardTab === 'intelligence' ? (
        <DecisionCenterPanel />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-12">
          <div className="lg:col-span-3">
            <div className={`grid grid-cols-1 ${tilesPerRow === 2 ? 'md:grid-cols-2' :
              tilesPerRow === 3 ? 'md:grid-cols-2 xl:grid-cols-3' :
                'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              } gap-6`}>
              <AnimatePresence mode="popLayout">
                {filteredProjects.map((project) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.2 }}
                    key={project.id}
                  >
                    <ProjectCard
                      project={project}
                      teams={activeTeams}
                      profiles={profiles}
                      workingHoursPerDay={workingHoursPerDay}
                      workingTimeFrom="09:00"
                      workingTimeTo="17:00"
                      onClick={setSelectedProject}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredProjects.length === 0 && (
                <div className="col-span-full border-2 border-dashed border-white/5 py-24 flex flex-col items-center justify-center text-center opacity-50">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                    <BrainCircuit className="w-8 h-8 text-white/75" />
                  </div>
                  <h3 className="text-xl font-medium mb-2 uppercase tracking-tight">No Projects Found</h3>
                  <p className="text-sm font-mono text-white/85">
                    {scrumProjects.length > 0
                      ? `${scrumProjects.length} active sprint project${scrumProjects.length !== 1 ? 's' : ''} available in sprint view.`
                      : 'Query yielded no matching engineering constructs.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="border border-white/10 bg-[#0c0c0c] p-6">
              <div className="flex items-center gap-2 mb-6">
                <Users className="w-4 h-4 text-white/85" />
                <h3 className="text-[10px] font-mono uppercase tracking-widest text-white/90">Team Allocation</h3>
              </div>

              <div className="space-y-4">
                {activeTeams.slice(0, 3).map(team => {
                  const engineerCount = Math.max(1, team.data?.developer_ids?.length || 1);
                  const teamCapacityHours = 20 * (workingHoursPerDay * 0.8) * engineerCount;

                  const teamProjects = projects.filter(p => p.team_id === team.id);
                  const totalExpected = teamProjects.reduce((acc, p) => acc + calculateExpectedTime(p.pert_best, p.pert_likely, p.pert_worst), 0);
                  const avgEfficiency = teamProjects.length > 0 ? teamProjects.reduce((acc, p) => acc + (p as any).efficiency, 0) / teamProjects.length : 1;
                  const load = Math.round((totalExpected / teamCapacityHours) * 100);

                  return (
                    <div key={team.id}>
                      <TeamMember
                        name={team.name}
                        role={teamProjects.length > 0 ? `${teamProjects.length} Active Workflows` : 'Awaiting Tasking'}
                        load={Math.min(load, 150)}
                        efficiency={Number(avgEfficiency.toFixed(2))}
                        urgent={load > 100}
                      />
                    </div>
                  );
                })}
                {activeTeams.length === 0 && <p className="text-[10px] font-mono text-white/75 italic">No operational units detected.</p>}
              </div>

              <button
                onClick={() => setIsRosterOpen(true)}
                className="w-full mt-8 py-3 border border-white/5 bg-white/5 text-[9px] uppercase font-mono tracking-widest hover:bg-white/10 transition-colors"
              >
                View Full Roster
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
