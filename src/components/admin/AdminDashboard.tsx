import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Terminal, Lock, X, AlertTriangle, Users, Database, Zap, Edit2, Trash2 } from 'lucide-react';
import { Project, Team, User, Profile, UserRole } from '../../types';
import { supabase } from '../../lib/supabase';

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

  const [invitations, setInvitations] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'pm' | 'developer' | 'viewer'>('developer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const fetchInvitations = async () => {
    if (currentUserRole !== 'super_admin') return;
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
  }, [currentUserRole]);

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("No active auth session.");

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('workspace_id')
        .eq('id', session.user.id)
        .single();

      if (userError || !userData?.workspace_id) throw new Error("Could not locate active workspace.");

      const { error: insertError } = await supabase
        .from('invitations')
        .insert({
          email,
          workspace_id: userData.workspace_id,
          role: inviteRole,
          status: 'pending',
          invited_by: session.user.id,
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
    setSelectedPm(team.data?.pm_id || '');
    setSelectedDevs(team.data?.developer_ids || []);

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
  const devs = profiles.filter(p => p.role === 'viewer');

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
          <p className="text-sm text-white/85 font-mono tracking-tighter">
            {currentUserRole === 'super_admin' ? 'Super Admin Privileges: Calibrate team access levels and verify engineering credentials.' : 'Project Manager Console: Manage normal user designations and view active teams.'}
          </p>
        </div>

        <div className="border border-white/10 bg-[#0c0c0c] overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/85">User Identity</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/85">Current Role</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/85 text-right">Access Calibration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {profiles.map((profile) => (
                <tr key={profile.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden font-mono text-[10px]">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="P" className="w-full h-full object-cover" />
                        ) : (profile.full_name || profile.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs">{profile.full_name || profile.email}</span>
                        {profile.phone && <span className="text-[10px] font-mono text-white/75">{profile.phone}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border ${profile.role === 'super_admin' ? 'border-red-500/30 text-red-500 bg-red-500/5' :
                      profile.role === 'pm' ? 'border-blue-500/30 text-blue-400 bg-blue-500/5' :
                        'border-white/10 text-white/85 bg-white/5'
                      }`}>
                      {profile.role === 'viewer' ? (userCustomRoles[profile.id] || 'Viewer') : profile.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-4">
                      {/* PM role change (Visible to Super Admin only) */}
                      {currentUserRole === 'super_admin' && profile.role !== 'super_admin' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => onUpdateRole(profile.id, profile.role === 'pm' ? 'viewer' : 'pm')}
                            className={`text-[10px] font-mono uppercase px-3 py-1.5 transition-all ${profile.role === 'pm' ? 'bg-blue-500 text-white' : 'border border-white/10 text-white/85 hover:border-white/30'}`}
                          >
                            {profile.role === 'pm' ? 'DEMOTE FROM PM' : 'PROMOTE TO PM'}
                          </button>
                        </div>
                      )}

                      {/* Custom Designation select (Visible to PM or Super Admin for normal users) */}
                      {profile.role === 'viewer' ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-white/50 uppercase">Designation:</span>
                          <select
                            value={userCustomRoles[profile.id] || 'Viewer'}
                            onChange={(e) => handleAssignCustomRole(profile.id, e.target.value)}
                            className="bg-black border border-white/10 text-[10px] font-mono px-2 py-1 focus:border-white/30 outline-none text-white/85"
                          >
                            {customRoles.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                      ) : profile.role === 'pm' && currentUserRole === 'pm' ? (
                        <span className="text-[10px] font-mono text-white/45 uppercase italic">Immutable PM (Root Required)</span>
                      ) : profile.role === 'super_admin' ? (
                        <span className="text-[10px] font-mono text-white/45 uppercase italic">Immutable Root</span>
                      ) : null}
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
            {currentUserRole === 'super_admin' ? 'Control & Capabilities Center' : 'Active Team Roster'}
          </h2>
          <p className="text-sm text-white/85 font-mono tracking-tighter">
            {currentUserRole === 'super_admin' ? 'Form cross-functional teams, allocate teams, and customize corporate designations.' : 'View current operational team formations and allocation hierarchies.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Team Configuration Form (Visible to Super Admin) */}
          {currentUserRole === 'super_admin' && (
            <div className="border border-white/10 bg-[#0c0c0c] p-6 lg:col-span-4 flex flex-col justify-between" id="team-form">
              <div>
                <h3 className="text-sm font-mono uppercase tracking-widest mb-6">{editingTeamId ? 'Update Team' : 'Create Team'}</h3>
                <form onSubmit={handleCreateTeam} className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Team Name</label>
                    <input
                      required
                      type="text"
                      value={newTeamName}
                      onChange={e => setNewTeamName(e.target.value)}
                      className="w-full bg-black border border-white/10 h-10 px-3 font-mono text-xs focus:border-white/40 outline-none placeholder:text-white/70"
                      placeholder="E.g. SQUAD_DELTA"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Assign Project Manager (PM)</label>
                    <select
                      required
                      value={selectedPm}
                      onChange={e => setSelectedPm(e.target.value)}
                      className="w-full bg-black border border-white/10 h-10 px-3 font-mono text-xs focus:border-white/40 outline-none text-white/80"
                    >
                      <option value="" disabled>Select PM</option>
                      {pms.map(pm => (
                        <option key={pm.id} value={pm.id}>{pm.full_name || pm.email}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Assign Engineers (Viewers)</label>
                    <div className="border border-white/10 bg-black max-h-40 overflow-y-auto p-2 space-y-1">
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
                      {availableDevs.length === 0 && <p className="text-[10px] text-white/70 italic p-1">No unassigned engineers detected.</p>}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 bg-white text-black h-10 font-semibold hover:bg-neutral-200 transition-colors uppercase text-xs tracking-widest"
                    >
                      {editingTeamId ? 'Update Team' : 'Create Team'}
                    </button>
                    {editingTeamId && (
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="flex-1 border border-white/10 text-white/85 h-10 font-medium hover:bg-white/5 transition-colors uppercase text-xs tracking-widest"
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
          {currentUserRole === 'super_admin' && (
            <div className="border border-white/10 bg-[#0c0c0c] p-6 lg:col-span-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-mono uppercase tracking-widest mb-6">Manage Custom Designations</h3>
                <form onSubmit={handleAddCustomRole} className="space-y-4 mb-6">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Create New Designation</label>
                    <div className="flex gap-2">
                      <input
                        required
                        type="text"
                        value={newRoleName}
                        onChange={e => setNewRoleName(e.target.value)}
                        className="flex-1 bg-black border border-white/10 h-10 px-3 font-mono text-xs focus:border-white/40 outline-none placeholder:text-white/70"
                        placeholder="e.g. Frontend Engineer"
                      />
                      <button
                        type="submit"
                        className="bg-white text-black px-4 h-10 font-semibold uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition-colors whitespace-nowrap"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                </form>

                <div>
                  <label className="block text-[10px] uppercase font-mono text-white/85 mb-3">Active Custom Roles</label>
                  <div className="divide-y divide-white/5 border border-white/10 max-h-40 overflow-y-auto bg-black p-2 rounded-sm">
                    {customRoles.map(role => (
                      <div key={role} className="flex justify-between items-center py-2 px-1 hover:bg-white/[0.02] transition-colors">
                        <span className="text-xs font-mono text-white/85">{role}</span>
                        {!['viewer', 'developer', 'designer', 'qa engineer'].includes(role.toLowerCase()) ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomRole(role)}
                            className="text-[9px] font-mono text-red-500 hover:text-red-400 uppercase tracking-widest"
                          >
                            Delete
                          </button>
                        ) : (
                          <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest">SYSTEM</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Teams list */}
          <div className={`border border-white/10 bg-[#0c0c0c] overflow-hidden flex flex-col ${currentUserRole === 'super_admin' ? 'lg:col-span-4' : 'lg:col-span-12'}`}>
            <h3 className="text-sm font-mono uppercase tracking-widest p-6 border-b border-white/10">Active Teams</h3>
            <div className="overflow-y-auto p-6 space-y-4 flex-1 max-h-[400px]">
              {teams.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <Users className="w-8 h-8 text-white/75 mb-3" />
                  <p className="text-xs font-mono text-white/85 text-center uppercase">No teams created.</p>
                </div>
              )}
              {teams.map(team => {
                const pmId = team.data?.pm_id;
                const devIds = team.data?.developer_ids || [];
                const pm = profiles.find(p => p.id === pmId);
                const squadDevs = devIds.map((id: string) => profiles.find(p => p.id === id)).filter(Boolean);
                return (
                  <div key={team.id} className="border border-white/10 p-4 bg-white/5 hover:border-white/30 transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-sm bg-white/10 flex items-center justify-center border border-white/10">
                          <Zap className="w-4 h-4 text-white/90 group-hover:text-white transition-colors" />
                        </div>
                        <h4 className="font-sans font-medium text-lg tracking-tight">{team.name}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        {currentUserRole === 'super_admin' && (
                          <>
                            <button
                              onClick={() => startEditing(team)}
                              className="p-1.5 border border-white/10 text-white/85 hover:text-white hover:border-white/30 transition-colors"
                              title="Edit Team"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteTeam(team.id)}
                              className="p-1.5 border border-white/10 text-white/85 hover:text-red-500 hover:border-red-500/30 transition-colors"
                              title="Delete Team"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <span className="text-[10px] font-mono text-white/85 uppercase bg-black px-2 py-1 border border-white/10">ID: {team.id?.substring(0, 8) || 'UNKNOWN'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                      <div>
                        <p className="text-[11px] font-mono text-white/85 uppercase mb-2">Lead (PM)</p>
                        <p className="text-xs font-mono text-blue-400 flex items-center gap-1.5"><Users className="w-3 h-3" /> {pm?.full_name || pm?.email || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-mono text-white/85 uppercase mb-2">Engineers ({squadDevs.length})</p>
                        <div className="space-y-1.5">
                          {squadDevs.length === 0 && <p className="text-[10px] font-mono text-white/70 italic">None assigned</p>}
                          {squadDevs.map(d => (
                            <p key={d?.id} className="text-xs font-mono text-white/80">{(d && userCustomRoles[d.id]) || d?.full_name || d?.email}</p>
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
          {currentUserRole === 'super_admin' && (
            <div className="border border-white/10 bg-[#0c0c0c] p-6 lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Invite Form */}
              <div>
                <h3 className="text-sm font-mono uppercase tracking-widest mb-6">Invite Organization Member</h3>
                <form onSubmit={handleSendInvitation} className="space-y-4">
                  {inviteError && (
                    <div className="border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                      {inviteError}
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Member Email</label>
                    <input
                      required
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      className="w-full bg-black border border-white/10 h-10 px-3 font-mono text-xs focus:border-white/40 outline-none placeholder:text-white/70 text-white"
                      placeholder="teammate@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Assigned Role</label>
                    <select
                      required
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as any)}
                      className="w-full bg-black border border-white/10 h-10 px-3 font-mono text-xs focus:border-white/40 outline-none text-white/80"
                    >
                      <option value="developer">Developer</option>
                      <option value="pm">Project Manager</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="w-full bg-white text-black h-10 font-semibold hover:bg-neutral-200 transition-colors uppercase text-xs tracking-widest disabled:opacity-50"
                  >
                    {inviting ? 'Inviting...' : 'Send Invitation'}
                  </button>
                </form>
              </div>

              {/* Pending Invites List */}
              <div>
                <h3 className="text-sm font-mono uppercase tracking-widest mb-6">Pending Invitations</h3>
                <div className="divide-y divide-white/5 border border-white/10 max-h-[220px] overflow-y-auto bg-black p-4 rounded-sm">
                  {invitations.map(inv => (
                    <div key={inv.id} className="flex justify-between items-center py-3 hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono text-white/85">{inv.email}</span>
                        <span className="text-[9px] font-mono text-white/45 uppercase mt-1">Role: {inv.role}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevokeInvitation(inv.id)}
                        className="text-[9px] font-mono text-red-500 hover:text-red-400 uppercase tracking-widest px-3 py-1.5 border border-white/10 hover:border-red-500/30 transition-colors bg-white/5 hover:bg-white/10"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                  {invitations.length === 0 && (
                    <div className="text-center py-8 text-xs font-mono text-white/40 italic">
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
