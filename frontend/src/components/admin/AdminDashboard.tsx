import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Terminal, Lock, X, AlertTriangle, Users, Database, Zap, Edit2, Trash2 } from 'lucide-react';
import { Project, Team, User, Profile, UserRole } from '../../types';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { hasCapability } from '../../core/auth/permissions';

export function AdminDashboard({
  profiles,
  teams,
  currentUserRole,
  systemData,
  onSaveSystemData,
  askConfirmation,
  onUpdateRole,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam
}: {
  profiles: Profile[],
  teams: Team[],
  currentUserRole?: UserRole,
  systemData: any,
  onSaveSystemData: (data: any) => Promise<void>,
  askConfirmation: (title: string, message: string, onConfirm: () => void, confirmText?: string) => void,
  onUpdateRole: (id: string, role: UserRole) => void,
  onCreateTeam: (name: string, pmId: string, devIds: string[]) => void,
  onUpdateTeam: (id: string, name: string, pmId: string, devIds: string[]) => void,
  onDeleteTeam: (id: string) => void
}) {
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedPm, setSelectedPm] = useState('');
  const [selectedDevs, setSelectedDevs] = useState<string[]>([]);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');

  const { workspace, user: currentUserProfile } = useWorkspace();
  const canGovernPlatform = hasCapability(currentUserRole, 'platform_governance');

  const [invitations, setInvitations] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'pm' | 'developer' | 'viewer'>('developer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const fetchInvitations = async () => {
    if (!canGovernPlatform) return;
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('status', 'pending');
    if (!error && data) {
      setInvitations(data);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [canGovernPlatform]);

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError("Invalid email format.");
      return;
    }

    setInviting(true);
    setInviteError(null);

    try {
      if (!workspace?.id) throw new Error("Could not locate active workspace.");
      if (!currentUserProfile?.id) throw new Error("No active user profile.");

      const { error: insertError } = await supabase
        .from('invitations')
        .insert({
          email,
          workspace_id: workspace.id,
          role: inviteRole,
          status: 'pending',
          invited_by: currentUserProfile.id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error("This email is already invited.");
        }
        throw insertError;
      }

      setInviteEmail('');
      fetchInvitations();
    } catch (err: any) {
      setInviteError(err?.message || "Failed to send invitation.");
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvitation = async (id: string) => {
    askConfirmation("Revoke Invitation", "Are you sure you want to revoke this invitation? The user will no longer be allowed to join.", async () => {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', id);
      if (!error) {
        fetchInvitations();
      }
    }, "Revoke");
  };

  const customRoles: string[] = systemData.customRoles || ['Developer', 'Designer', 'QA Engineer', 'Viewer'];
  const userCustomRoles: Record<string, string> = systemData.userCustomRoles || {};

  const handleAddCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    const cleanRoleName = newRoleName.trim();
    if (customRoles.some(r => r.toLowerCase() === cleanRoleName.toLowerCase())) {
      alert("This role designation already exists.");
      return;
    }
    const updatedRoles = [...customRoles, cleanRoleName];
    await onSaveSystemData({
      ...systemData,
      customRoles: updatedRoles
    });
    setNewRoleName('');
  };

  const handleDeleteCustomRole = async (roleToDelete: string) => {
    if (['viewer', 'developer', 'designer', 'qa engineer'].includes(roleToDelete.toLowerCase())) {
      alert("Cannot delete system default designations.");
      return;
    }

    askConfirmation("Confirm Deletion", `Are you sure you want to delete the custom designation '${roleToDelete}'? This will unassign it from all users.`, async () => {
      const updatedRoles = customRoles.filter(r => r !== roleToDelete);
      const updatedUserRoles = { ...userCustomRoles };
      Object.keys(updatedUserRoles).forEach(userId => {
        if (updatedUserRoles[userId] === roleToDelete) {
          delete updatedUserRoles[userId];
        }
      });

      await onSaveSystemData({
        ...systemData,
        customRoles: updatedRoles,
        userCustomRoles: updatedUserRoles
      });
    }, "Delete");
  };

  const handleAssignCustomRole = async (userId: string, roleName: string) => {
    const userProfile = profiles.find(p => p.id === userId);
    const targetName = userProfile?.full_name || userProfile?.email || "this user";

    askConfirmation("Confirm Designation Change", `Confirm action: Change designation of ${targetName} to '${roleName}'?`, async () => {
      const updatedUserRoles = {
        ...userCustomRoles,
        [userId]: roleName
      };
      await onSaveSystemData({
        ...systemData,
        userCustomRoles: updatedUserRoles
      });
    }, "Change");
  };

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName || !selectedPm) return;

    if (editingTeamId) {
      onUpdateTeam(editingTeamId, newTeamName, selectedPm, selectedDevs);
      setEditingTeamId(null);
    } else {
      onCreateTeam(newTeamName, selectedPm, selectedDevs);
    }

    setNewTeamName('');
    setSelectedPm('');
    setSelectedDevs([]);
  };

  const startEditing = (team: Team) => {
    setEditingTeamId(team.id);
    setNewTeamName(team.name);
    setSelectedPm((team.data as Record<string, unknown>)?.pm_id as string || '');
    setSelectedDevs((team.data as Record<string, unknown>)?.developer_ids as string[] || []);

    // Scroll to form
    const form = document.getElementById('team-form');
    if (form) form.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingTeamId(null);
    setNewTeamName('');
    setSelectedPm('');
    setSelectedDevs([]);
  };

  const pms = profiles.filter(p => p.role === 'pm' || p.role === 'super_admin');
  const devs = profiles.filter(p => p.role === 'developer' || p.role === 'viewer');

  // Identify devs already in other teams to prevent double-assignment
  const assignedDevIds = new Set(
    teams
      .filter(t => t.id !== editingTeamId)
      .flatMap(t => {
        const d = typeof t.data === 'string' ? JSON.parse(t.data) : t.data;
        return d?.developer_ids || [];
      })
  );

  const availableDevs = devs.filter(d => !assignedDevIds.has(d.id));

  return (
    <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12 pb-16 space-y-12 sm:space-y-16">
      <div>
        <div className="mb-8">
          <h2 className="text-3xl font-medium tracking-tight mb-2">Internal Identity Console</h2>
          <p className="text-sm text-text-secondary font-mono tracking-tighter">
            {canGovernPlatform ? 'Super Admin Privileges: Calibrate team access levels and verify engineering credentials.' : 'Project Manager Console: Manage normal user designations and view active teams.'}
          </p>
        </div>

        <div className="border border-border bg-surface overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-white/5 border-b border-border">
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-wide text-text-secondary">User Identity</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-wide text-text-secondary">Current Role</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-wide text-text-secondary text-right">Access Calibration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {profiles.map((profile) => (
                <tr key={profile.id} className="hover:bg-surface-3 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center border border-border overflow-hidden font-mono text-[10px]">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="P" className="w-full h-full object-cover" />
                        ) : (profile.full_name || profile.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs">{profile.full_name || profile.email}</span>
                        {profile.phone && <span className="text-[10px] font-mono text-text-secondary">{profile.phone}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border ${profile.role === 'super_admin' ? 'border-red-500/30 text-signal-critical bg-signal-critical-bg' :
                      profile.role === 'pm' ? 'border-border text-signal-info bg-surface-3' :
                        'border-border text-text-secondary bg-white/5'
                      }`}>
                      {profile.role === 'viewer' ? (userCustomRoles[profile.id] || 'Viewer') : profile.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-4">
                      {/* PM role change (Visible to Super Admin only) */}
                      {canGovernPlatform && profile.role !== 'super_admin' && (
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-text-tertiary uppercase">Role:</span>
                          <select
                            value={profile.role}
                            onChange={(e) => onUpdateRole(profile.id, e.target.value as any)}
                            className="bg-bg border border-border text-[10px] font-mono px-2 py-1 focus:border-white/30 outline-none text-text-secondary"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="developer">Developer</option>
                            <option value="pm">Project Manager</option>
                          </select>
                        </div>
                      )}

                      {/* Custom Designation select (Visible to PM or Super Admin for normal users) */}
                      {profile.role !== 'super_admin' ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-text-tertiary uppercase">Designation:</span>
                          <select
                            value={userCustomRoles[profile.id] || 'Viewer'}
                            onChange={(e) => handleAssignCustomRole(profile.id, e.target.value)}
                            className="bg-bg border border-border text-[10px] font-mono px-2 py-1 focus:border-white/30 outline-none text-text-secondary"
                          >
                            {customRoles.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono text-text-tertiary uppercase italic">Immutable Root</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Team Configuration & Custom Roles Section --- */}
      <div>
        <div className="mb-6">
          <h2 className="text-3xl font-medium tracking-tight mb-2">
            {canGovernPlatform ? 'Control & Capabilities Center' : 'Active Team Roster'}
          </h2>
          <p className="text-sm text-text-secondary font-mono tracking-tighter">
            {canGovernPlatform ? 'Form cross-functional teams, allocate teams, and customize corporate designations.' : 'View current operational team formations and allocation hierarchies.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Team Configuration Form (Visible to Super Admin) */}
          {canGovernPlatform && (
            <div className="border border-border bg-surface p-6 lg:col-span-4 flex flex-col justify-between" id="team-form">
              <div>
                <h3 className="text-sm font-sans tracking-tight uppercase tracking-wide mb-6">{editingTeamId ? 'Update Team' : 'Create Team'}</h3>
                <form onSubmit={handleCreateTeam} className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-text-secondary mb-2">Team Name</label>
                    <input
                      required
                      type="text"
                      value={newTeamName}
                      onChange={e => setNewTeamName(e.target.value)}
                      className="w-full bg-bg border border-border h-10 px-3 font-mono text-xs focus:border-white/40 outline-none placeholder:text-text-secondary"
                      placeholder="E.g. SQUAD_DELTA"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-mono text-text-secondary mb-2">Assign Project Manager (PM)</label>
                    <select
                      required
                      value={selectedPm}
                      onChange={e => setSelectedPm(e.target.value)}
                      className="w-full bg-bg border border-border h-10 px-3 font-mono text-xs focus:border-white/40 outline-none text-text-secondary"
                    >
                      <option value="" disabled>Select PM</option>
                      {pms.map(pm => (
                        <option key={pm.id} value={pm.id}>{pm.full_name || pm.email}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-mono text-text-secondary mb-2">Assign Engineers (Viewers)</label>
                    <div className="border border-border bg-bg max-h-40 overflow-y-auto p-2 space-y-1">
                      {availableDevs.map(dev => (
                        <label key={dev.id} className="flex items-center gap-2 text-xs font-mono cursor-pointer hover:bg-white/5 p-1 transition-colors">
                          <input
                            type="checkbox"
                            className="accent-white"
                            checked={selectedDevs.includes(dev.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedDevs([...selectedDevs, dev.id]);
                              else setSelectedDevs(selectedDevs.filter(id => id !== dev.id));
                            }}
                          />
                          <span>{dev.full_name || dev.email}</span>
                        </label>
                      ))}
                      {availableDevs.length === 0 && <p className="text-[10px] text-text-secondary italic p-1">No unassigned engineers detected.</p>}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 bg-white text-black h-10 font-semibold hover:bg-neutral-200 transition-colors uppercase text-xs tracking-wide"
                    >
                      {editingTeamId ? 'Update Team' : 'Create Team'}
                    </button>
                    {editingTeamId && (
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="flex-1 border border-border text-text-secondary h-10 font-medium hover:bg-white/5 transition-colors uppercase text-xs tracking-wide"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Manage Custom Designations (Visible to Super Admin) */}
          {canGovernPlatform && (
            <div className="border border-border bg-surface p-6 lg:col-span-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-sans tracking-tight uppercase tracking-wide mb-6">Manage Custom Designations</h3>
                <form onSubmit={handleAddCustomRole} className="space-y-4 mb-6">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-text-secondary mb-2">Create New Designation</label>
                    <div className="flex gap-2">
                      <input
                        required
                        type="text"
                        value={newRoleName}
                        onChange={e => setNewRoleName(e.target.value)}
                        className="flex-1 bg-bg border border-border h-10 px-3 font-mono text-xs focus:border-white/40 outline-none placeholder:text-text-secondary"
                        placeholder="e.g. Frontend Engineer"
                      />
                      <button
                        type="submit"
                        className="bg-white text-black px-4 h-10 font-semibold uppercase tracking-wide text-[10px] hover:bg-neutral-200 transition-colors whitespace-nowrap"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                </form>

                <div>
                  <label className="block text-[10px] uppercase font-mono text-text-secondary mb-3">Active Custom Roles</label>
                  <div className="divide-y divide-white/5 border border-border max-h-40 overflow-y-auto bg-bg p-2 rounded-sm">
                    {customRoles.map(role => (
                      <div key={role} className="flex justify-between items-center py-2 px-1 hover:bg-surface-3 transition-colors">
                        <span className="text-xs font-mono text-text-secondary">{role}</span>
                        {!['viewer', 'developer', 'designer', 'qa engineer'].includes(role.toLowerCase()) ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomRole(role)}
                            className="text-[9px] font-mono text-signal-critical hover:text-signal-critical uppercase tracking-wide"
                          >
                            Delete
                          </button>
                        ) : (
                          <span className="text-[9px] font-mono text-text-quaternary uppercase tracking-wide">SYSTEM</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Teams list */}
          <div className={`border border-border bg-surface overflow-hidden flex flex-col ${canGovernPlatform ? 'lg:col-span-4' : 'lg:col-span-12'}`}>
            <h3 className="text-sm font-sans tracking-tight uppercase tracking-wide p-6 border-b border-border">Active Teams</h3>
            <div className="overflow-y-auto p-6 space-y-4 flex-1 max-h-[400px]">
              {teams.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <Users className="w-8 h-8 text-text-secondary mb-3" />
                  <p className="text-xs font-mono text-text-secondary text-center uppercase">No teams created.</p>
                </div>
              )}
              {teams.map(team => {
                const pmId = (team.data as Record<string, unknown>)?.pm_id as string | undefined;
                const devIds = (team.data as Record<string, unknown>)?.developer_ids as string[] || [];
                const pm = profiles.find(p => p.id === pmId);
                const squadDevs = devIds.map((id: string) => profiles.find(p => p.id === id)).filter(Boolean);
                return (
                  <div key={team.id} className="border border-border p-4 bg-white/5 hover:border-white/30 transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-sm bg-white/10 flex items-center justify-center border border-border">
                          <Zap className="w-4 h-4 text-text-secondary group-hover:text-text-primary transition-colors" />
                        </div>
                        <h4 className="font-sans font-medium text-lg tracking-tight">{team.name}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        {canGovernPlatform && (
                          <>
                            <button
                              onClick={() => startEditing(team)}
                              className="p-1.5 border border-border text-text-secondary hover:text-text-primary hover:border-white/30 transition-colors"
                              title="Edit Team"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteTeam(team.id)}
                              className="p-1.5 border border-border text-text-secondary hover:text-signal-critical hover:border-red-500/30 transition-colors"
                              title="Delete Team"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <span className="text-[10px] font-mono text-text-secondary uppercase bg-bg px-2 py-1 border border-border">ID: {team.id?.substring(0, 8) || 'UNKNOWN'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border-subtle">
                      <div>
                        <p className="text-[11px] font-mono text-text-secondary uppercase mb-2">Lead (PM)</p>
                        <p className="text-xs font-mono text-signal-info flex items-center gap-1.5"><Users className="w-3 h-3" /> {pm?.full_name || pm?.email || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-mono text-text-secondary uppercase mb-2">Engineers ({squadDevs.length})</p>
                        <div className="space-y-1.5">
                          {squadDevs.length === 0 && <p className="text-[10px] font-mono text-text-secondary italic">None assigned</p>}
                          {squadDevs.map(d => (
                            <p key={d?.id} className="text-xs font-mono text-text-secondary">{(d && userCustomRoles[d.id]) || d?.full_name || d?.email}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Invite Member & Pending Invitations (Visible to Super Admin) */}
          {canGovernPlatform && (
            <div className="border border-border bg-surface p-6 lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Invite Form */}
              <div>
                <h3 className="text-sm font-sans tracking-tight uppercase tracking-wide mb-6">Invite Organization Member</h3>
                <form onSubmit={handleSendInvitation} className="space-y-4">
                  {inviteError && (
                    <div className="border border-red-500/30 bg-signal-critical-bg p-3 text-xs text-red-200">
                      {inviteError}
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-text-secondary mb-2">Member Email</label>
                    <input
                      required
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      className="w-full bg-bg border border-border h-10 px-3 font-mono text-xs focus:border-white/40 outline-none placeholder:text-text-secondary text-text-primary"
                      placeholder="teammate@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-text-secondary mb-2">Assigned Role</label>
                    <select
                      required
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as any)}
                      className="w-full bg-bg border border-border h-10 px-3 font-mono text-xs focus:border-white/40 outline-none text-text-secondary"
                    >
                      <option value="developer">Developer</option>
                      <option value="pm">Project Manager</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="w-full bg-white text-black h-10 font-semibold hover:bg-neutral-200 transition-colors uppercase text-xs tracking-wide disabled:opacity-50"
                  >
                    {inviting ? 'Inviting...' : 'Send Invitation'}
                  </button>
                </form>
              </div>

              {/* Pending Invites List */}
              <div>
                <h3 className="text-sm font-sans tracking-tight uppercase tracking-wide mb-6">Pending Invitations</h3>
                <div className="divide-y divide-white/5 border border-border max-h-[220px] overflow-y-auto bg-bg p-4 rounded-sm">
                  {invitations.map(inv => (
                    <div key={inv.id} className="flex justify-between items-center py-3 hover:bg-surface-3 transition-colors border-b border-border-subtle last:border-0">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono text-text-secondary">{inv.email}</span>
                        <span className="text-[9px] font-mono text-text-tertiary uppercase mt-1">Role: {inv.role}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevokeInvitation(inv.id)}
                        className="text-[9px] font-mono text-signal-critical hover:text-signal-critical uppercase tracking-wide px-3 py-1.5 border border-border hover:border-red-500/30 transition-colors bg-white/5 hover:bg-white/10"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                  {invitations.length === 0 && (
                    <div className="text-center py-8 text-xs font-mono text-text-quaternary italic">
                      No pending invitations.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
