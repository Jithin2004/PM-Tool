import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Shield, Terminal, Lock, X, AlertTriangle, Download, Settings, Users, ArrowRight, Sliders, Calendar, Search, Check, BrainCircuit, Info, Calculator, TrendingDown, Banknote, Edit2, Truck, Cpu, Layers, Clock } from 'lucide-react';
import { User, Project, Team, Profile, Task } from '../../types';
import { getLocalDateString } from '../../utils/timeUtils';

export function LogisticsDashboard({
  profiles,
  teams,
  projects = [],
  tasks = [],
  updateTask,
  systemData,
  onSaveData,
  role,
  defaultTab,
  hideTabs
}: {
  profiles: Profile[],
  teams: Team[],
  projects?: Project[],
  tasks?: Task[],
  updateTask?: (taskId: string, updates: Partial<Task>) => Promise<void>,
  systemData: any,
  onSaveData: (updatedData: any) => Promise<void>,
  role?: string,
  defaultTab?: 'attendance' | 'paySlab' | 'payroll' | 'orchestration',
  hideTabs?: boolean
}) {
  // systemData is passed from canonical DashboardContext
  const [activeTab, setActiveTab] = useState<'attendance' | 'paySlab' | 'payroll' | 'orchestration'>(defaultTab || 'orchestration');
  const isSuperAdmin = role === 'super_admin';

  // Attendance states
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [attendanceSearch, setAttendanceSearch] = useState('');

  // Pay Slab form states
  const [allowedCasualLeaves, setAllowedCasualLeaves] = useState(2);
  const [allowedMedicalLeaves, setAllowedMedicalLeaves] = useState(2);
  const [halfDayRule, setHalfDayRule] = useState(2);
  const [unexcusedDeductionAmount, setUnexcusedDeductionAmount] = useState(100);
  const [deductionMethod, setDeductionMethod] = useState<'fixed' | 'pro_rata'>('fixed');
  const [currency, setCurrency] = useState<'USD' | 'INR' | 'EUR' | 'CAD' | 'AED'>('USD');
  const [bypassHalfDay, setBypassHalfDay] = useState(false);

  // Dispatch/Orchestration States
  const [routingTaskId, setRoutingTaskId] = useState<string | null>(null);
  const [routingTaskSearch, setRoutingTaskSearch] = useState('');

  const currencySymbols: Record<string, string> = {
    USD: '$',
    INR: '₹',
    EUR: '€',
    CAD: 'C$',
    AED: 'د.إ'
  };

  const activeSymbol = currencySymbols[currency] || '$';

  // Payroll states
  const [payrollMode, setPayrollMode] = useState<'monthly' | 'custom'>('monthly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return (today.getMonth() + 1).toString().padStart(2, '0');
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const today = new Date();
    return today.getFullYear().toString();
  });
  const [editingSalaryUserId, setEditingSalaryUserId] = useState<string | null>(null);
  const [editingSalaryValue, setEditingSalaryValue] = useState('');

  // Sync state values when DB systemData updates
  useEffect(() => {
    if (systemData.paySlab) {
      setAllowedCasualLeaves(systemData.paySlab.allowedCasualLeaves ?? 2);
      setAllowedMedicalLeaves(systemData.paySlab.allowedMedicalLeaves ?? 2);
      setHalfDayRule(systemData.paySlab.halfDayRule ?? 2);
      setUnexcusedDeductionAmount(systemData.paySlab.unexcusedDeductionAmount ?? 100);
      setDeductionMethod(systemData.paySlab.deductionMethod ?? 'fixed');
      setCurrency(systemData.paySlab.currency ?? 'USD');
      setBypassHalfDay(systemData.paySlab.bypassHalfDay ?? false);
    }
  }, [systemData]);

  // Calculations for deductions and net payroll
  const monthPrefix = `${selectedYear}-${selectedMonth}`;
  const attendanceRecords = systemData.attendance || {};

  // Orchestration & Dispatch calculations
  const orchestrationMetrics = useMemo(() => {
    const activeTasks = tasks.filter(t => t.status !== 'done');
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const completedTasks = tasks.filter(t => t.status === 'done');
    const dispatchRate = completedTasks.length > 0 ? Number((completedTasks.length / Math.max(1, tasks.length) * 100).toFixed(1)) : 76.5;

    // Route Congestion: average in-progress tasks per active developer
    const devs = profiles.filter(p => p.role === 'developer');
    const congestion = devs.length > 0 ? Number((inProgressTasks.length / devs.length).toFixed(1)) : 0;
    
    // Escalation Index: high priority active tasks
    const escalationCount = activeTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length;
    
    // Pipeline Latency: average estimated hours of uncompleted tasks
    const totalEstHours = activeTasks.reduce((acc, t) => acc + (Number(t.estimated_hours) || 0), 0);
    const latency = activeTasks.length > 0 ? Math.round(totalEstHours / activeTasks.length) : 0;

    return {
      dispatchRate,
      congestion,
      escalationCount,
      latency
    };
  }, [tasks, profiles]);

  // Backlog/Ready queue to route
  const dispatchQueue = useMemo(() => {
    return tasks
      .filter(t => (t.status === 'backlog' || t.status === 'ready' || !t.assignee_id))
      .filter(t => t.name.toLowerCase().includes(routingTaskSearch.toLowerCase()))
      .map(t => {
        const projName = projects.find(p => p.id === t.project_id)?.name || 'Global Context';
        return { ...t, projectName: projName };
      });
  }, [tasks, projects, routingTaskSearch]);

  // Execution Nodes
  const executionNodes = useMemo(() => {
    const devs = profiles.filter(p => p.role === 'developer' || p.role === 'pm');
    return devs.map(dev => {
      const devTasks = tasks.filter(t => t.assignee_id === dev.id && t.status !== 'done');
      const loadHours = devTasks.reduce((acc, t) => acc + (Number(t.estimated_hours) || 0), 0);
      const capacity = 40; // 40h standard limit
      const utilization = Math.min(150, Math.round((loadHours / capacity) * 100));

      return {
        ...dev,
        name: dev.full_name || dev.email.split('@')[0],
        devTasks,
        loadHours,
        utilization,
        status: utilization > 100 ? 'overload' : utilization > 70 ? 'active' : devTasks.length > 0 ? 'focus' : 'standby'
      };
    });
  }, [profiles, tasks]);

  // Blocked routing warning nodes
  const routingBottlenecks = useMemo(() => {
    return tasks.filter(t => t.status !== 'done' && t.risk === 'high').map(t => {
      const projName = projects.find(p => p.id === t.project_id)?.name || 'Global Project';
      return {
        id: t.id,
        name: t.name,
        projectName: projName,
        priority: t.priority,
        hours: t.estimated_hours
      };
    });
  }, [tasks, projects]);

  const handleRouteTask = async (taskId: string, devId: string) => {
    if (!updateTask) return;
    try {
      await updateTask(taskId, { assignee_id: devId, status: 'in_progress' });
      setRoutingTaskId(null);
    } catch (err) {
      console.error("Routing execution failed:", err);
    }
  };

  const handleAutoBalance = async () => {
    if (!updateTask) return;
    // Find overloaded developers and move some backlog tasks to underloaded developers
    const overloadedDevs = executionNodes.filter(n => n.utilization > 100);
    const underloadedDevs = executionNodes.filter(n => n.utilization < 70);

    if (overloadedDevs.length === 0 || underloadedDevs.length === 0) {
      alert("System load balancing criteria optimal. No actions dispatched.");
      return;
    }

    let balancedCount = 0;
    for (const source of overloadedDevs) {
      const target = underloadedDevs[0];
      const reassignable = source.devTasks.find(t => t.status === 'backlog' || t.status === 'ready');
      if (reassignable && target) {
        await updateTask(reassignable.id, { assignee_id: target.id });
        balancedCount++;
      }
    }
    alert(`Orchestration complete: re-routed ${balancedCount} tasks to balance developer loads.`);
  };

  const payrollData = useMemo(() => {
    const defaultCasual = allowedCasualLeaves;
    const defaultMedical = allowedMedicalLeaves;
    const defaultHalfDayRatio = halfDayRule;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    const targetYear = Number(selectedYear);
    const targetMonth = Number(selectedMonth);

    let isDateInRange = (dateStr: string) => dateStr.startsWith(monthPrefix);

    const allWeekdaysInRange: string[] = [];

    if (payrollMode === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      if (start <= end) {
        let current = new Date(start);
        while (current <= end) {
          const dayOfWeek = current.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            allWeekdaysInRange.push(getLocalDateString(current));
          }
          current.setDate(current.getDate() + 1);
        }
      }
      isDateInRange = (dateStr: string) => dateStr >= customStartDate && dateStr <= customEndDate;
    } else {
      const startYear = Number(selectedYear);
      const startMonth = Number(selectedMonth);

      let lastDay = 0;
      if (startYear < currentYear || (startYear === currentYear && startMonth < currentMonth)) {
        // Past month: full month
        lastDay = new Date(startYear, startMonth, 0).getDate();
      } else if (startYear === currentYear && startMonth === currentMonth) {
        // Current month: up to current day
        lastDay = currentDay;
      }

      for (let d = 1; d <= lastDay; d++) {
        const dateObj = new Date(startYear, startMonth - 1, d);
        const dayOfWeek = dateObj.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          allWeekdaysInRange.push(getLocalDateString(dateObj));
        }
      }
    }

    return profiles.map(profile => {
      const baseSalary = systemData.salaries?.[profile.id] ?? 3000;
      const joiningDateStr = profile.created_at ? getLocalDateString(new Date(profile.created_at)) : '';
      
      // Filter weekdays to only those on or after joining date
      const profileWeekdays = allWeekdaysInRange.filter(dateStr => !joiningDateStr || dateStr >= joiningDateStr);
      const expectedWorkingDaysForProfile = profileWeekdays.length;

      let presentCount = 0;
      let halfDayCount = 0;
      let clCount = 0;
      let mlCount = 0;
      let uuCount = 0;
      let unpaidHalfDayCount = 0;

      Object.keys(attendanceRecords).forEach(dateStr => {
        if (isDateInRange(dateStr) && (!joiningDateStr || dateStr >= joiningDateStr)) {
          const dayData = attendanceRecords[dateStr]?.[profile.id];
          if (dayData) {
            if (dayData.status === 'present') {
              presentCount++;
            } else if (dayData.status === 'half_day') {
              halfDayCount++;
              if (dayData.leaveType === 'casual') {
                clCount += 0.5;
              } else if (dayData.leaveType === 'medical') {
                mlCount += 0.5;
              } else if (dayData.isPaidHalfDay) {
                // Paid half day (empathy bypass) - fully paid, no CL/ML or unpaid deductions
              } else {
                unpaidHalfDayCount++;
              }
            } else if (dayData.status === 'absent') {
              if (dayData.leaveType === 'casual') clCount++;
              else if (dayData.leaveType === 'medical') mlCount++;
              else uuCount++;
            }
          }
        }
      });

      const totalDaysAccounted = Object.keys(attendanceRecords).reduce((acc, dateStr) => {
        if (isDateInRange(dateStr) && (!joiningDateStr || dateStr >= joiningDateStr) && attendanceRecords[dateStr]?.[profile.id]) {
          return acc + 1;
        }
        return acc;
      }, 0);

      const unmarkedWorkingDays = Math.max(0, expectedWorkingDaysForProfile - totalDaysAccounted);

      // Unmarked days count as present by default
      presentCount += unmarkedWorkingDays;

      const halfDayLeavesConverted = unpaidHalfDayCount / defaultHalfDayRatio;
      const casualExceeded = Math.max(0, clCount - defaultCasual);
      const medicalExceeded = Math.max(0, mlCount - defaultMedical);
      const totalUnpaidDays = casualExceeded + medicalExceeded + halfDayLeavesConverted + uuCount;

      let totalDeductions = 0;
      if (totalUnpaidDays > 0) {
        if (deductionMethod === 'fixed') {
          totalDeductions = totalUnpaidDays * unexcusedDeductionAmount;
        } else {
          const dailyRate = baseSalary / 22;
          totalDeductions = totalUnpaidDays * dailyRate;
        }
      }

      const netPayable = Math.max(0, baseSalary - totalDeductions);

      return {
        profile,
        baseSalary,
        presentCount,
        halfDayCount,
        clCount,
        mlCount,
        uuCount,
        totalUnpaidDays,
        totalDeductions,
        netPayable,
        expectedWorkingDays: expectedWorkingDaysForProfile
      };
    });
  }, [profiles, systemData, monthPrefix, allowedCasualLeaves, allowedMedicalLeaves, halfDayRule, unexcusedDeductionAmount, deductionMethod, bypassHalfDay, payrollMode, customStartDate, customEndDate]);

  const handleExportCSV = () => {
    const totalGross = payrollData.reduce((sum, item) => sum + item.baseSalary, 0);
    const totalDeductions = payrollData.reduce((sum, item) => sum + item.totalDeductions, 0);
    const totalNet = payrollData.reduce((sum, item) => sum + item.netPayable, 0);

    const headers = [
      'System Profile', 'Base Salary', 'Present Days', 'Half Days',
      'Casual Leaves', 'Medical Leaves', 'Unexcused',
      'Total Unpaid Days', 'Total Deductions', 'Net Payable'
    ];

    const rows = payrollData.map(d => [
      d.profile.full_name || d.profile.email || 'Unknown',
      d.baseSalary.toFixed(2),
      d.presentCount.toFixed(1),
      d.halfDayCount.toString(),
      d.clCount.toFixed(1),
      d.mlCount.toFixed(1),
      d.uuCount.toString(),
      d.totalUnpaidDays.toFixed(1),
      d.totalDeductions.toFixed(2),
      d.netPayable.toFixed(2)
    ]);

    rows.push([]);
    rows.push(['AGGREGATE TOTALS', '', '', '', '', '', '', '', '', '']);
    rows.push(['Total Gross Liability', totalGross.toFixed(2), '', '', '', '', '', '', '', '']);
    rows.push(['Total Deductions', totalDeductions.toFixed(2), '', '', '', '', '', '', '', '']);
    rows.push(['Total Net Payable', totalNet.toFixed(2), '', '', '', '', '', '', '', '']);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    let filename = '';
    if (payrollMode === 'monthly') {
      const monthName = new Date(`${selectedYear}-${selectedMonth}-01`).toLocaleString('default', { month: 'long' });
      filename = `Payroll_Analytics_${monthName}_${selectedYear}.csv`;
    } else {
      filename = `Payroll_Analytics_Custom_${customStartDate}_to_${customEndDate}.csv`;
    }

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMarkAttendance = async (
    userId: string,
    status: 'present' | 'half_day' | 'absent',
    leaveType?: 'casual' | 'medical' | 'unexcused',
    isPaidHalfDay?: boolean
  ) => {
    const existingAttendance = systemData.attendance || {};
    const dayRecords = { ...(existingAttendance[selectedDate] || {}) };

    if (status === 'absent') {
      dayRecords[userId] = { status, leaveType: leaveType || 'unexcused' };
    } else if (status === 'half_day') {
      dayRecords[userId] = {
        status,
        leaveType: leaveType || 'unexcused',
        isPaidHalfDay: !!isPaidHalfDay
      };
    } else {
      dayRecords[userId] = { status };
    }

    const updatedAttendance = {
      ...existingAttendance,
      [selectedDate]: dayRecords
    };

    await onSaveData({
      ...systemData,
      attendance: updatedAttendance
    });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedPaySlab = {
      allowedCasualLeaves,
      allowedMedicalLeaves,
      halfDayRule,
      unexcusedDeductionAmount,
      deductionMethod,
      currency,
      bypassHalfDay
    };

    await onSaveData({
      ...systemData,
      paySlab: updatedPaySlab
    });
  };

  const handleSaveSalary = async (userId: string) => {
    const existingSalaries = systemData.salaries || {};
    const updatedSalaries = {
      ...existingSalaries,
      [userId]: Number(editingSalaryValue) || 0
    };

    await onSaveData({
      ...systemData,
      salaries: updatedSalaries
    });
    setEditingSalaryUserId(null);
  };

  // Filter profiles for attendance marking
  const filteredProfiles = profiles.filter(p => {
    const joiningDateStr = p.created_at ? getLocalDateString(new Date(p.created_at)) : '';
    if (joiningDateStr && selectedDate < joiningDateStr) {
      return false; // Not yet onboarded on selectedDate
    }
    const searchLower = attendanceSearch.toLowerCase();
    return (
      (p.full_name || '').toLowerCase().includes(searchLower) ||
      p.email.toLowerCase().includes(searchLower)
    );
  });

  // Calculate day summary stats
  const dayAttendance = attendanceRecords[selectedDate] || {};
  const dayStats = useMemo(() => {
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    profiles.forEach(p => {
      const joiningDateStr = p.created_at ? getLocalDateString(new Date(p.created_at)) : '';
      if (joiningDateStr && selectedDate < joiningDateStr) {
        return; // Skip not yet onboarded
      }
      const dayData = dayAttendance[p.id];
      if (dayData) {
        if (dayData.status === 'present') present++;
        else if (dayData.status === 'half_day') halfDay++;
        else if (dayData.status === 'absent') absent++;
      } else {
        // Default to present for unmarked profiles
        present++;
      }
    });
    return { present, halfDay, absent };
  }, [dayAttendance, profiles, selectedDate]);

  return (
    <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12 pb-16">
      {/* Visual Section Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12 border-b border-white/10 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Truck className="w-5 h-5 text-indigo-400" />
            <h2 className="text-3xl font-medium tracking-tight uppercase">Logistics Orchestration Control</h2>
          </div>
          <p className="text-sm font-mono text-white/70">
            Real-time payload routing, pipeline congestion analysis, execution node monitoring, and load balancing constraints.
          </p>
        </div>

        {/* Tab Selector */}
        {!hideTabs && (
        <div className="flex overflow-x-auto scrollbar-none bg-white/5 p-1 border border-white/5 rounded-sm w-full md:w-auto max-w-full" role="tablist" aria-label="Logistics sections">
          <button
            onClick={() => setActiveTab('orchestration')}
            role="tab"
            aria-selected={activeTab === 'orchestration'}
            aria-controls="tabpanel-orchestration"
            id="tab-orchestration"
            className={`flex-1 md:flex-initial text-center whitespace-nowrap px-3 sm:px-4 py-2 text-[9px] sm:text-[10px] font-mono uppercase tracking-widest transition-all ${activeTab === 'orchestration' ? 'bg-white text-black font-semibold' : 'text-white/60 hover:text-white'}`}
          >
            Dispatch &amp; Routing
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            role="tab"
            aria-selected={activeTab === 'attendance'}
            aria-controls="tabpanel-attendance"
            id="tab-attendance"
            className={`flex-1 md:flex-initial text-center whitespace-nowrap px-3 sm:px-4 py-2 text-[9px] sm:text-[10px] font-mono uppercase tracking-widest transition-all ${activeTab === 'attendance' ? 'bg-white text-black font-semibold' : 'text-white/60 hover:text-white'}`}
          >
            Attendance
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('paySlab')}
              role="tab"
              aria-selected={activeTab === 'paySlab'}
              aria-controls="tabpanel-paySlab"
              id="tab-paySlab"
              className={`flex-1 md:flex-initial text-center whitespace-nowrap px-3 sm:px-4 py-2 text-[9px] sm:text-[10px] font-mono uppercase tracking-widest transition-all ${activeTab === 'paySlab' ? 'bg-white text-black font-semibold' : 'text-white/60 hover:text-white'}`}
            >
              Rules &amp; Slabs
            </button>
          )}
          <button
            onClick={() => setActiveTab('payroll')}
            role="tab"
            aria-selected={activeTab === 'payroll'}
            aria-controls="tabpanel-payroll"
            id="tab-payroll"
            className={`flex-1 md:flex-initial text-center whitespace-nowrap px-3 sm:px-4 py-2 text-[9px] sm:text-[10px] font-mono uppercase tracking-widest transition-all ${activeTab === 'payroll' ? 'bg-white text-black font-semibold' : 'text-white/60 hover:text-white'}`}
          >
            Payroll Compliance
          </button>
        </div>
        )}
      </div>

      {/* Tab Contents */}
      <AnimatePresence mode="wait">
        {activeTab === 'orchestration' && (
          <motion.div
            key="orchestration"
            role="tabpanel"
            id="tabpanel-orchestration"
            aria-labelledby="tab-orchestration"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Real-time Logistics Telemetry Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="border border-white/10 bg-[#0c0c0c] p-5 rounded-sm">
                <p className="text-[9px] font-mono uppercase text-white/50 tracking-widest mb-1">Queue Congestion</p>
                <p className="text-2xl font-mono text-indigo-400 font-bold">{orchestrationMetrics.congestion} tasks/node</p>
              </div>
              <div className="border border-white/10 bg-[#0c0c0c] p-5 rounded-sm">
                <p className="text-[9px] font-mono uppercase text-white/50 tracking-widest mb-1">Dispatch Rate</p>
                <p className="text-2xl font-mono text-cyan-400 font-bold">{orchestrationMetrics.dispatchRate}%</p>
              </div>
              <div className="border border-white/10 bg-[#0c0c0c] p-5 rounded-sm">
                <p className="text-[9px] font-mono uppercase text-white/50 tracking-widest mb-1">Pipeline Latency</p>
                <p className="text-2xl font-mono text-purple-400 font-bold">~{orchestrationMetrics.latency}h/task</p>
              </div>
              <div className="border border-white/10 bg-[#0c0c0c] p-5 rounded-sm">
                <p className="text-[9px] font-mono uppercase text-white/50 tracking-widest mb-1">Escalation Index</p>
                <p className="text-2xl font-mono text-rose-400 font-bold">{orchestrationMetrics.escalationCount} anomalies</p>
              </div>
            </div>

            {/* Core dispatch layout: Queue list and node board */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Backlog dispatch queue */}
              <div className="lg:col-span-1 border border-white/10 bg-[#0c0c0c] p-5 rounded-sm flex flex-col justify-between h-[34rem]">
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-white/5">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Dispatch Queue</h4>
                      <p className="text-[8px] font-mono text-white/40 uppercase">Unassigned payload backlog</p>
                    </div>
                    <span className="text-[9px] font-mono bg-white/5 px-2 py-0.5 border border-white/5 text-white/60">
                      {dispatchQueue.length} queued
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/45" />
                    <input
                      type="text"
                      placeholder="Query queue..."
                      value={routingTaskSearch}
                      onChange={e => setRoutingTaskSearch(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 h-8 pl-8 pr-3 text-[11px] font-mono text-white outline-none focus:border-indigo-400/40 rounded-sm"
                    />
                  </div>

                  <div className="space-y-2 overflow-y-auto max-h-[22rem] pr-1">
                    {dispatchQueue.length === 0 ? (
                      <div className="py-20 text-center text-[10px] font-mono uppercase text-white/40 italic">
                        No unallocated payloads detected
                      </div>
                    ) : (
                      dispatchQueue.map(task => (
                        <div key={task.id} className="p-3 border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] rounded-sm space-y-2 relative transition-all">
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-[10px] font-semibold text-white/95 truncate block w-40">{task.name}</span>
                            <span className={`text-[7px] font-extrabold px-1 border rounded-sm uppercase ${task.priority === 'urgent' || task.priority === 'high' ? 'border-rose-500/20 bg-rose-500/10 text-rose-400' : 'border-white/5 bg-white/5 text-white/40'}`}>
                              {task.priority}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center text-[8px] font-mono text-white/40 uppercase">
                            <span>Project: {task.projectName}</span>
                            <span>Weight: {task.estimated_hours}h</span>
                          </div>

                          <div className="pt-2 border-t border-white/5 flex gap-2">
                            <button
                              onClick={() => setRoutingTaskId(routingTaskId === task.id ? null : task.id)}
                              className="flex-1 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[9px] uppercase tracking-widest transition-all rounded-sm"
                            >
                              {routingTaskId === task.id ? 'Cancel Routing' : 'Route Dispatch'}
                            </button>
                          </div>

                          {/* Quick Router drop-panel */}
                          {routingTaskId === task.id && (
                            <div className="mt-2 p-2 bg-black border border-white/10 rounded-sm space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                              <p className="text-[7.5px] font-mono text-white/40 uppercase tracking-widest mb-1">Target dispatch node</p>
                              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                {executionNodes.map(node => (
                                  <button
                                    key={node.id}
                                    onClick={() => handleRouteTask(task.id, node.id)}
                                    className="w-full text-left p-1.5 border border-white/5 hover:border-indigo-400/30 bg-white/5 hover:bg-indigo-900/10 rounded-sm text-[9px] font-mono text-white/80 hover:text-white flex justify-between items-center"
                                  >
                                    <span className="truncate w-24 font-bold">{node.name}</span>
                                    <span className="text-[8px] text-white/40 font-semibold">{node.utilization}% load ({node.devTasks.length} tasks)</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="border-t border-white/5 pt-3">
                  <button
                    onClick={handleAutoBalance}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[9px] font-mono uppercase tracking-widest transition-all rounded-sm flex items-center justify-center gap-2"
                  >
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" /> Auto-Balance System Load
                  </button>
                </div>
              </div>

              {/* Execution nodes map */}
              <div className="lg:col-span-2 border border-white/10 bg-[#0c0c0c] p-5 rounded-sm h-[34rem] overflow-y-auto space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Execution Nodes</h4>
                    <p className="text-[8px] font-mono text-white/40 uppercase">Developer queue load status</p>
                  </div>
                  <span className="text-[9px] font-mono text-white/40 uppercase">Standard Limit: 40h</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {executionNodes.map(node => {
                    const barColors = {
                      overload: 'bg-rose-500',
                      active: 'bg-amber-500',
                      focus: 'bg-indigo-500',
                      standby: 'bg-white/10'
                    };

                    const textColors = {
                      overload: 'text-rose-400 font-bold',
                      active: 'text-amber-400',
                      focus: 'text-indigo-400',
                      standby: 'text-white/40'
                    };

                    return (
                      <div key={node.id} className="border border-white/5 bg-black/30 p-4 rounded-sm space-y-3 flex flex-col justify-between font-mono text-[10px]">
                        <div className="flex justify-between items-start border-b border-white/5 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white/90">{node.name}</span>
                            <span className="text-[8px] uppercase text-white/40">({node.role})</span>
                          </div>
                          <span className={`text-[9px] uppercase ${textColors[node.status]}`}>{node.status}</span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] text-white/50 uppercase">
                            <span>Capacity Load</span>
                            <span>{node.loadHours}h / 40h ({node.utilization}%)</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full ${barColors[node.status]} transition-all`} style={{ width: `${node.utilization}%` }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[8px] text-white/40 uppercase block">Active Dispatch Queue</span>
                          {node.devTasks.length === 0 ? (
                            <span className="text-[8.5px] italic text-white/30 uppercase">Standby: Awaiting dispatch</span>
                          ) : (
                            <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                              {node.devTasks.map(t => (
                                <div key={t.id} className="p-1 border border-white/5 bg-white/5 flex justify-between items-center rounded-sm text-[8px] text-white/70">
                                  <span className="truncate w-32 font-medium">{t.name}</span>
                                  <span className="text-white/40 uppercase">{t.status}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </motion.div>
        )}
        {activeTab === 'attendance' && (
          <motion.div
            key="attendance"
            role="tabpanel"
            id="tabpanel-attendance"
            aria-labelledby="tab-attendance"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Header controls for Attendance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center bg-[#0c0c0c] border border-white/10 p-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/50">Tracking Target Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-white/10 h-11 pl-10 pr-4 text-sm font-mono text-white focus:border-white/30 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/50">Query Profiles</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={attendanceSearch}
                    onChange={(e) => setAttendanceSearch(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-white/10 h-11 pl-10 pr-4 text-sm font-mono text-white focus:border-white/30 outline-none transition-all placeholder:text-white/40"
                  />
                </div>
              </div>

              {/* Day stats counters */}
              <div className="flex gap-4 items-center justify-between border-t border-white/5 lg:border-t-0 lg:border-l lg:border-white/10 pt-4 lg:pt-0 lg:pl-8 h-full">
                <div className="text-center flex-1">
                  <p className="text-[9px] font-mono text-white/50 uppercase tracking-widest mb-1">PRESENT</p>
                  <p className="text-2xl font-bold text-green-400 font-mono">{dayStats.present}</p>
                </div>
                <div className="h-8 w-[1px] bg-white/5"></div>
                <div className="text-center flex-1">
                  <p className="text-[9px] font-mono text-white/50 uppercase tracking-widest mb-1">HALF DAY</p>
                  <p className="text-2xl font-bold text-yellow-400 font-mono">{dayStats.halfDay}</p>
                </div>
                <div className="h-8 w-[1px] bg-white/5"></div>
                <div className="text-center flex-1">
                  <p className="text-[9px] font-mono text-white/50 uppercase tracking-widest mb-1">ABSENT</p>
                  <p className="text-2xl font-bold text-red-500 font-mono">{dayStats.absent}</p>
                </div>
              </div>
            </div>

            {/* Attendance Marking Grid */}
            <div className="border border-white/10 bg-[#0c0c0c] overflow-hidden">
              <div className="p-6 border-b border-white/10 bg-[#0a0a0a] flex justify-between items-center">
                <h3 className="text-xs font-mono uppercase tracking-widest text-white/90">Mark System Attendance</h3>
                <span className="text-[9px] font-mono text-white/50 bg-white/5 px-2 py-0.5 border border-white/5 uppercase">TELEMETRY_ONLINE</span>
              </div>

              <div className="divide-y divide-white/5">
                {filteredProfiles.length === 0 ? (
                  <div className="p-12 text-center text-xs font-mono text-white/50 italic">
                    No active system profiles match your search criteria.
                  </div>
                ) : (
                  filteredProfiles.map(profile => {
                    const record = dayAttendance[profile.id];
                    const status = record?.status || 'present';
                    const leaveType = record?.leaveType;

                    return (
                      <div key={profile.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/[0.01] transition-all">
                        {/* User Details */}
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
                            {profile.avatar_url ? (
                              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-5 h-5 text-white/40" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-white/90">{profile.full_name || 'Anonymous User'}</h4>
                              {profile.created_at && (
                                <span className="text-[8px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-sm" title="Date of Joining">
                                  DOJ: {getLocalDateString(new Date(profile.created_at))}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-mono text-white/60 uppercase">{profile.email}</p>
                            <p className="text-[9px] font-mono mt-1"><span className="text-white/40 uppercase">Role:</span> <span className="text-blue-400 uppercase">{(systemData.userCustomRoles && systemData.userCustomRoles[profile.id]) || profile.role}</span></p>
                          </div>
                        </div>

                        {/* Status marking controls */}
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                          {/* Present button */}
                          <button
                            onClick={() => handleMarkAttendance(profile.id, 'present')}
                            className={`w-full sm:w-auto px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider border rounded-sm transition-all ${status === 'present' ? 'bg-green-500/20 border-green-500 text-green-400 font-bold shadow-[0_0_10px_rgba(34,197,94,0.15)]' : 'border-white/10 hover:border-white/20 text-white/60 hover:text-white'}`}
                          >
                            Present
                          </button>

                          {/* Half Day split options */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-black/40 border border-white/10 p-1 gap-1 sm:gap-0 w-full sm:w-auto">
                            <button
                              onClick={() => handleMarkAttendance(profile.id, 'half_day', 'unexcused', false)}
                              className={`px-2.5 py-1.5 sm:py-1 text-[9px] font-mono uppercase tracking-wider transition-all ${status === 'half_day' && leaveType === 'unexcused' && !record?.isPaidHalfDay ? 'bg-yellow-500/20 text-yellow-400 font-bold' : 'text-white/50 hover:text-white'}`}
                            >
                              Half Day (Unpaid)
                            </button>
                            <div className="hidden sm:block w-[1px] h-4 bg-white/10 mx-1"></div>

                            <button
                              onClick={() => handleMarkAttendance(profile.id, 'half_day', 'unexcused', true)}
                              className={`px-2.5 py-1.5 sm:py-1 text-[9px] font-mono uppercase tracking-wider transition-all ${status === 'half_day' && record?.isPaidHalfDay ? 'bg-green-500/20 text-green-400 font-bold' : 'text-white/50 hover:text-white'}`}
                            >
                              Half Day (Paid)
                            </button>
                            <div className="w-[1px] h-4 bg-white/10 mx-1" style={{ display: 'none' }}></div>

                            <button
                              onClick={() => handleMarkAttendance(profile.id, 'half_day', 'casual', false)} style={{ display: 'none' }}
                              className={`px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider transition-all ${status === 'half_day' && leaveType === 'casual' ? 'bg-blue-500/20 text-blue-400 font-bold' : 'text-white/50 hover:text-white'}`}
                            >

                            </button>
                            <div className="w-[1px] h-4 bg-white/10 mx-1 font-mono" style={{ display: 'none' }}></div>

                            <button
                              onClick={() => handleMarkAttendance(profile.id, 'half_day', 'medical', false)} style={{ display: 'none' }}
                              className={`px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider transition-all ${status === 'half_day' && leaveType === 'medical' ? 'bg-purple-500/20 text-purple-400 font-bold' : 'text-white/50 hover:text-white'}`}
                            >

                            </button>
                          </div>
                          {/* HIDE_OLD_BUTTON_START */}
                          <button style={{ display: 'none' }}
                            onClick={() => handleMarkAttendance(profile.id, 'half_day')}
                            className={`px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider border rounded-sm transition-all ${status === 'half_day' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400 font-bold shadow-[0_0_10px_rgba(234,179,8,0.15)]' : 'border-white/10 hover:border-white/20 text-white/60 hover:text-white'}`}
                          >
                            Half Day
                          </button>

                          {/* Absent Option split */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-black/40 border border-white/10 p-1 gap-1 sm:gap-0 w-full sm:w-auto">
                            <button
                              onClick={() => handleMarkAttendance(profile.id, 'absent', 'unexcused')}
                              className={`px-2.5 py-1.5 sm:py-1 text-[9px] font-mono uppercase tracking-wider transition-all ${status === 'absent' && leaveType === 'unexcused' ? 'bg-red-500/20 text-red-500 font-bold' : 'text-white/50 hover:text-white'}`}
                            >
                              Absent (Unpaid)
                            </button>
                            <div className="hidden sm:block w-[1px] h-4 bg-white/10 mx-1 font-mono"></div>

                            <button
                              onClick={() => handleMarkAttendance(profile.id, 'absent', 'casual')}
                              className={`px-2.5 py-1.5 sm:py-1 text-[9px] font-mono uppercase tracking-wider transition-all ${status === 'absent' && leaveType === 'casual' ? 'bg-blue-500/20 text-blue-400 font-bold' : 'text-white/50 hover:text-white'}`}
                            >
                              Casual Leave (CL)
                            </button>
                            <div className="hidden sm:block w-[1px] h-4 bg-white/10 mx-1"></div>

                            <button
                              onClick={() => handleMarkAttendance(profile.id, 'absent', 'medical')}
                              className={`px-2.5 py-1.5 sm:py-1 text-[9px] font-mono uppercase tracking-wider transition-all ${status === 'absent' && leaveType === 'medical' ? 'bg-purple-500/20 text-purple-400 font-bold' : 'text-white/50 hover:text-white'}`}
                            >
                              Medical Leave (ML)
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'paySlab' && (
          <motion.div
            key="paySlab"
            role="tabpanel"
            id="tabpanel-paySlab"
            aria-labelledby="tab-paySlab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Rules configurator Form */}
            <div className="lg:col-span-2 border border-white/10 bg-[#0c0c0c] p-8 space-y-6">
              <div className="border-b border-white/10 pb-4 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-mono uppercase tracking-widest text-white/90 font-semibold font-bold">Global System Pay Slabs</h3>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Casual Leaves */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-white/70">Allowed Paid Casual Leaves (CL) / Month</label>
                    <input
                      type="number"
                      required
                      value={allowedCasualLeaves}
                      onChange={(e) => setAllowedCasualLeaves(Number(e.target.value))}
                      min={0}
                      max={31}
                      className="w-full bg-[#0a0a0a] border border-white/10 h-11 px-4 text-sm font-mono text-white focus:border-white/30 outline-none"
                    />
                    <p className="text-[9px] font-mono text-white/40 italic">Allocated paid leave allowance per user. Exceeding days trigger deductions.</p>
                  </div>

                  {/* Medical Leaves */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-white/70">Allowed Paid Medical Leaves (ML) / Month</label>
                    <input
                      type="number"
                      required
                      value={allowedMedicalLeaves}
                      onChange={(e) => setAllowedMedicalLeaves(Number(e.target.value))}
                      min={0}
                      max={31}
                      className="w-full bg-[#0a0a0a] border border-white/10 h-11 px-4 text-sm font-mono text-white focus:border-white/30 outline-none"
                    />
                    <p className="text-[9px] font-mono text-white/40 italic">Allocated paid sick/medical leave. Excess days trigger deductions.</p>
                  </div>

                  {/* Half-day Conversion Rule */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-white/70">Half-Day Conversion Threshold</label>
                    <input
                      type="number"
                      required
                      value={halfDayRule}
                      onChange={(e) => setHalfDayRule(Number(e.target.value))}
                      min={1}
                      max={10}
                      className="w-full bg-[#0a0a0a] border border-white/10 h-11 px-4 text-sm font-mono text-white focus:border-white/30 outline-none"
                    />
                    <p className="text-[9px] font-mono text-white/40 italic">Specify how many marked Half-Day absences equal 1 Full-Day leave (e.g. 2 half-days = 1 full day).</p>
                  </div>

                  {/* Half-day Empathy Bypass Toggle */}
                  <div className="flex flex-col gap-2" style={{ display: 'none' }}>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-white/70">Half-Day Empathy Bypass</label>
                    <div className="flex items-center gap-3 bg-[#0a0a0a] border border-white/10 h-11 px-4">
                      <input
                        type="checkbox"
                        id="bypassHalfDay"
                        checked={bypassHalfDay}
                        onChange={(e) => setBypassHalfDay(e.target.checked)}
                        className="w-4 h-4 accent-white cursor-pointer"
                      />
                      <label htmlFor="bypassHalfDay" className="text-xs font-mono text-white/80 cursor-pointer select-none">
                        Bypass half-day pay deductions
                      </label>
                    </div>
                    <p className="text-[9px] font-mono text-white/40 italic">When enabled, employees will NOT have pay deducted for marked half-day leaves (showing empathy for genuine needs).</p>
                  </div>

                  {/* Currency Selector */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-white/70">Global System Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as any)}
                      className="w-full bg-[#0a0a0a] border border-white/10 h-11 px-4 text-sm font-mono text-white focus:border-white/30 outline-none"
                    >
                      <option value="USD">USD ($) - US Dollar</option>
                      <option value="INR">INR (₹) - Indian Rupee</option>
                      <option value="EUR">EUR (€) - Euro</option>
                      <option value="CAD">CAD (C$) - Canadian Dollar</option>
                      <option value="AED">AED (د.إ) - UAE Dirham</option>
                    </select>
                    <p className="text-[9px] font-mono text-white/40 italic">Set the primary currency used across salary listings, calculations, and deductions.</p>
                  </div>

                  {/* Deduction Method Selector */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-white/70">Leave Deduction Calculation Method</label>
                    <select
                      value={deductionMethod}
                      onChange={(e) => setDeductionMethod(e.target.value as any)}
                      className="w-full bg-[#0a0a0a] border border-white/10 h-11 px-4 text-sm font-mono text-white focus:border-white/30 outline-none"
                    >
                      <option value="fixed">Fixed Currency Value per Leave Day</option>
                      <option value="pro_rata">Daily Pro-Rata (Base Monthly Salary / 22 Working Days)</option>
                    </select>
                    <p className="text-[9px] font-mono text-white/40 italic">Choose whether unexcused leaves deduct a flat fee or calculate dynamic pro-rata daily wage cuts.</p>
                  </div>

                  {/* Fixed Amount input */}
                  {deductionMethod === 'fixed' && (
                    <div className="flex flex-col gap-2 md:col-span-2">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-white/70">Flat Deduction Value ({activeSymbol.trim()}) per Excess Leave</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-white/60">{activeSymbol}</span>
                        <input
                          type="number"
                          required
                          value={unexcusedDeductionAmount}
                          onChange={(e) => setUnexcusedDeductionAmount(Number(e.target.value))}
                          min={0}
                          className="w-full bg-[#0a0a0a] border border-white/10 h-11 pl-10 pr-4 text-sm font-mono text-white focus:border-white/30 outline-none"
                        />
                      </div>
                      <p className="text-[9px] font-mono text-white/40 italic">Configured deduction amount deducted from the user's monthly payload for each exceeding unexcused day.</p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-white/10 flex justify-end">
                  <button
                    type="submit"
                    className="bg-white text-black font-semibold text-[10px] font-mono uppercase tracking-widest px-8 py-3 hover:bg-neutral-200 transition-colors flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Save Slab System Configuration
                  </button>
                </div>
              </form>
            </div>

            {/* Quick Helper Rules Info panel */}
            <div className="border border-white/10 bg-[#0c0c0c] p-8 space-y-6">
              <div className="border-b border-white/10 pb-4 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-mono uppercase tracking-widest text-white/90 font-semibold font-bold">Formula Analytics</h3>
              </div>

              <div className="space-y-4 text-xs font-mono text-white/70 leading-relaxed">
                <p>
                  The payroll deduction calculation is computed in real-time using high-fidelity rules matching standard corporate infrastructure:
                </p>
                <div className="border border-white/10 bg-[#0a0a0a] p-4 text-[11px] space-y-2">
                  <p className="font-bold text-white">1. Total Unpaid Leave Days (LD):</p>
                  <p className="text-white/60">LD = Excess(CL) + Excess(ML) + (Half-Days / Threshold) + Unexcused Absences</p>

                  <p className="font-bold text-white pt-2">2. Daily Wage Rate (DR):</p>
                  <p className="text-white/60">DR = Base Salary / 22 (Industry average working days)</p>

                  <p className="font-bold text-white pt-2">3. Total Deductions:</p>
                  <p className="text-white/60">If Fixed Method: Deduct = LD * Flat Deduction Amount</p>
                  <p className="text-white/60">If Pro-Rata Method: Deduct = LD * DR</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 p-4 flex items-start gap-3">
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-blue-400/90">
                    Paid leave allocations are automatically assigned to all active user roles (both Project Managers and Developers/Viewers) inside the database.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'payroll' && (
          <motion.div
            key="payroll"
            role="tabpanel"
            id="tabpanel-payroll"
            aria-labelledby="tab-payroll"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Payroll filters */}
            <div className="flex flex-col md:flex-row gap-6 items-center bg-[#0c0c0c] border border-white/10 p-6 justify-between">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-widest text-white/90 font-semibold font-bold mb-1">Payroll Analytics</h3>
                <p className="text-[10px] font-mono text-white/50 uppercase">MONTHLY TEAM COMPENSATION COMPLIANCE</p>
              </div>

              <div className="flex flex-col xl:flex-row items-center gap-4">
                <select
                  value={payrollMode}
                  onChange={(e) => setPayrollMode(e.target.value as any)}
                  className="bg-[#0a0a0a] border border-white/10 h-10 px-4 text-xs font-mono text-white focus:border-white/30 outline-none"
                >
                  <option value="monthly">Monthly Cycle</option>
                  <option value="custom">Custom Range</option>
                </select>

                {payrollMode === 'monthly' ? (
                  <>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-[#0a0a0a] border border-white/10 h-10 px-4 text-xs font-mono text-white focus:border-white/30 outline-none"
                    >
                      <option value="01">January</option>
                      <option value="02">February</option>
                      <option value="03">March</option>
                      <option value="04">April</option>
                      <option value="05">May</option>
                      <option value="06">June</option>
                      <option value="07">July</option>
                      <option value="08">August</option>
                      <option value="09">September</option>
                      <option value="10">October</option>
                      <option value="11">November</option>
                      <option value="12">December</option>
                    </select>

                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="bg-[#0a0a0a] border border-white/10 h-10 px-4 text-xs font-mono text-white focus:border-white/30 outline-none"
                    >
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                    </select>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="bg-[#0a0a0a] border border-white/10 h-10 px-2 text-xs font-mono text-white focus:border-white/30 outline-none" />
                    <span className="text-white/50 text-xs font-mono">to</span>
                    <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="bg-[#0a0a0a] border border-white/10 h-10 px-2 text-xs font-mono text-white focus:border-white/30 outline-none" />
                  </div>
                )}

                <button
                  onClick={handleExportCSV}
                  className="bg-white text-black h-10 px-4 text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-neutral-200 transition-colors flex items-center gap-2 whitespace-nowrap ml-2"
                >
                  <Download className="w-3 h-3" /> Export CSV
                </button>
              </div>
            </div>

            {/* Payroll Aggregate Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#0c0c0c] border border-white/10 p-6 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Calculator className="w-16 h-16" /></div>
                <p className="text-[10px] font-mono uppercase text-white/50 tracking-widest mb-2 relative z-10">Total Gross Liability</p>
                <p className="text-2xl font-mono text-white font-bold relative z-10">{activeSymbol}{payrollData.reduce((sum, item) => sum + item.baseSalary, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-[#0c0c0c] border border-red-500/20 p-6 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-red-500"><TrendingDown className="w-16 h-16" /></div>
                <p className="text-[10px] font-mono uppercase text-red-400/80 tracking-widest mb-2 relative z-10">Total Deductions</p>
                <p className="text-2xl font-mono text-red-500 font-bold relative z-10">{activeSymbol}{payrollData.reduce((sum, item) => sum + item.totalDeductions, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 p-6 flex flex-col justify-center relative overflow-hidden shadow-[0_0_30px_rgba(34,197,94,0.1)]">
                <div className="absolute top-0 right-0 p-4 opacity-20 text-green-500"><Banknote className="w-16 h-16" /></div>
                <p className="text-[10px] font-mono uppercase text-green-400 tracking-widest mb-2 relative z-10">Total Net Payable</p>
                <p className="text-2xl font-mono text-white font-bold relative z-10">{activeSymbol}{payrollData.reduce((sum, item) => sum + item.netPayable, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            {/* Payroll Data Grid */}
            <div className="border border-white/10 bg-[#0c0c0c] overflow-hidden">
              <div className="p-6 border-b border-white/10 bg-[#0a0a0a] flex justify-between items-center">
                <h3 className="text-xs font-mono uppercase tracking-widest text-white/90 font-bold">Compiled Month Analytics Sheet</h3>
                <span className="text-[10px] font-mono text-white/50">Scope: {payrollMode === 'monthly' ? monthPrefix : `${customStartDate || 'TBD'} to ${customEndDate || 'TBD'}`}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02]">
                      <th className="p-4 text-[10px] font-mono uppercase tracking-wider text-white/50">System Profile</th>
                      <th className="p-4 text-[10px] font-mono uppercase tracking-wider text-white/50 text-right">Base Salary ({activeSymbol.trim()})</th>
                      <th className="p-4 text-[10px] font-mono uppercase tracking-wider text-white/50 text-center">Attendance Summary (Days)</th>
                      <th className="p-4 text-[10px] font-mono uppercase tracking-wider text-white/50 text-center">Leaves / Exceeded Allowed</th>
                      <th className="p-4 text-[10px] font-mono uppercase tracking-wider text-white/50 text-center font-bold text-red-500/90">Deductible Days</th>
                      <th className="p-4 text-[10px] font-mono uppercase tracking-wider text-white/50 text-right font-bold text-red-400">Total Deductions ({activeSymbol.trim()})</th>
                      <th className="p-4 text-[10px] font-mono uppercase tracking-wider text-white/50 text-right font-bold text-green-400">Net Payable ({activeSymbol.trim()})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {payrollData.map(({
                      profile,
                      baseSalary,
                      presentCount,
                      halfDayCount,
                      clCount,
                      mlCount,
                      uuCount,
                      totalUnpaidDays,
                      totalDeductions,
                      netPayable,
                      expectedWorkingDays
                    }) => {
                      const isEditing = editingSalaryUserId === profile.id;

                      return (
                        <tr key={profile.id} className="hover:bg-white/[0.01] transition-all">
                          {/* Profile */}
                          <td className="p-4 flex items-center gap-3">
                            <div className="w-8 h-8 border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                              {profile.avatar_url ? (
                                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                              ) : (
                                <Users className="w-4 h-4 text-white/40" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-semibold text-white/90">{profile.full_name || 'Anonymous User'}</h4>
                                {profile.created_at && (
                                  <span className="text-[7.5px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1 py-0.2 rounded-sm" title={`Joined: ${getLocalDateString(new Date(profile.created_at))}`}>
                                    DOJ: {getLocalDateString(new Date(profile.created_at))}
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px] font-mono text-white/50 uppercase">{profile.email}</p>
                            </div>
                          </td>

                          {/* Base Salary (Editable) */}
                          <td className="p-4 text-right">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5 justify-end">
                                <input
                                  type="number"
                                  value={editingSalaryValue}
                                  onChange={(e) => setEditingSalaryValue(e.target.value)}
                                  className="w-20 bg-black border border-white/20 px-2 py-1 text-xs font-mono text-right text-white focus:border-white/50 outline-none"
                                />
                                <button
                                  onClick={() => handleSaveSalary(profile.id)}
                                  className="p-1 border border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2 group/sal">
                                <span className="font-mono text-xs text-white/80">{activeSymbol}{baseSalary.toLocaleString()}</span>
                                <button
                                  onClick={() => {
                                    setEditingSalaryUserId(profile.id);
                                    setEditingSalaryValue(baseSalary.toString());
                                  }}
                                  className="opacity-0 group-hover/sal:opacity-100 p-1 hover:bg-white/5 text-white/60 hover:text-white transition-all"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Attendance */}
                          <td className="p-4 text-center">
                            <div className="flex flex-col items-center gap-1 font-mono">
                              <div className="flex items-center justify-center gap-2 text-[10px]">
                                <span className="bg-green-500/10 text-green-400 px-2 py-0.5 border border-green-500/15" title="Present Days">P: {presentCount}</span>
                                <span className="bg-yellow-500/10 text-yellow-400 px-2 py-0.5 border border-yellow-500/15" title="Half Days">HD: {halfDayCount}</span>
                                <span className="bg-red-500/10 text-red-400 px-2 py-0.5 border border-red-500/15" title="Unexcused Absences">UU: {uuCount}</span>
                              </div>
                              <span className="text-[8px] text-white/40 uppercase tracking-wider">Bandwidth: {expectedWorkingDays} working days</span>
                            </div>
                          </td>

                          {/* Leaves */}
                          <td className="p-4 text-center">
                            <div className="flex flex-col items-center justify-center gap-1 text-[9px] font-mono">
                              <div>
                                <span className="text-white/60">CL: {clCount}</span>
                                <span className="text-white/40"> / Allowed: {allowedCasualLeaves}</span>
                              </div>
                              <div>
                                <span className="text-white/60">ML: {mlCount}</span>
                                <span className="text-white/40"> / Allowed: {allowedMedicalLeaves}</span>
                              </div>
                            </div>
                          </td>

                          {/* Deductible Days */}
                          <td className="p-4 text-center font-bold font-mono text-xs text-red-400">
                            {totalUnpaidDays > 0 ? `${totalUnpaidDays.toFixed(1)} Days` : '0 Days'}
                          </td>

                          {/* Deductions */}
                          <td className="p-4 text-right font-mono text-xs text-red-500 font-bold">
                            {totalDeductions > 0 ? `-${activeSymbol}${totalDeductions.toFixed(2)}` : `${activeSymbol}0.00`}
                          </td>

                          {/* Net Payable */}
                          <td className="p-4 text-right font-mono text-xs text-green-400 font-bold">
                            {activeSymbol}{netPayable.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
