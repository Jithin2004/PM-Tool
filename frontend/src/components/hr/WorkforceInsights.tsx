import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Users, Clock, Calendar, Shield, Award, AlertTriangle } from 'lucide-react';
import { useOperationalData } from '../../context/OperationalDataContext';
import { useWorkspace } from '../../context/WorkspaceContext';

interface EmploymentRecord {
  id: string;
  profile_id: string;
  employee_type: 'full_time' | 'contractor' | 'intern';
  contract_end: string | null;
  probation_end: string | null;
  joining_date: string | null;
}

export function WorkforceInsights() {
  const { workspace } = useWorkspace();
  const { raw } = useOperationalData();
  const [records, setRecords] = useState<EmploymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHR() {
      if (!isSupabaseConfigured || !workspace?.id) return;
      const { data } = await supabase
        .from('employment_records')
        .select('id, profile_id, employee_type, contract_end, probation_end, joining_date')
        .eq('workspace_id', workspace.id);
      
      if (data) {
        setRecords(data as EmploymentRecord[]);
      }
      setLoading(false);
    }
    loadHR();
  }, [workspace?.id]);

  if (loading) return <div className="p-8 text-center text-xs text-text-tertiary font-mono animate-pulse">Loading HR Intelligence...</div>;

  const now = new Date();
  
  // Calculate specific metrics
  const contractors = records.filter(r => r.employee_type === 'contractor');
  const interns = records.filter(r => r.employee_type === 'intern');
  const fulltime = records.filter(r => r.employee_type === 'full_time');

  const getDaysRemaining = (endDateStr: string | null) => {
    if (!endDateStr) return null;
    const diff = new Date(endDateStr).getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const contractorsEndingSoon = contractors.filter(c => {
    const d = getDaysRemaining(c.contract_end);
    return d !== null && d > 0 && d <= 30;
  });

  const internsEndingSoon = interns.filter(i => {
    const d = getDaysRemaining(i.contract_end);
    return d !== null && d > 0 && d <= 15;
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between border-b border-border-subtle pb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-text-primary flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" /> Workforce Intelligence
          </h2>
          <p className="text-xs text-text-tertiary mt-1">HR Insights and contract monitoring.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Full Time */}
        <div className="bg-surface-2 border border-border p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono tracking-widest uppercase text-text-tertiary mb-1">Permanent Core</p>
            <p className="text-2xl font-bold text-text-primary">{fulltime.length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Contractors */}
        <div className="bg-surface-2 border border-border p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono tracking-widest uppercase text-text-tertiary mb-1">Contractors</p>
            <p className="text-2xl font-bold text-text-primary">{contractors.length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Interns */}
        <div className="bg-surface-2 border border-border p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono tracking-widest uppercase text-text-tertiary mb-1">Interns</p>
            <p className="text-2xl font-bold text-text-primary">{interns.length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-2 border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold tracking-tight text-text-primary mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Contracts Expiring Soon (&lt;30 days)
          </h3>
          {contractorsEndingSoon.length === 0 ? (
            <p className="text-xs text-text-tertiary">No contractors expiring within 30 days.</p>
          ) : (
            <ul className="space-y-3">
              {contractorsEndingSoon.map(c => {
                const profile = raw.profiles.find(p => p.id === c.profile_id);
                return (
                  <li key={c.id} className="flex justify-between items-center bg-surface-3 p-3 rounded-lg border border-border-subtle">
                    <span className="text-sm text-text-primary font-medium">{profile?.full_name || 'Unknown'}</span>
                    <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-1 rounded">
                      {getDaysRemaining(c.contract_end)} days left
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-surface-2 border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold tracking-tight text-text-primary mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            Internship Completion (&lt;15 days)
          </h3>
          {internsEndingSoon.length === 0 ? (
            <p className="text-xs text-text-tertiary">No intern programs completing within 15 days.</p>
          ) : (
            <ul className="space-y-3">
              {internsEndingSoon.map(i => {
                const profile = raw.profiles.find(p => p.id === i.profile_id);
                return (
                  <li key={i.id} className="flex justify-between items-center bg-surface-3 p-3 rounded-lg border border-border-subtle">
                    <span className="text-sm text-text-primary font-medium">{profile?.full_name || 'Unknown'}</span>
                    <span className="text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-1 rounded">
                      {getDaysRemaining(i.contract_end)} days left
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
