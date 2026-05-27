import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { AdminDashboard } from '../../components/admin/AdminDashboard';
import { CalendarIntelligencePanel } from '../../components/admin/CalendarIntelligencePanel';
import { hasCapability } from '../../core/auth/permissions';
import { Icon } from '../../components/ui/Icon';

type AdminTab = 'identity' | 'calendar' | 'teams';

function getInitials(name: string) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function getRoleColor(role: string) {
  if (role === 'super_admin' || role === 'admin') return 'var(--pm-primary)';
  if (role === 'manager') return 'var(--pm-secondary)';
  if (role === 'viewer') return 'var(--pm-on-surface-variant)';
  return 'var(--pm-tertiary)';
}

function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin:       'Admin',
    manager:     'Project Manager',
    editor:      'Lead Analyst',
    viewer:      'Observer',
    member:      'Member',
  };
  return labels[role] || role?.replace('_', ' ') || 'Member';
}

function getAccessBar(role: string): number {
  const bars: Record<string, number> = { super_admin: 100, admin: 85, manager: 60, editor: 40, member: 25, viewer: 15 };
  return bars[role] ?? 25;
}

export function AdminPanel() {
  const { profile } = useAuth();
  const {
    profiles,
    teams,
    systemData,
    handleSaveLogisticsData,
    askConfirmation,
    handleUpdateRole,
    handleCreateTeam,
    handleUpdateTeam,
    handleDeleteTeam,
  } = useDashboard();

  const [tab, setTab] = useState<AdminTab>('identity');
  const [activeGearPopover, setActiveGearPopover] = useState<string | null>(null);

  const canViewCalendar = hasCapability(profile?.role, 'view_decision_center');

  const customRoles: string[] = systemData.customRoles || ['Developer', 'Designer', 'QA Engineer', 'Viewer'];
  const userCustomRoles: Record<string, string> = systemData.userCustomRoles || {};

  const handleAssignCustomRoleLocal = async (userId: string, roleName: string) => {
    const userProfile = profiles.find(p => p.id === userId);
    const targetName = userProfile?.full_name || userProfile?.email || "this user";

    askConfirmation("Confirm Designation Change", `Confirm action: Change designation of ${targetName} to '${roleName}'?`, async () => {
      const updatedUserRoles = {
        ...userCustomRoles,
        [userId]: roleName
      };
      await handleSaveLogisticsData({
        ...systemData,
        userCustomRoles: updatedUserRoles
      });
      setActiveGearPopover(null);
    }, "Change");
  };

  if (!hasCapability(profile?.role, 'platform_governance')) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 font-geist"
        style={{ color: 'var(--pm-on-surface-variant)' }}>
        <Icon name="lock" size={40} style={{ opacity: 0.3 }} />
        <div className="text-center">
          <p className="font-mono-pm text-[11px] uppercase tracking-widest mb-1" style={{ color: 'var(--pm-error)' }}>
            CLEARANCE DENIED
          </p>
          <p className="text-sm">Admin governance privileges required to access this console.</p>
        </div>
      </div>
    );
  }

  const activeTeams = teams.filter(t => t.name !== 'SYSTEM_SETTINGS');
  const activeProfiles = profiles || [];

  const tabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'identity', label: 'Identity Registry', icon: 'groups' },
    { id: 'teams', label: 'Operational Units', icon: 'hub' },
    ...(canViewCalendar ? [{ id: 'calendar' as AdminTab, label: 'Calendar Intelligence', icon: 'calendar_month' }] : []),
  ];

  return (
    <div className="flex flex-col gap-6 font-geist" style={{ color: 'var(--pm-on-surface)' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Internal Identity Console</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Management of core operational entities and access matrices.
          </p>
        </div>
        <span className="font-mono-pm text-[10px] uppercase tracking-[0.2em] px-3 py-1 rounded"
          style={{ background: 'rgba(192,193,255,0.05)', border: '1px solid rgba(192,193,255,0.1)', color: 'var(--pm-primary)' }}>
          {activeProfiles.length} ACTIVE ENTITIES
        </span>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b pb-0" style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all relative"
            style={{
              color: tab === t.id ? 'var(--pm-primary)' : 'var(--pm-on-surface-variant)',
              borderBottom: tab === t.id ? '2px solid var(--pm-primary)' : '2px solid transparent',
            }}>
            <Icon name={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Identity Registry Tab ───────────────────────────────── */}
      {tab === 'identity' && (
        <div className="space-y-8">
          {/* Identity Table */}
          <div className="rounded-xl overflow-hidden shadow-2xl"
            style={{ background: 'var(--pm-surface-low)', border: '1px solid rgba(70,69,84,0.3)' }}>
            <table className="w-full text-left border-collapse executive-table">
              <thead style={{ background: 'rgba(51,53,55,0.5)', borderBottom: '1px solid rgba(70,69,84,0.3)' }}>
                <tr>
                  {['Entity Identity', 'Clearance Level', 'Access Range', 'Controls'].map(h => (
                    <th key={h} className="px-8 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgba(70,69,84,0.1)' }}>
                {activeProfiles.map((p: any) => {
                  const roleColor = getRoleColor(p.role);
                  const accessPct = getAccessBar(p.role);
                  const initials = getInitials(p.full_name || p.email || '');
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(70,69,84,0.1)' }}>
                      {/* Entity Identity */}
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                            style={{ background: `${roleColor}18`, border: `1px solid ${roleColor}30`, color: roleColor }}>
                            {initials}
                          </div>
                          <div>
                            <div className="font-medium" style={{ color: 'var(--pm-on-surface)' }}>
                              {p.full_name || 'Unknown'}
                            </div>
                            <div className="font-mono-pm text-[11px] mt-0.5 uppercase"
                              style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>
                              {p.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Clearance Level */}
                      <td className="px-8 py-5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: `${roleColor}12`, color: roleColor, border: `1px solid ${roleColor}25` }}>
                          {getRoleLabel(p.role)}
                        </span>
                      </td>
                      {/* Access Range bar */}
                      <td className="px-8 py-5">
                        <div className="w-40 space-y-1.5">
                          <div className="h-1.5 w-full rounded-full overflow-hidden"
                            style={{ background: 'rgba(70,69,84,0.2)' }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${accessPct}%`, background: roleColor, boxShadow: accessPct === 100 ? `0 0 8px ${roleColor}60` : 'none' }} />
                          </div>
                          <span className="font-mono-pm text-[9px] uppercase tracking-widest"
                            style={{ color: roleColor, opacity: 0.8 }}>
                            {accessPct === 100 ? 'Full Spectrum Access' : accessPct >= 60 ? 'Tactical Clearance' : 'Limited Access'}
                          </span>
                        </div>
                      </td>
                      {/* Controls */}
                      <td className="px-8 py-5 relative">
                        <button className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                          style={{ 
                            color: activeGearPopover === p.id ? 'var(--pm-primary)' : 'var(--pm-on-surface-variant)', 
                            background: activeGearPopover === p.id ? 'rgba(192,193,255,0.1)' : '' 
                          }}
                          onMouseEnter={e => { if (activeGearPopover !== p.id) { (e.currentTarget as any).style.color = 'var(--pm-primary)'; (e.currentTarget as any).style.background = 'rgba(192,193,255,0.1)'; } }}
                          onMouseLeave={e => { if (activeGearPopover !== p.id) { (e.currentTarget as any).style.color = 'var(--pm-on-surface-variant)'; (e.currentTarget as any).style.background = ''; } }}
                          onClick={() => setActiveGearPopover(activeGearPopover === p.id ? null : p.id)}
                          title="Manage identity">
                          <Icon name="settings_suggest" size={18} />
                        </button>

                        {activeGearPopover === p.id && (
                          <div className="absolute right-12 top-12 w-64 rounded-xl shadow-2xl z-50 p-5 flex flex-col gap-5"
                            style={{ background: 'var(--pm-surface-high)', border: '1px solid rgba(70,69,84,0.3)' }}>
                            {hasCapability(profile?.role, 'platform_governance') && p.role !== 'super_admin' && (
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-mono-pm uppercase tracking-widest" style={{ color: 'var(--pm-on-surface-variant)' }}>Access Role</label>
                                <select
                                  value={p.role}
                                  onChange={(e) => { handleUpdateRole(p.id, e.target.value as any); setActiveGearPopover(null); }}
                                  className="border text-[11px] font-mono-pm px-3 py-2.5 rounded outline-none w-full"
                                  style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                                >
                                  <option value="viewer">Viewer</option>
                                  <option value="developer">Developer</option>
                                  <option value="manager">Project Manager</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </div>
                            )}
                            {p.role !== 'super_admin' ? (
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-mono-pm uppercase tracking-widest" style={{ color: 'var(--pm-on-surface-variant)' }}>Designation</label>
                                <select
                                  value={userCustomRoles[p.id] || 'Viewer'}
                                  onChange={(e) => handleAssignCustomRoleLocal(p.id, e.target.value)}
                                  className="border text-[11px] font-mono-pm px-3 py-2.5 rounded outline-none w-full"
                                  style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                                >
                                  {customRoles.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <span className="text-[10px] font-mono-pm uppercase italic text-center" style={{ color: 'var(--pm-on-surface-variant)' }}>Immutable Root Identity</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Control & Capabilities Center */}
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2 mb-5"
              style={{ color: 'var(--pm-on-surface)' }}>
              <Icon name="terminal" size={20} style={{ color: 'var(--pm-primary)' }} />
              Control &amp; Capabilities Center
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Create Team */}
              <div 
                className="pm-card p-7 group relative overflow-hidden cursor-pointer"
                onClick={() => document.getElementById('admin-dashboard-view')?.scrollIntoView({ behavior: 'smooth' })}>
                <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-all"
                  style={{ background: 'rgba(192,193,255,0.08)' }} />
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-105"
                  style={{ background: 'rgba(192,193,255,0.08)', border: '1px solid rgba(192,193,255,0.15)' }}>
                  <Icon name="group_add" size={24} style={{ color: 'var(--pm-primary)' }} />
                </div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--pm-on-surface)' }}>Create Team</h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--pm-on-surface-variant)' }}>
                  Initialize new operational units with specific scope of work and resource allocation protocol.
                </p>
                <div className="flex items-center gap-2 font-mono-pm text-[11px] uppercase tracking-[0.2em]"
                  style={{ color: 'var(--pm-primary)' }}>
                  <span>Execute Protocol</span>
                  <Icon name="arrow_forward" size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Designations */}
              <div 
                className="pm-card p-7 group relative overflow-hidden cursor-pointer"
                onClick={() => document.getElementById('admin-dashboard-view')?.scrollIntoView({ behavior: 'smooth' })}>
                <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-all"
                  style={{ background: 'rgba(195,198,213,0.05)' }} />
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-105"
                  style={{ background: 'rgba(195,198,213,0.08)', border: '1px solid rgba(195,198,213,0.15)' }}>
                  <Icon name="admin_panel_settings" size={24} style={{ color: 'var(--pm-secondary)' }} />
                </div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--pm-on-surface)' }}>Designations</h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--pm-on-surface-variant)' }}>
                  Configure custom access roles, multi-tier permission matrices, and security clearances.
                </p>
                <div className="flex items-center gap-2 font-mono-pm text-[11px] uppercase tracking-[0.2em]"
                  style={{ color: 'var(--pm-secondary)' }}>
                  <span>Access Matrix</span>
                  <Icon name="arrow_forward" size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Network Telemetry */}
              <div className="glass-panel p-7 rounded-xl flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <span className="font-mono-pm text-[10px] uppercase tracking-[0.3em]"
                    style={{ color: 'var(--pm-on-surface-variant)' }}>
                    Network Telemetry
                  </span>
                  <span className="font-mono-pm text-[9px] px-2 py-0.5 rounded font-bold"
                    style={{ background: 'rgba(255,183,131,0.1)', color: 'var(--pm-tertiary)', border: '1px solid rgba(255,183,131,0.2)' }}>
                    LIVE
                  </span>
                </div>
                <div className="flex-1 flex flex-col justify-center gap-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--pm-on-surface-variant)' }}>
                      Active Entities
                    </span>
                    <span className="font-mono-pm text-xl font-bold"
                      style={{ color: 'var(--pm-primary)' }}>
                      {activeProfiles.length}
                    </span>
                  </div>
                  {/* Mini bar chart */}
                  <div className="h-12 flex items-end gap-1">
                    {[30, 45, 75, 40, 65, 80, 25, 50, 80, 35].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t-sm transition-all"
                        style={{ height: `${h}%`, background: `rgba(192,193,255,${0.1 + (h / 100) * 0.7})` }} />
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-4 flex items-center gap-2"
                  style={{ borderTop: '1px solid rgba(70,69,84,0.2)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                    style={{ boxShadow: '0 0 6px rgba(52,211,153,0.5)' }} />
                  <p className="font-mono-pm text-[9px] uppercase tracking-widest"
                    style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>
                    All systems operational
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Full AdminDashboard for advanced controls */}
          <div id="admin-dashboard-view" className="rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(70,69,84,0.3)' }}>
            <AdminDashboard
              profiles={activeProfiles}
              teams={activeTeams}
              currentUserRole={profile?.role}
              systemData={systemData}
              onSaveSystemData={handleSaveLogisticsData}
              askConfirmation={askConfirmation}
              onUpdateRole={handleUpdateRole}
              onCreateTeam={handleCreateTeam}
              onUpdateTeam={handleUpdateTeam}
              onDeleteTeam={handleDeleteTeam}
            />
          </div>
        </div>
      )}

      {/* ── Operational Units Tab ───────────────────────────────── */}
      {tab === 'teams' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeTeams.map((team: any) => (
              <div key={team.id} className="pm-card p-6 group">
                <div className="flex justify-between items-start mb-5">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--pm-surface-highest)', border: '1px solid rgba(70,69,84,0.3)', color: 'var(--pm-primary)' }}>
                    <Icon name="hub" size={20} />
                  </div>
                  <span className="font-mono-pm text-[9px] font-bold uppercase tracking-widest pm-badge-success">
                    Active
                  </span>
                </div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--pm-on-surface)' }}>{team.name}</h3>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--pm-on-surface-variant)' }}>
                  {team.description || 'Operational unit within the system.'}
                </p>
                <div className="flex justify-between items-center">
                  <div className="flex -space-x-2">
                    {(team.members || []).slice(0, 3).map((m: any, i: number) => (
                      <div key={i} className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[9px] font-bold"
                        style={{ borderColor: 'var(--pm-surface-low)', background: 'var(--pm-surface-highest)', color: 'var(--pm-primary)' }}>
                        {getInitials(m.name || m)}
                      </div>
                    ))}
                    {(team.members?.length || 0) > 3 && (
                      <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[9px] font-bold"
                        style={{ borderColor: 'var(--pm-surface-low)', background: 'var(--pm-surface-highest)', color: 'var(--pm-on-surface-variant)' }}>
                        +{(team.members?.length || 0) - 3}
                      </div>
                    )}
                  </div>
                  <Icon name="open_in_new" size={18}
                    className="transition-colors group-hover:text-primary"
                    style={{ color: 'rgba(199,196,215,0.3)' }} />
                </div>
              </div>
            ))}

            {/* Add team slot */}
            <button className="rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all"
              style={{ border: '2px dashed rgba(70,69,84,0.4)' }}
              onMouseEnter={e => { (e.currentTarget as any).style.borderColor = 'rgba(192,193,255,0.4)'; (e.currentTarget as any).style.background = 'rgba(192,193,255,0.03)'; }}
              onMouseLeave={e => { (e.currentTarget as any).style.borderColor = 'rgba(70,69,84,0.4)'; (e.currentTarget as any).style.background = ''; }}
              onClick={() => {
                setTab('identity');
                setTimeout(() => document.getElementById('admin-dashboard-view')?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}>
              <Icon name="add_circle" size={32} style={{ color: 'var(--pm-on-surface-variant)' }} />
              <span className="font-mono-pm text-[10px] uppercase tracking-[0.3em] font-bold"
                style={{ color: 'var(--pm-on-surface-variant)' }}>
                Register Unit
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ── Calendar Intelligence Tab ───────────────────────────── */}
      {tab === 'calendar' && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(70,69,84,0.3)' }}>
          <CalendarIntelligencePanel />
        </div>
      )}
    </div>
  );
}
