import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { attendanceEngine } from '../../core/engines/attendanceEngine';
import { leaveBalanceService } from '../../services/leaveBalanceService';
import { Clock, Calendar, Shield, Activity, UserCheck } from 'lucide-react';
import { showAlert } from '../../components/common/Dialogs';

export default function EmployeeDashboard() {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [dailyStatus, setDailyStatus] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [isClockedIn, setIsClockedIn] = useState(false);

  useEffect(() => {
    if (!workspace?.id || !profile?.id) return;
    loadData();
  }, [workspace?.id, profile?.id]);

  const loadData = async () => {
    if (!workspace?.id || !profile?.id) return;
    try {
      const status = await attendanceEngine.getDailyStatus(workspace.id, profile.id, new Date());
      setDailyStatus(status);
      
      const inEvent = status.filter(e => e.event_type === 'CLOCK_IN').pop();
      const outEvent = status.filter(e => e.event_type === 'CLOCK_OUT').pop();
      setIsClockedIn(inEvent && (!outEvent || outEvent.timestamp < inEvent.timestamp));

      // Load balances (Mock fetching multiple types for demo)
      const bal1 = await leaveBalanceService.getBalance(workspace.id, profile.id, 'Casual');
      const bal2 = await leaveBalanceService.getBalance(workspace.id, profile.id, 'Medical');
      setBalances([bal1, bal2].filter(Boolean));
    } catch (err) {
      console.error(err);
    }
  };

  const handleClockIn = async () => {
    setLoading(true);
    try {
      await attendanceEngine.clockIn(workspace!.id, profile!.id);
      await loadData();
      showAlert("Clocked in successfully.", { type: "success" });
    } catch (e: any) {
      showAlert(e.message, { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      await attendanceEngine.clockOut(workspace!.id, profile!.id);
      await loadData();
      showAlert("Clocked out successfully.", { type: "success" });
    } catch (e: any) {
      showAlert(e.message, { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestLeave = async () => {
    const reason = prompt("Enter reason for leave:");
    if (!reason) return;
    setLoading(true);
    try {
      const start = new Date();
      start.setDate(start.getDate() + 1); // Tomorrow
      const end = new Date(start);
      end.setDate(end.getDate() + 1); // 2 days

      await leaveBalanceService.requestLeave(workspace!.id, profile!.id, 'Casual', start, end, reason);
      showAlert("Leave requested successfully. Waiting for manager approval.", { type: "success" });
    } catch (e: any) {
      showAlert(e.message, { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-8 pb-16 font-geist p-6 bg-surface">
      <div className="flex items-end justify-between px-1 pt-2 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-accent-primary" /> My Operations
          </h1>
          <p className="text-sm mt-1 text-text-secondary">
            Manage attendance, capacity, and leave requests.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-border bg-surface-2">
          <span className={`w-2 h-2 rounded-full ${isClockedIn ? 'bg-signal-safe animate-pulse' : 'bg-text-tertiary'}`} />
          <span className="font-mono-pm text-xs uppercase tracking-widest text-text-secondary">
             {isClockedIn ? 'ON SHIFT' : 'OFF SHIFT'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Clock Center */}
        <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-primary">
            <Clock className="w-5 h-5 text-blue-400" /> Attendance Terminal
          </h2>
          <div className="flex gap-4">
            <button 
              onClick={handleClockIn}
              disabled={loading || isClockedIn}
              className="flex-1 py-4 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg font-bold disabled:opacity-50 hover:bg-emerald-500/20 transition-all"
            >
              CLOCK IN
            </button>
            <button 
              onClick={handleClockOut}
              disabled={loading || !isClockedIn}
              className="flex-1 py-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-lg font-bold disabled:opacity-50 hover:bg-rose-500/20 transition-all"
            >
              CLOCK OUT
            </button>
          </div>
          
          <div className="mt-6 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Today's Log</h3>
            {dailyStatus.length === 0 ? (
              <p className="text-sm text-text-tertiary italic">No punches today.</p>
            ) : (
              dailyStatus.map(e => (
                <div key={e.id} className="flex justify-between items-center text-sm p-2 bg-surface rounded border border-border-subtle">
                  <span className="font-mono text-text-secondary">{new Date(e.timestamp).toLocaleTimeString()}</span>
                  <span className={`font-bold ${e.event_type === 'CLOCK_IN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {e.event_type.replace('_', ' ')}
                  </span>
                  {e.metadata?.is_late && <span className="text-xs text-amber-500 font-bold border border-amber-500/30 px-1.5 rounded">LATE</span>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leave Center */}
        <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-text-primary">
              <Calendar className="w-5 h-5 text-indigo-400" /> Leave Balances
            </h2>
            <button 
              onClick={handleRequestLeave}
              className="px-3 py-1.5 text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded hover:bg-indigo-500/20 transition-colors"
            >
              Request Leave
            </button>
          </div>

          <div className="space-y-4">
            {balances.length === 0 ? (
              <div className="p-4 bg-surface rounded border border-border-subtle text-center text-sm text-text-tertiary">
                Balances synced with HR backend. (Mock display)
              </div>
            ) : (
              balances.map((b, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-surface rounded-lg border border-border-subtle">
                  <div>
                    <span className="block font-bold text-sm text-text-primary">{b.leave_type}</span>
                    <span className="text-xs text-text-tertiary">{b.used} used / {b.allocated} total</span>
                  </div>
                  <div className="text-xl font-bold text-accent-primary">
                    {b.remaining} <span className="text-xs font-normal text-text-tertiary">days left</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
