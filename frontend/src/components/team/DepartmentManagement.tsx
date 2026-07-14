import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { EmptyState } from '../core';
import { PremiumLoader } from '../common/PremiumLoader';
import { Users, Briefcase, Folders, Plus, Edit2, UserPlus, Building2 } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export function DepartmentManagement() {
  const { workspace } = useWorkspace();
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace?.id) {
      setLoading(true);
      return;
    }

    async function load() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('departments')
          .select(`
            *,
            manager:users(id, full_name, avatar_url),
            projects(count)
          `)
          .eq('workspace_id', workspace.id);
        
        if (!error && data) {
          setDepartments(data);
        } else {
          console.error('Failed to fetch departments:', error);
          setDepartments([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [workspace?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <PremiumLoader />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in font-geist">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Departments</h2>
          <p className="text-sm text-text-secondary mt-1 tracking-tight">Organize teams, managers, and company structure.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 btn-premium-primary rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            New Department
          </button>
        </div>
      </div>

      {departments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No departments created yet"
          description="Create your first department to start organizing your company structure."
          action={
            <button className="btn-premium-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Department
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept: any) => (
            <div key={dept.id} className="bg-[var(--pm-surface)] border border-[var(--pm-outline-variant)] rounded-xl p-5 space-y-4 hover:border-indigo-500/30 transition-colors group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[var(--pm-on-surface)]">{dept.name}</h3>
                    <p className="text-xs text-[var(--pm-on-surface-variant)] line-clamp-1">{dept.description || 'No description'}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--pm-outline-variant)] space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--pm-on-surface-variant)] flex items-center gap-2 text-xs uppercase tracking-wider font-mono">
                    <Users className="w-3.5 h-3.5" /> Manager
                  </span>
                  <span className="text-[var(--pm-on-surface)] font-medium text-sm">
                    {dept.manager?.full_name || 'Unassigned'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--pm-on-surface-variant)] flex items-center gap-2 text-xs uppercase tracking-wider font-mono">
                    <Folders className="w-3.5 h-3.5" /> Active Projects
                  </span>
                  <span className="text-[var(--pm-on-surface)] font-medium text-sm">
                    {dept.projects?.[0]?.count || 0}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--pm-outline-variant)] flex items-center gap-2">
                <button className="flex-1 px-3 py-2 bg-[var(--pm-surface-hover)] hover:bg-[var(--pm-surface-active)] text-[var(--pm-on-surface)] rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2">
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button className="flex-1 px-3 py-2 bg-[var(--pm-surface-hover)] hover:bg-[var(--pm-surface-active)] text-[var(--pm-on-surface)] rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2">
                  <UserPlus className="w-3.5 h-3.5" />
                  Assign
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
