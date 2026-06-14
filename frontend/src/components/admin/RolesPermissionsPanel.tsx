import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, Key, Check, X, AlertTriangle } from 'lucide-react';

export function RolesPermissionsPanel() {
  const [roles, setRoles] = useState<any[]>([]);
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [roleCapabilities, setRoleCapabilities] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Core safety constraints for super_admin
  const PROTECTED_CAPS = ['platform_governance', 'manage_settings', 'manage_users', 'manage_roles', 'workspace_admin'];

  useEffect(() => {
    fetchMatrix();
  }, []);

  const fetchMatrix = async () => {
    setLoading(true);
    try {
      const [rRes, cRes, rcRes] = await Promise.all([
        supabase.from('roles').select('*'),
        supabase.from('capabilities').select('*'),
        supabase.from('role_capabilities').select('*')
      ]);

      if (rRes.data) setRoles(rRes.data);
      if (cRes.data) setCapabilities(cRes.data);
      
      const rcMap: Record<string, string[]> = {};
      if (rcRes.data) {
        rcRes.data.forEach((rc: any) => {
          if (!rcMap[rc.role_id]) rcMap[rc.role_id] = [];
          rcMap[rc.role_id].push(rc.capability_id);
        });
      }
      setRoleCapabilities(rcMap);
    } catch (e) {
      console.error('Failed to load permission matrix', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (roleId: string, capId: string) => {
    // Safety check
    if (roleId === 'super_admin' && PROTECTED_CAPS.includes(capId)) {
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: `Cannot remove critical capability from super_admin`, type: 'error' }}));
      return;
    }

    setRoleCapabilities(prev => {
      const roleCaps = prev[roleId] || [];
      if (roleCaps.includes(capId)) {
        return { ...prev, [roleId]: roleCaps.filter(c => c !== capId) };
      } else {
        return { ...prev, [roleId]: [...roleCaps, capId] };
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Get current user id for audit logging
      const { data: { session } } = await supabase.auth.getSession();
      const actorId = session?.user?.id;

      // In a real scenario we'd do a batch transaction, but here we can clear and insert or just upsert.
      // Easiest is delete all and insert for each role that exists in the matrix.
      for (const role of roles) {
        await supabase.from('role_capabilities').delete().eq('role_id', role.id);
        
        const capsToInsert = roleCapabilities[role.id] || [];
        if (capsToInsert.length > 0) {
          const inserts = capsToInsert.map(capId => ({ role_id: role.id, capability_id: capId }));
          await supabase.from('role_capabilities').insert(inserts);
        }
      }

      // Record audit log
      if (actorId) {
        await supabase.from('activity_logs').insert({
          action: 'PERMISSION_CHANGED',
          actor_id: actorId,
          metadata: { updated_roles: roles.map(r => r.id) }
        });
      }

      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: 'Permissions matrix updated successfully.', type: 'success' }}));
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: `Failed to save permissions: ${e.message}`, type: 'error' }}));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center animate-pulse text-[var(--pm-text-tertiary)] text-sm">Loading capability matrix...</div>;

  return (
    <div className="flex flex-col gap-6 font-geist">
      <div className="flex items-center justify-between bg-[var(--pm-surface-high)] p-5 rounded-xl border border-[var(--pm-border)]">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--pm-text)' }}>
            <Shield className="w-5 h-5 text-indigo-500" />
            Roles & Capabilities
          </h2>
          <p className="text-sm mt-1 text-[var(--pm-text-secondary)]">
            Manage global role definitions and platform-wide capabilities.
          </p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Key className="w-4 h-4" />
          {saving ? 'Saving Matrix...' : 'Save Changes'}
        </button>
      </div>

      <div className="bg-[var(--pm-surface)] rounded-xl border border-[var(--pm-border)] overflow-x-auto shadow-sm">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[var(--pm-surface-low)] text-[var(--pm-text-secondary)] border-b border-[var(--pm-border)]">
            <tr>
              <th className="px-6 py-4 font-semibold sticky left-0 z-10 bg-[var(--pm-surface-low)] border-r border-[var(--pm-border)]">Capability</th>
              {roles.map(role => (
                <th key={role.id} className="px-4 py-4 font-semibold text-center uppercase tracking-wider text-xs">
                  {role.id.replace('_', ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--pm-border)]">
            {capabilities.map(cap => (
              <tr key={cap.id} className="hover:bg-[var(--pm-surface-hover)] transition-colors">
                <td className="px-6 py-3 sticky left-0 z-10 bg-[var(--pm-surface)] group-hover:bg-[var(--pm-surface-hover)] border-r border-[var(--pm-border)]">
                  <div className="font-mono text-[11px] text-[var(--pm-text)]">{cap.id}</div>
                  <div className="text-[10px] text-[var(--pm-text-tertiary)] max-w-[250px] truncate">{cap.description}</div>
                </td>
                {roles.map(role => {
                  const hasCap = roleCapabilities[role.id]?.includes(cap.id);
                  const isProtected = role.id === 'super_admin' && PROTECTED_CAPS.includes(cap.id);
                  
                  return (
                    <td key={`${role.id}-${cap.id}`} className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggle(role.id, cap.id)}
                        className={`w-6 h-6 rounded flex items-center justify-center mx-auto transition-colors ${
                          hasCap ? 'bg-indigo-500 text-white' : 'bg-[var(--pm-surface-highest)] text-[var(--pm-text-tertiary)] hover:bg-[var(--pm-surface-hover)]'
                        } ${isProtected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        title={isProtected ? 'Cannot modify this core capability' : `Toggle ${cap.id} for ${role.id}`}
                      >
                        {hasCap ? <Check className="w-4 h-4" /> : <X className="w-3 h-3" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-500/90 leading-relaxed">
          <strong className="font-semibold block mb-1">Warning: Capability Escalation</strong>
          Granting powerful capabilities (like <code>platform_governance</code> or <code>manage_projects</code>) to broad roles can lead to unauthorized access. Review all assignments carefully. Core capabilities for <code>super_admin</code> cannot be removed.
        </div>
      </div>
    </div>
  );
}
