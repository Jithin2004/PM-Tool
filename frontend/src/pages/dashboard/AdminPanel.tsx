import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useDashboard } from '../../context/DashboardContext';
import { CompanyCalendarPanel } from '../../components/admin/CompanyCalendarPanel';
import { hasCapability } from '../../core/auth/permissions';
import { Icon } from '../../components/ui/Icon';
import { supabase } from '../../lib/supabase';
import { InviteService } from '../../services/inviteService';
import { EnterpriseImportCenter } from './EnterpriseImportCenter';
import { SystemInfoPanel } from '../../components/admin/SystemInfoPanel';
import { SystemHealthPanel } from '../../components/admin/SystemHealthPanel';
import { BackupRestorePanel } from '../../components/admin/BackupRestorePanel';
import { StorageSettingsPanel } from '../../components/admin/StorageSettingsPanel';
import { RolesPermissionsPanel } from '../../components/admin/RolesPermissionsPanel';
import { getWorkspaceDisplayName } from '../../lib/workspaceDisplayName';
import { showConfirm, showPrompt } from '../../components/common/Dialogs';
import IntegrationCenter from '../workspace/IntegrationCenter';
type TopTab = 'company' | 'people' | 'workspace' | 'system';

function getInitials(name: string) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function getRoleColor(role: string) {
  const r = role as UserRole;
  if (hasCapability(r, 'workspace.update')) return 'var(--pm-primary)';
  if (hasCapability(r, 'project.update')) return 'var(--pm-secondary)';
  if (hasCapability(r, 'project.view') && !hasCapability(r, 'task.update')) return 'var(--pm-on-surface-variant)';
  return 'var(--pm-tertiary)';
}

function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin:       'HR',
    manager:     'Project Manager',
    pm:          'Project Manager',
    editor:      'Employee',
    developer:   'Employee',
    viewer:      'External Access',
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
    handleUpdateRole,
    handleCreateTeam,
    handleUpdateTeam,
    handleDeleteTeam,
    notify,
    invalidateAll,
  } = useDashboard();

  const [activeTopTab, setActiveTopTab] = useState<TopTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'backup') return 'system';
    if (tab === 'teams') return 'people';
    return 'company';
  });
  const [activeSubTab, setActiveSubTab] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'backup') return 'backup';
    if (tab === 'teams' || tab === 'users') return 'users';
    return 'calendar';
  });
  const [activeGearPopover, setActiveGearPopover] = useState<string | null>(null);
  const [capabilityModal, setCapabilityModal] = useState({ isOpen: false, userId: '', userEmail: '', capabilities: [] as string[], reason: '', saving: false });

  // Event listener for opening capability modal and syncing tabs
  useEffect(() => {
    const handleOpen = (e: any) => {
      setCapabilityModal({
        isOpen: true,
        userId: e.detail.userId,
        userEmail: e.detail.userEmail,
        capabilities: e.detail.currentCapabilities || [],
        reason: '',
        saving: false
      });
    };
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab) {
        if (tab === 'backup') setActiveTopTab('system');
        else if (tab === 'teams') setActiveTopTab('people');
        else setActiveTopTab('company');
        
        if (tab === 'backup') setActiveSubTab('backup');
        else if (tab === 'teams' || tab === 'users') setActiveSubTab('users');
        else setActiveSubTab('calendar');
      }
    };
    window.addEventListener('open-capability-modal', handleOpen);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('open-capability-modal', handleOpen);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);
  const { workspace, user: currentUserProfile, updateWorkspaceSettings } = useWorkspace();
  const canGovernPlatform = hasCapability(profile?.role, 'workspace.update');
  const canViewCalendar = hasCapability(profile?.role, 'decision.view');

  const [savingSettings, setSavingSettings] = useState(false);

  // Invitation state
  const [invitations, setInvitations] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('developer');
  const [inviteFunctions, setInviteFunctions] = useState<string[]>([]);
  const [inviteDesignation, setInviteDesignation] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Team creation state
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedPm, setSelectedPm] = useState('');
  const [selectedDevs, setSelectedDevs] = useState<string[]>([]);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showDesignations, setShowDesignations] = useState(false);
  const [newCustomDesignation, setNewCustomDesignation] = useState('');

  // Workspaces Registry Management state and handlers
  const [workspacesList, setWorkspacesList] = useState<any[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  const loadWorkspacesData = async () => {
    setLoadingWorkspaces(true);
    try {
      const { data: wsData, error: wsError } = await supabase.from('workspaces').select('id, name, owner_id, business_type, created_at');
      if (wsError) throw wsError;
      
      const { data: userData, error: userError } = await supabase.from('users').select('id, workspace_id');
      if (userError) throw userError;
      
      const { data: projData, error: projError } = await supabase.from('projects').select('id, workspace_id').is('deleted_at', null);
      if (projError) throw projError;
      
      const { data: taskData, error: taskError } = await supabase.from('tasks').select('workspace_id, updated_at').order('updated_at', { ascending: false });
      if (taskError) throw taskError;

      const compiled = (wsData || []).map((ws: any) => {
        const wsUsers = (userData || []).filter((u: any) => u.workspace_id === ws.id);
        const wsProjects = (projData || []).filter((p: any) => p.workspace_id === ws.id);
        const wsTasks = (taskData || []).filter((t: any) => t.workspace_id === ws.id);
        
        let lastActivity = ws.created_at;
        if (wsTasks.length > 0 && wsTasks[0].updated_at) {
          lastActivity = wsTasks[0].updated_at;
        }

        return {
          ...ws,
          userCount: wsUsers.length,
          projectCount: wsProjects.length,
          lastActivityDate: lastActivity
        };
      });

      setWorkspacesList(compiled);
    } catch (err: any) {
      notify(err.message || "Failed to load workspaces data", "error");
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'registry') {
      loadWorkspacesData();
    }
  }, [activeSubTab]);

  const handleArchiveWorkspace = async (workspaceId: string) => {
    if (await showConfirm("Are you sure you want to archive/retire this workspace? Tasks updates will be disabled.", { title: "Archive Workspace", confirmText: "Archive", type: 'warning' })) {
      const { error } = await supabase
        .from('workspaces')
        .update({ status: 'retired' })
        .eq('id', workspaceId);
      if (error) {
        notify("Failed to archive workspace: " + error.message, "error");
      } else {
        notify("Workspace status set to retired.", "success");
        loadWorkspacesData();
      }
    }
  };

  const handleResetSandbox = async (workspaceId: string) => {
    if (await showConfirm("Are you sure you want to purge all projects, tasks, collaborators, and dependencies from this sandbox? This cannot be undone.", { title: "Reset Sandbox Workspace", confirmText: "Reset", type: 'error' })) {
      try {
        await supabase.from('task_collaborators').delete().eq('workspace_id', workspaceId);
        await supabase.from('task_dependencies').delete().eq('workspace_id', workspaceId);
        await supabase.from('tasks').delete().eq('workspace_id', workspaceId);
        await supabase.from('projects').delete().eq('workspace_id', workspaceId);
        notify("Sandbox workspace successfully reset.", "success");
        loadWorkspacesData();
      } catch (err: any) {
        notify("Failed to reset sandbox: " + err.message, "error");
      }
    }
  };

  const handleDeleteSandbox = async (workspaceId: string) => {
    if (await showConfirm("Are you sure you want to set this sandbox workspace status to inactive?", { title: "Deactivate Sandbox", confirmText: "Deactivate", type: 'warning' })) {
      const { error } = await supabase
        .from('workspaces')
        .update({ status: 'inactive' })
        .eq('id', workspaceId);
      if (error) {
        notify("Failed to deactivate sandbox: " + error.message, "error");
      } else {
        notify("Sandbox set to inactive.", "success");
        loadWorkspacesData();
      }
    }
  };

  const handleRestoreWorkspace = async (workspaceId: string) => {
    if (await showConfirm("Are you sure you want to restore this workspace to active status?", { title: "Restore Workspace", confirmText: "Restore" })) {
      const { error } = await supabase
        .from('workspaces')
        .update({ status: 'active' })
        .eq('id', workspaceId);
      if (error) {
        notify("Failed to restore workspace: " + error.message, "error");
      } else {
        notify("Workspace status set to active.", "success");
        loadWorkspacesData();
      }
    }
  };

  const handleExportWorkspace = async (ws: any) => {
    notify("Preparing export data...", "info");
    try {
      const [projectsRes, tasksRes, teamsRes, depsRes, collabsRes] = await Promise.all([
        supabase.from('projects').select('id, workspace_id, client_id, name, description, status, priority, execution_mode, created_at, deadline, tags').eq('workspace_id', ws.id),
        supabase.from('tasks').select('*').eq('workspace_id', ws.id),
        supabase.from('teams').select('*').eq('workspace_id', ws.id),
        supabase.from('task_dependencies').select('*').eq('workspace_id', ws.id),
        supabase.from('task_collaborators').select('*').eq('workspace_id', ws.id),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        workspace: {
          id: ws.id,
          name: ws.name,
          status: ws.status,
          metadata: ws.metadata,
          created_at: ws.created_at,
        },
        projects: projectsRes.data || [],
        tasks: tasksRes.data || [],
        teams: teamsRes.data || [],
        dependencies: depsRes.data || [],
        collaborators: collabsRes.data || [],
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `workspace_export_${ws.name.replace(/\s+/g, '_')}_${ws.id}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      notify("Workspace data exported successfully.", "success");
    } catch (err: any) {
      notify("Export failed: " + err.message, "error");
    }
  };

  const pms = profiles.filter(p => hasCapability(p.role as UserRole, 'project.update'));
  const devs = profiles.filter(p => !hasCapability(p.role as UserRole, 'project.update'));
  const assignedDevIds = new Set(
    teams
      .filter(t => t.id !== editingTeamId)
      .flatMap(t => {
        const d = typeof t.data === 'string' ? JSON.parse(t.data) : t.data;
        return d?.developer_ids || [];
      })
  );
  const availableDevs = devs.filter(d => !assignedDevIds.has(d.id));

  const fetchInvitations = async () => {
    if (!canGovernPlatform || !workspace?.id) return;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('status', 'invited')
      .eq('workspace_id', workspace.id);
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

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { mapAuthorityToLegacyRole } = await import('../../core/types/workspace');

      const res = await supabase.functions.invoke('provisioning', {
        body: {
          operation: 'invite_user',
          email,
          role: mapAuthorityToLegacyRole(inviteRole),
          capabilities: inviteFunctions,
          designation: inviteDesignation,
          source: 'manual'
        }
      });

      if (res.error) {
        throw res.error;
      }

      const result = res.data;
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to create invitation');
      }

      setInviteEmail('');
      setInviteRole('developer');
      setInviteFunctions([]);
      setInviteDesignation('');
      fetchInvitations();
    } catch (err: any) {
      setInviteError(err?.message || "Failed to send invitation.");
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvitation = async (id: string) => {
    if (await showConfirm("Are you sure you want to revoke this invitation? The user will no longer be allowed to join.", { title: "Revoke Invitation", confirmText: "Revoke", type: 'warning' })) {
      const { error } = await supabase
        .from('users')
        .update({ status: 'disabled', invite_token: null, invite_expires_at: null })
        .eq('id', id);
      if (!error) {
        fetchInvitations();
        notify("Invitation revoked successfully", "success");
      } else {
        notify("Failed to revoke invitation", "error");
      }
    }
  };

  const handleCreateTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName || !selectedPm) return;

    if (editingTeamId) {
      handleUpdateTeam(editingTeamId, newTeamName, selectedPm, selectedDevs);
      setEditingTeamId(null);
    } else {
      handleCreateTeam(newTeamName, selectedPm, selectedDevs);
    }

    setNewTeamName('');
    setSelectedPm('');
    setSelectedDevs([]);
  };

  const startEditingTeam = (team: any) => {
    setEditingTeamId(team.id);
    setNewTeamName(team.name);
    setSelectedPm((team.data as Record<string, unknown>)?.pm_id as string || '');
    setSelectedDevs((team.data as Record<string, unknown>)?.developer_ids as string[] || []);

    const form = document.getElementById('team-form');
    if (form) form.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEditingTeam = () => {
    setEditingTeamId(null);
    setNewTeamName('');
    setSelectedPm('');
    setSelectedDevs([]);
    setShowTeamForm(false);
  };

  const customRoles: string[] = systemData.customRoles || ['Developer', 'Designer', 'QA Engineer', 'Viewer'];
  const userCustomRoles: Record<string, string> = systemData.userCustomRoles || {};

  const handleAssignCustomRoleLocal = async (userId: string, designation: string) => {
    const userProfile = profiles.find(p => p.id === userId);
    const targetName = userProfile?.full_name || userProfile?.email || "this user";

    if (await showConfirm(`Confirm action: Change designation of ${targetName} to '${designation}'?`, { title: "Confirm Designation Change", confirmText: "Change", type: 'warning' })) {
      const { error } = await supabase.from('users').update({ designation }).eq('id', userId);
      if (!error) {
        notify("Designation updated successfully.", "success");
        invalidateAll();
      } else {
        notify("Failed to update designation: " + error.message, "error");
      }
      setActiveGearPopover(null);
    }
  };

  if (!hasCapability(profile?.role, 'settings.manage')) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 font-geist"
        style={{ color: 'var(--pm-on-surface-variant)' }}>
        <Icon name="lock" size={40} style={{ opacity: 0.3 }} />
        <div className="text-center">
          <p className="font-mono-pm text-[11px] uppercase tracking-widest mb-1" style={{ color: 'var(--pm-error)' }}>
            ACCESS DENIED
          </p>
          <p className="text-sm">Admin governance privileges required to access this console.</p>
        </div>
      </div>
    );
  }

  const activeTeams = teams.filter(t => t.name !== 'SYSTEM_SETTINGS');
  const activeProfiles = profiles || [];

  
  const TOP_TABS = [
    { id: 'company', label: 'Company' },
    { id: 'people', label: 'People & Access' },
    { id: 'workspace', label: 'Workspace' },
    { id: 'system', label: 'System' }
  ] as const;

  const SUB_TABS: Record<TopTab, { id: string; label: string; icon: string }[]> = {
    company: [
      { id: 'calendar', label: 'Calendar', icon: 'calendar_month' }
    ],
    people: [
      { id: 'users', label: 'Users', icon: 'groups' },
      { id: 'roles', label: 'Roles & Permissions', icon: 'admin_panel_settings' },
      { id: 'security', label: 'Security', icon: 'security' }
    ],
    workspace: [
      { id: 'rules', label: 'Rules', icon: 'gavel' },
      { id: 'data_management', label: 'Data Management', icon: 'cloud_upload' },
      { id: 'storage', label: 'Storage', icon: 'sd_storage' },
      { id: 'integrations', label: 'Integrations', icon: 'extension' }
    ],
    system: [
      { id: 'health', label: 'Health', icon: 'monitor_heart' },
      { id: 'backup', label: 'Backup', icon: 'settings_backup_restore' },
      { id: 'audit_logs', label: 'Audit Logs', icon: 'history' },
      { id: 'registry', label: 'Workspace Registry', icon: 'dns' }
    ]
  };

  useEffect(() => {
    setActiveSubTab(SUB_TABS[activeTopTab][0].id);
  }, [activeTopTab]);

  return (
    <div className="flex flex-col gap-6 font-geist" style={{ color: 'var(--pm-on-surface)' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Access Control</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Manage workspace roles and access.
          </p>
        </div>
        <span className="font-mono-pm text-[10px] uppercase tracking-[0.2em] px-3 py-1 rounded"
          style={{ background: 'rgba(192,193,255,0.05)', border: '1px solid rgba(192,193,255,0.1)', color: 'var(--pm-primary)' }}>
          {activeProfiles.length} ACTIVE MEMBERS
        </span>
      </div>

      {/* Top Tab Bar */}
      <div className="flex gap-4 border-b pb-0" style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
        {TOP_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTopTab(t.id)}
            className="flex items-center gap-2 px-2 py-2.5 text-base font-semibold transition-all relative"
            style={{
              color: activeTopTab === t.id ? 'var(--pm-primary)' : 'var(--pm-on-surface-variant)',
              borderBottom: activeTopTab === t.id ? '2px solid var(--pm-primary)' : '2px solid transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub Tab Bar */}
      <div className="flex gap-2 pb-0 mb-2">
        {SUB_TABS[activeTopTab].map(t => (
          <button key={t.id} onClick={() => setActiveSubTab(t.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              color: activeSubTab === t.id ? 'white' : 'var(--pm-on-surface-variant)',
              background: activeSubTab === t.id ? 'var(--pm-surface-high)' : 'transparent',
              border: activeSubTab === t.id ? '1px solid rgba(192,193,255,0.1)' : '1px solid transparent'
            }}>
            <Icon name={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Views */}
{activeSubTab === 'calendar' && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(70,69,84,0.3)' }}>
          <CompanyCalendarPanel />
        </div>
      )}



      {activeSubTab === 'users' && (
        <div className="space-y-8">
          {/* Identity Table */}
          <div className="rounded-xl shadow-2xl overflow-visible"
            style={{ background: 'var(--pm-surface-low)', border: '1px solid rgba(70,69,84,0.3)' }}>
            <table className="w-full text-left border-collapse executive-table min-w-[800px]">
              <thead style={{ background: 'rgba(51,53,55,0.5)', borderBottom: '1px solid rgba(70,69,84,0.3)' }}>
                <tr>
                  {['Member', 'Role', 'Permissions', 'Settings'].map((h, i, arr) => (
                    <th key={h} className={`px-8 py-4 ${i === 0 ? 'rounded-tl-xl' : ''} ${i === arr.length - 1 ? 'rounded-tr-xl' : ''}`}>{h}</th>
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
                      {/* Member */}
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
                      {/* Role */}
                      <td className="px-8 py-5">
                        <div className="flex flex-col items-start gap-1.5">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider"
                            style={{ background: `${roleColor}12`, color: roleColor, border: `1px solid ${roleColor}25` }}>
                            {getRoleLabel(p.role)}
                          </span>
                          {p.designation && (
                            <span className="text-[11px] font-mono-pm" style={{ color: 'var(--pm-on-surface-variant)' }}>
                              {p.designation}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Permissions bar */}
                      <td className="px-8 py-5">
                        <div className="w-40 space-y-1.5">
                          <div className="h-1.5 w-full rounded-full overflow-hidden"
                            style={{ background: 'rgba(70,69,84,0.2)' }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${accessPct}%`, background: roleColor, boxShadow: accessPct === 100 ? `0 0 8px ${roleColor}60` : 'none' }} />
                          </div>
                          <span className="font-mono-pm text-[9px] uppercase tracking-widest"
                            style={{ color: roleColor, opacity: 0.8 }}>
                            {accessPct === 100 ? 'Full Access' : accessPct >= 60 ? 'Admin Access' : 'Standard Access'}
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
                          <div className="absolute right-12 top-12 w-64 rounded-xl shadow-2xl z-50 p-5 flex flex-col gap-4"
                            style={{ background: 'var(--pm-surface-high)', border: '1px solid rgba(70,69,84,0.3)' }}>
                            <div className="text-[10px] font-mono-pm uppercase tracking-widest text-center border-b pb-2" style={{ borderColor: 'rgba(70,69,84,0.1)', color: 'var(--pm-on-surface-variant)' }}>
                              Security &amp; Governance
                            </div>
                            
                            {p.role !== 'super_admin' ? (
                              <>
                                {/* Role Calibration */}
                                <div className="mb-4 space-y-3 border-b pb-4" style={{ borderColor: 'rgba(70,69,84,0.2)' }}>
                                  <div>
                                    <label className="block text-[9px] font-mono-pm uppercase tracking-widest mb-1.5" style={{ color: 'var(--pm-on-surface-variant)' }}>Authority Level</label>
                                    <select
                                      value={p.role}
                                      onChange={async (e) => {
                                        const authVal = e.target.value as any;
                                        if (await showConfirm(`Confirm action: Change authority of ${p.full_name || p.email} to '${authVal}'?`, { title: "Change Authority Level", confirmText: "Change", type: 'warning' })) {
                                          await handleUpdateRole(p.id, authVal);
                                          notify("Authority updated successfully.", "success");
                                          setActiveGearPopover(null);
                                        }
                                      }}
                                      className="w-full border rounded text-[11px] font-mono-pm px-2 py-1.5 outline-none bg-bg"
                                      style={{ borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)', background: 'var(--pm-surface-lowest)' }}
                                    >
                                      <option value="admin">Workspace Admin</option>
                                      <option value="project_manager">Project Manager</option>
                                      <option value="team_lead">Team Lead</option>
                                      <option value="developer">Developer</option>
                                      <option value="employee">Employee</option>
                                      <option value="hr">HR</option>
                                      <option value="finance">Finance</option>
                                      <option value="client">Client</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-mono-pm uppercase tracking-widest mb-1.5" style={{ color: 'var(--pm-on-surface-variant)' }}>Designation</label>
                                    <input
                                      type="text"
                                      value={p.designation || ''}
                                      onChange={(e) => {
                                        // Update local state optimistic UI if needed, but easier to use onBlur or save button
                                      }}
                                      onBlur={(e) => handleAssignCustomRoleLocal(p.id, e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') handleAssignCustomRoleLocal(p.id, e.currentTarget.value) }}
                                      className="w-full border rounded text-[11px] font-mono-pm px-2 py-1.5 outline-none bg-bg"
                                      style={{ borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)', background: 'var(--pm-surface-lowest)' }}
                                      placeholder="e.g. CTO"
                                    />
                                  </div>
                                </div>
                                {/* Manage Capabilities Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveGearPopover(null);
                                    // Trigger capabilities modal event
                                    window.dispatchEvent(new CustomEvent('open-capability-modal', { detail: { userId: p.id, userEmail: p.email, currentCapabilities: p.capabilities || [] } }));
                                  }}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-[11px] font-mono-pm uppercase tracking-widest transition-all mb-3"
                                  style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}
                                >
                                  <Icon name="verified_user" size={14} />
                                  Manage Capabilities
                                </button>

                                {/* Enable / Disable Account Button */}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setActiveGearPopover(null);
                                    const isDisabled = !hasCapability(p.role as UserRole, 'project.view');
                                    const actionText = isDisabled ? "Enable" : "Disable";
                                    if (await showConfirm(`Are you sure you want to ${actionText.toLowerCase()} access for ${p.full_name || p.email}?`, { title: `${actionText} Account`, confirmText: actionText, type: 'warning' })) {
                                      const targetRole = isDisabled ? 'developer' : 'uninvited';
                                      await handleUpdateRole(p.id, targetRole);
                                      notify(`Account for ${p.full_name || p.email} has been ${isDisabled ? 'enabled' : 'disabled'}.`, "success");
                                    }
                                  }}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-[11px] font-mono-pm uppercase tracking-widest transition-all"
                                  style={{
                                    background: !hasCapability(p.role as UserRole, 'project.view') ? 'rgba(52,211,153,0.1)' : 'rgba(245,158,11,0.1)',
                                    color: !hasCapability(p.role as UserRole, 'project.view') ? 'var(--pm-primary)' : 'var(--pm-secondary)',
                                    border: !hasCapability(p.role as UserRole, 'project.view') ? '1px solid rgba(52,211,153,0.2)' : '1px solid rgba(245,158,11,0.2)'
                                  }}
                                >
                                  <Icon name={!hasCapability(p.role as UserRole, 'project.view') ? "person" : "block"} size={14} />
                                  {!hasCapability(p.role as UserRole, 'project.view') ? 'Enable Account' : 'Disable Account'}
                                </button>

                                {/* Remove Person Button */}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setActiveGearPopover(null);
                                    const answer = await showPrompt(`Are you sure you want to delete ${p.full_name || p.email} entirely from the database? Type "PERMANENTLY REMOVE" to continue.`, { title: "Remove Person", confirmText: "Remove", type: 'error' });
                                    if (answer === 'PERMANENTLY REMOVE') {
                                      const { error } = await supabase.from('users').delete().eq('id', p.id);
                                      if (!error) {
                                        notify("Member removed entirely from database.", "success");
                                        invalidateAll();
                                      } else {
                                        notify(`Failed to remove member: ${error.message}`, "error");
                                      }
                                    } else if (answer !== null) {
                                      notify("Confirmation failed. Incorrect phrase.", "error");
                                    }
                                  }}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-[11px] font-mono-pm uppercase tracking-widest transition-all"
                                  style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--pm-error)', border: '1px solid rgba(239,68,68,0.2)' }}
                                >
                                  <Icon name="person_remove" size={14} />
                                  Remove Person
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] font-mono-pm uppercase italic text-center text-text-tertiary">Super Admin Protected</span>
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
              Workspace Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Invite Member */}
              <div 
                className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-7 group relative overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                onClick={() => setShowInviteForm(!showInviteForm)}
              >
                <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-all"
                  style={{ background: 'rgba(192,193,255,0.08)' }} />
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-105"
                  style={{ background: 'rgba(192,193,255,0.08)', border: '1px solid rgba(192,193,255,0.15)' }}>
                  <Icon name="person_add" size={24} style={{ color: 'var(--pm-primary)' }} />
                </div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--pm-on-surface)' }}>Workspace Invitations</h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--pm-on-surface-variant)' }}>
                  Invite new members to the workspace and manage pending invitations.
                </p>
                <div className="flex items-center gap-2 font-mono-pm text-[11px] uppercase tracking-[0.2em]"
                  style={{ color: 'var(--pm-primary)' }}>
                  <span>{showInviteForm ? 'Close Form' : 'Open Form'}</span>
                  <Icon name="arrow_forward" size={14} className={`transition-transform ${showInviteForm ? 'rotate-90' : 'group-hover:translate-x-1'}`} />
                </div>
              </div>

              {/* Designations */}
              <div 
                className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-7 group relative overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                onClick={() => {
                  setShowDesignations(!showDesignations);
                  if (!showDesignations) {
                    setShowInviteForm(false);
                  }
                }}
              >
                <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-all"
                  style={{ background: 'rgba(192,193,255,0.05)' }} />
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-105"
                  style={{ background: 'rgba(192,193,255,0.08)', border: '1px solid rgba(192,193,255,0.15)' }}>
                  <Icon name="admin_panel_settings" size={24} style={{ color: 'var(--pm-secondary)' }} />
                </div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--pm-on-surface)' }}>Designation Registry</h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--pm-on-surface-variant)' }}>
                  Manage custom roles and professional designations across the workspace.
                </p>
                <div className="flex items-center gap-2 font-mono-pm text-[11px] uppercase tracking-[0.2em]"
                  style={{ color: 'var(--pm-secondary)' }}>
                  <span>{showDesignations ? 'Close Registry' : 'Manage Designations'}</span>
                  <Icon name="arrow_forward" size={14} className={`transition-transform ${showDesignations ? 'rotate-90' : 'group-hover:translate-x-1'}`} />
                </div>
              </div>

              {/* System Overview */}
              <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-7 flex flex-col shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <span className="font-mono-pm text-[10px] uppercase tracking-[0.3em]"
                    style={{ color: 'var(--pm-on-surface-variant)' }}>
                    System Overview
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
                      Active Members
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
                    Systems operational
                  </p>
                </div>
              </div>
            </div>
            
            {showInviteForm && canGovernPlatform && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm">
                  <h3 className="font-semibold mb-6 flex items-center gap-2">
                    <Icon name="lock" size={18} style={{ color: 'var(--pm-primary)' }} />
                    Send Invitation
                  </h3>
                  <form onSubmit={handleSendInvitation} className="space-y-4">
                    {inviteError && (
                      <div className="border p-3 text-xs rounded-lg" style={{ borderColor: 'rgba(255,100,100,0.3)', background: 'rgba(255,100,100,0.05)', color: 'var(--pm-error)' }}>
                        {inviteError}
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-mono-pm uppercase tracking-widest mb-2" style={{ color: 'var(--pm-on-surface-variant)' }}>Member Email</label>
                      <input
                        required
                        type="email"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        className="w-full border rounded-lg h-10 px-3 font-mono-pm text-xs outline-none transition-colors"
                        style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                        placeholder="teammate@company.com"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono-pm uppercase tracking-widest mb-2" style={{ color: 'var(--pm-on-surface-variant)' }}>Authority Level</label>
                      <select
                        required
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value as any)}
                        className="w-full border rounded-lg h-10 px-3 font-mono-pm text-xs outline-none transition-colors"
                        style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                      >
                        <option value="admin">Admin</option>
                        <option value="project_manager">Project Manager</option>
                        <option value="team_lead">Team Lead</option>
                        <option value="developer">Developer</option>
                        <option value="employee">Employee</option>
                        <option value="hr">HR</option>
                        <option value="finance">Finance</option>
                        <option value="client">Client</option>
                      </select>
                      <p className="mt-2 text-[10px] font-mono-pm text-text-tertiary">
                        {inviteRole === 'owner' && "Full workspace control"}
                        {inviteRole === 'admin' && "Manage workspace settings and users"}
                        {inviteRole === 'manager' && "Manage projects and team work"}
                        {inviteRole === 'employee' && "Complete assigned work"}
                        {inviteRole === 'developer' && "Build and complete technical tasks"}
                        {inviteRole === 'finance' && "Manage money, invoices, and reports"}
                        {inviteRole === 'hr' && "Manage people, attendance, and approvals"}
                        {inviteRole === 'client' && "View shared progress"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono-pm uppercase tracking-widest mb-2" style={{ color: 'var(--pm-on-surface-variant)' }}>Designation</label>
                      <input
                        type="text"
                        value={inviteDesignation}
                        onChange={e => setInviteDesignation(e.target.value)}
                        className="w-full border rounded-lg h-10 px-3 font-mono-pm text-xs outline-none transition-colors"
                        style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                        placeholder="e.g. Senior Engineer"
                      />
                    </div>
                    <div>
                      <div>
                        <details className="group">
                          <summary className="text-[10px] font-mono-pm uppercase tracking-widest mb-2 cursor-pointer hover:text-indigo-400 transition-colors list-none" style={{ color: 'var(--pm-on-surface-variant)' }}>
                            Customize Permissions <span className="inline-block transition-transform group-open:rotate-180">▼</span>
                          </summary>
                          <div className="grid grid-cols-2 gap-2 mt-2 pl-2 border-l border-[var(--border-soft)]">
                            {['Projects', 'Engineering', 'Finance', 'PeopleOperations', 'Clients', 'Documents', 'Operations'].map(func => (
                              <label key={func} className="flex items-center gap-2 cursor-pointer group/item">
                                <input
                                  type="checkbox"
                                  checked={inviteFunctions.includes(func)}
                                  onChange={(e) => {
                                    if (e.target.checked) setInviteFunctions(prev => [...prev, func]);
                                    else setInviteFunctions(prev => prev.filter(f => f !== func));
                                  }}
                                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                />
                                <span className="text-[11px] text-[var(--pm-on-surface)] group-hover/item:text-indigo-400 transition-colors">
                                  {func === 'PeopleOperations' ? 'People' : func}
                                </span>
                              </label>
                            ))}
                          </div>
                        </details>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={inviting}
                      className="w-full rounded-lg h-10 font-bold uppercase text-[10px] tracking-widest transition-all disabled:opacity-50"
                      style={{ background: 'rgba(192,193,255,0.1)', color: 'var(--pm-primary)', border: '1px solid rgba(192,193,255,0.2)' }}
                      onMouseEnter={e => { (e.currentTarget as any).style.background = 'rgba(192,193,255,0.15)'; }}
                      onMouseLeave={e => { (e.currentTarget as any).style.background = 'rgba(192,193,255,0.1)'; }}
                    >
                      {inviting ? 'Inviting...' : 'Send Invitation'}
                    </button>
                  </form>
                </div>
                
                <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm">
                  <h3 className="font-semibold mb-6 flex items-center gap-2">
                    <Icon name="group" size={18} style={{ color: 'var(--pm-tertiary)' }} />
                    Pending Invitations
                  </h3>
                  <div className="divide-y rounded-lg border max-h-[220px] overflow-y-auto p-4" style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)' }}>
                    {invitations.map(inv => {
                      const inviteUrl = window.location.origin + '/accept-invite/' + inv.token;
                      return (
                        <div key={inv.id} className="flex justify-between items-center py-3 hover:bg-[var(--pm-surface)]/5 transition-colors rounded px-2">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-mono-pm" style={{ color: 'var(--pm-on-surface-variant)' }}>{inv.email}</span>
                            <span className="text-[9px] font-mono-pm uppercase tracking-widest mt-1" style={{ color: 'var(--pm-primary)' }}>Role: {inv.role}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(inviteUrl);
                                window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: 'Invite link copied', type: 'success' }}));
                              }}
                              className="text-[9px] font-mono-pm uppercase tracking-widest px-3 py-1.5 rounded transition-all"
                              style={{ border: '1px solid rgba(100,200,100,0.3)', color: '#4ade80', background: 'rgba(100,200,100,0.05)' }}
                            >
                              Copy Link
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevokeInvitation(inv.id)}
                              className="text-[9px] font-mono-pm uppercase tracking-widest px-3 py-1.5 rounded transition-all"
                              style={{ border: '1px solid rgba(255,100,100,0.3)', color: 'var(--pm-error)', background: 'rgba(255,100,100,0.05)' }}
                              onMouseEnter={e => { (e.currentTarget as any).style.background = 'rgba(255,100,100,0.1)'; }}
                              onMouseLeave={e => { (e.currentTarget as any).style.background = 'rgba(255,100,100,0.05)'; }}
                            >
                              Revoke
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {invitations.length === 0 && (
                      <div className="text-center py-8 text-[11px] font-mono-pm italic" style={{ color: 'var(--pm-on-surface-variant)' }}>
                        No pending invitations.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showDesignations && (
              <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 mt-5 space-y-6 shadow-sm">
                <div className="flex justify-between items-center border-b pb-4" style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Icon name="admin_panel_settings" size={22} style={{ color: 'var(--pm-secondary)' }} />
                      Designation Registry
                    </h3>
                    <p className="text-xs text-text-tertiary mt-1">Configure professional designations and map workspace roles.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Create Custom Designation Form */}
                  <div className="lg:col-span-1 border-r pr-6 space-y-4" style={{ borderColor: 'rgba(70,69,84,0.2)' }}>
                    <h4 className="font-mono-pm text-[11px] uppercase tracking-widest text-text-secondary">Register Custom Designation</h4>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const name = newCustomDesignation.trim();
                        if (!name) return;
                        if (customRoles.includes(name)) {
                          notify("Designation already exists.", "warning");
                          return;
                        }
                        const updated = [...customRoles, name];
                        await handleSaveLogisticsData({
                          ...systemData,
                          customRoles: updated
                        });
                        setNewCustomDesignation('');
                        notify(`Designation '${name}' added to workspace registry.`, "success");
                      }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-[9px] font-mono-pm uppercase tracking-widest mb-1.5" style={{ color: 'var(--pm-on-surface-variant)' }}>Designation Label</label>
                        <input
                          required
                          type="text"
                          value={newCustomDesignation}
                          onChange={e => setNewCustomDesignation(e.target.value)}
                          className="w-full border rounded-lg h-10 px-3 font-mono-pm text-xs outline-none focus:border-[var(--border-soft)] transition-all text-text-primary bg-bg"
                          style={{ borderColor: 'rgba(70,69,84,0.3)' }}
                          placeholder="e.g. Lead QA Engineer"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full rounded-lg h-10 font-bold uppercase text-[10px] tracking-widest transition-all"
                        style={{ background: 'rgba(192,193,255,0.1)', color: 'var(--pm-primary)', border: '1px solid rgba(192,193,255,0.2)' }}
                      >
                        Add Designation
                      </button>
                    </form>
                  </div>

                  {/* Registry Assignments have been migrated to the workspace identity gear menu */}
                  <div className="lg:col-span-2 space-y-4">
                    <h4 className="font-mono-pm text-[11px] uppercase tracking-widest text-text-secondary">Assignments Migrated</h4>
                    <div className="p-6 border rounded-lg flex flex-col items-center justify-center text-center" style={{ borderColor: 'rgba(70,69,84,0.3)', background: 'var(--pm-surface-lowest)' }}>
                      <Icon name="info" size={24} style={{ color: 'var(--pm-on-surface-variant)' }} className="mb-3" />
                      <p className="text-sm font-medium mb-1" style={{ color: 'var(--pm-on-surface)' }}>Role Assignments Relocated</p>
                      <p className="text-xs" style={{ color: 'var(--pm-on-surface-variant)' }}>
                        You can now change member access roles and custom designations directly from the gear icon in the Workspace Access table.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>


        </div>
      )}

      {activeSubTab === 'roles' && (
        <div className="space-y-6">
          <div className="bg-[var(--pm-surface-low)] rounded-xl border border-[var(--pm-border)] p-4 shadow-sm">
            <RolesPermissionsPanel />
          </div>
          <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
              <Icon name="admin_panel_settings" size={22} style={{ color: 'var(--pm-secondary)' }} />
              Designation Registry
            </h3>
            <p className="text-xs text-text-tertiary mb-6">Manage custom roles and professional designations across the workspace.</p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 border-r pr-6 space-y-4" style={{ borderColor: 'rgba(70,69,84,0.2)' }}>
                <h4 className="font-mono-pm text-[11px] uppercase tracking-widest text-text-secondary">Register Custom Designation</h4>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const name = newCustomDesignation.trim();
                    if (!name) return;
                    if (customRoles.includes(name)) {
                      notify("Designation already exists.", "warning");
                      return;
                    }
                    const updated = [...customRoles, name];
                    await handleSaveLogisticsData({ ...systemData, customRoles: updated });
                    setNewCustomDesignation('');
                    notify(`Designation '${name}' added to workspace registry.`, "success");
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[9px] font-mono-pm uppercase tracking-widest mb-1.5" style={{ color: 'var(--pm-on-surface-variant)' }}>Designation Label</label>
                    <input required type="text" value={newCustomDesignation} onChange={e => setNewCustomDesignation(e.target.value)} className="w-full border rounded-lg h-10 px-3 font-mono-pm text-xs outline-none focus:border-[var(--border-soft)] transition-all text-text-primary bg-bg" style={{ borderColor: 'rgba(70,69,84,0.3)' }} placeholder="e.g. Lead QA Engineer" />
                  </div>
                  <button type="submit" className="w-full rounded-lg h-10 font-bold uppercase text-[10px] tracking-widest transition-all" style={{ background: 'rgba(192,193,255,0.1)', color: 'var(--pm-primary)', border: '1px solid rgba(192,193,255,0.2)' }}>
                    Add Designation
                  </button>
                </form>
              </div>
              <div className="lg:col-span-2 space-y-4">
                <h4 className="font-mono-pm text-[11px] uppercase tracking-widest text-text-secondary">Assignments</h4>
                <div className="p-6 border rounded-lg flex flex-col items-center justify-center text-center" style={{ borderColor: 'rgba(70,69,84,0.3)', background: 'var(--pm-surface-lowest)' }}>
                  <Icon name="info" size={24} style={{ color: 'var(--pm-on-surface-variant)' }} className="mb-3" />
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--pm-on-surface)' }}>Role Assignments Relocated</p>
                  <p className="text-xs" style={{ color: 'var(--pm-on-surface-variant)' }}>
                    You can change member access roles and custom designations directly from the gear icon in the Users table.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'security' && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 rounded-xl border border-dashed" style={{ borderColor: 'rgba(70,69,84,0.4)', background: 'rgba(70,69,84,0.05)' }}>
          <Icon name="security" size={48} style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.5 }} />
          <h3 className="text-lg font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Security Settings</h3>
          <p className="text-sm" style={{ color: 'var(--pm-on-surface-variant)' }}>Password policies, login rules, and authentication settings will be available here.</p>
        </div>
      )}

      {activeSubTab === 'rules' && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 rounded-xl border border-dashed" style={{ borderColor: 'rgba(70,69,84,0.4)', background: 'rgba(70,69,84,0.05)' }}>
          <Icon name="gavel" size={48} style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.5 }} />
          <h3 className="text-lg font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Workspace Rules</h3>
          <p className="text-sm" style={{ color: 'var(--pm-on-surface-variant)' }}>Project defaults, task settings, and workflow rules will be available here.</p>
        </div>
      )}
{activeSubTab === 'data_management' && (
        <div className="rounded-xl overflow-hidden">
          <EnterpriseImportCenter />
        </div>
      )}

      {activeSubTab === 'storage' && (
        <div className="rounded-xl overflow-hidden p-2">
          <StorageSettingsPanel />
        </div>
      )}


      {activeSubTab === 'integrations' && (
        <IntegrationCenter />
      )}

      {activeSubTab === 'health' && (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl overflow-hidden">
            <SystemInfoPanel />
          </div>
          <div className="rounded-xl overflow-hidden min-h-[600px]">
            <SystemHealthPanel />
          </div>
        </div>
      )}
{activeSubTab === 'backup' && (
        <div className="rounded-xl overflow-hidden">
          <BackupRestorePanel />
        </div>
      )}


      {activeSubTab === 'audit_logs' && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 rounded-xl border border-dashed" style={{ borderColor: 'rgba(70,69,84,0.4)', background: 'rgba(70,69,84,0.05)' }}>
          <Icon name="history" size={48} style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.5 }} />
          <h3 className="text-lg font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Audit Logs</h3>
          <p className="text-sm" style={{ color: 'var(--pm-on-surface-variant)' }}>View system-wide activity, access history, and permission changes.</p>
        </div>
      )}

{activeSubTab === 'registry' && (
        <div className="space-y-8">
          {loadingWorkspaces ? (
            <div className="text-center py-12 text-sm text-[var(--pm-on-surface-variant)]">
              Loading workspace registry data...
            </div>
          ) : (
            <div className="space-y-8">
              {/* Active Workspaces Section */}
              <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm">
                <h3 className="font-semibold mb-4 flex items-center gap-2 text-white">
                  <Icon name="check_circle" size={18} style={{ color: 'var(--pm-primary)' }} />
                  Active Workspaces &amp; Onboarding
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px] table-premium">
                    <thead>
                      <tr>
                        <th className="text-xs font-mono-pm uppercase tracking-wider">Workspace Name</th>
                        <th className="text-xs font-mono-pm uppercase tracking-wider">Status</th>
                        <th className="text-xs font-mono-pm uppercase tracking-wider">Members</th>
                        <th className="text-xs font-mono-pm uppercase tracking-wider">Active Projects</th>
                        <th className="text-xs font-mono-pm uppercase tracking-wider">Last Activity</th>
                        <th className="text-xs font-mono-pm uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {workspacesList.filter(w => w.status === 'active' || w.status === 'onboarding' || !w.status).map((ws: any) => (
                        <tr key={ws.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 text-sm font-medium text-white">{getWorkspaceDisplayName(ws.name, ws.status === 'sandbox')}</td>
                          <td className="py-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                              {ws.status || 'active'}
                            </span>
                          </td>
                          <td className="py-4 text-sm text-[var(--pm-on-surface-variant)]">{ws.userCount}</td>
                          <td className="py-4 text-sm text-[var(--pm-on-surface-variant)]">{ws.projectCount}</td>
                          <td className="py-4 text-sm text-[var(--pm-on-surface-variant)] font-mono-pm">{new Date(ws.lastActivityDate).toLocaleDateString()}</td>
                          <td className="py-4 text-right">
                            <button
                              onClick={() => handleArchiveWorkspace(ws.id)}
                              className="px-3 py-1.5 rounded text-[10px] font-mono-pm uppercase tracking-wider transition-all"
                              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--pm-secondary)' }}
                              onMouseEnter={e => { (e.currentTarget as any).style.background = 'rgba(245,158,11,0.18)'; }}
                              onMouseLeave={e => { (e.currentTarget as any).style.background = 'rgba(245,158,11,0.1)'; }}
                            >
                              Archive
                            </button>
                          </td>
                        </tr>
                      ))}
                      {workspacesList.filter(w => w.status === 'active' || w.status === 'onboarding' || !w.status).length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-xs italic text-[var(--pm-on-surface-variant)]">No active workspaces.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sandbox Environments Section */}
              <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm">
                <h3 className="font-semibold mb-4 flex items-center gap-2 text-white">
                  <Icon name="science" size={18} style={{ color: 'var(--pm-secondary)' }} />
                  Sandbox Environments
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px] table-premium">
                    <thead>
                      <tr>
                        <th className="text-xs font-mono-pm uppercase tracking-wider">Workspace Name</th>
                        <th className="text-xs font-mono-pm uppercase tracking-wider">Status</th>
                        <th className="text-xs font-mono-pm uppercase tracking-wider">Members</th>
                        <th className="text-xs font-mono-pm uppercase tracking-wider">Active Projects</th>
                        <th className="text-xs font-mono-pm uppercase tracking-wider">Last Activity</th>
                        <th className="text-xs font-mono-pm uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {workspacesList.filter(w => w.status === 'sandbox').map((ws: any) => (
                        <tr key={ws.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 text-sm font-medium text-white">{getWorkspaceDisplayName(ws.name, ws.status === 'sandbox')}</td>
                          <td className="py-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/25">
                              sandbox
                            </span>
                          </td>
                          <td className="py-4 text-sm text-[var(--pm-on-surface-variant)]">{ws.userCount}</td>
                          <td className="py-4 text-sm text-[var(--pm-on-surface-variant)]">{ws.projectCount}</td>
                          <td className="py-4 text-sm text-[var(--pm-on-surface-variant)] font-mono-pm">{new Date(ws.lastActivityDate).toLocaleDateString()}</td>
                          <td className="py-4 text-right space-x-2">
                            <button
                              onClick={() => handleResetSandbox(ws.id)}
                              className="px-3 py-1.5 rounded text-[10px] font-mono-pm uppercase tracking-wider transition-all"
                              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6' }}
                              onMouseEnter={e => { (e.currentTarget as any).style.background = 'rgba(59,130,246,0.18)'; }}
                              onMouseLeave={e => { (e.currentTarget as any).style.background = 'rgba(59,130,246,0.1)'; }}
                            >
                              Reset
                            </button>
                            <button
                              onClick={() => handleDeleteSandbox(ws.id)}
                              className="px-3 py-1.5 rounded text-[10px] font-mono-pm uppercase tracking-wider transition-all"
                              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--pm-error)' }}
                              onMouseEnter={e => { (e.currentTarget as any).style.background = 'rgba(239,68,68,0.18)'; }}
                              onMouseLeave={e => { (e.currentTarget as any).style.background = 'rgba(239,68,68,0.1)'; }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      {workspacesList.filter(w => w.status === 'sandbox').length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-xs italic text-[var(--pm-on-surface-variant)]">No sandbox environments.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Retired/Inactive Archives Section */}
              <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm">
                <h3 className="font-semibold mb-4 flex items-center gap-2 text-white">
                  <Icon name="archive" size={18} style={{ color: 'var(--pm-on-surface-variant)' }} />
                  Retired Archives &amp; Inactive Workspaces
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px] table-premium">
                    <thead>
                      <tr>
                        <th className="text-xs font-mono-pm uppercase tracking-wider">Workspace Name</th>
                        <th className="text-xs font-mono-pm uppercase tracking-wider">Status</th>
                        <th className="text-xs font-mono-pm uppercase tracking-wider">Members</th>
                        <th className="text-xs font-mono-pm uppercase tracking-wider">Active Projects</th>
                        <th className="text-xs font-mono-pm uppercase tracking-wider">Last Activity</th>
                        <th className="text-xs font-mono-pm uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {workspacesList.filter(w => w.status === 'retired' || w.status === 'inactive').map((ws: any) => (
                        <tr key={ws.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 text-sm font-medium text-white">{getWorkspaceDisplayName(ws.name, ws.status === 'sandbox')}</td>
                          <td className="py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${ws.status === 'retired' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25' : 'bg-red-500/10 text-red-400 border border-red-500/25'}`}>
                              {ws.status}
                            </span>
                          </td>
                          <td className="py-4 text-sm text-[var(--pm-on-surface-variant)]">{ws.userCount}</td>
                          <td className="py-4 text-sm text-[var(--pm-on-surface-variant)]">{ws.projectCount}</td>
                          <td className="py-4 text-sm text-[var(--pm-on-surface-variant)] font-mono-pm">{new Date(ws.lastActivityDate).toLocaleDateString()}</td>
                          <td className="py-4 text-right space-x-2">
                            <button
                              onClick={() => handleRestoreWorkspace(ws.id)}
                              className="px-3 py-1.5 rounded text-[10px] font-mono-pm uppercase tracking-wider transition-all"
                              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: 'var(--pm-primary)' }}
                              onMouseEnter={e => { (e.currentTarget as any).style.background = 'rgba(52,211,153,0.18)'; }}
                              onMouseLeave={e => { (e.currentTarget as any).style.background = 'rgba(52,211,153,0.1)'; }}
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => handleExportWorkspace(ws)}
                              className="px-3 py-1.5 rounded text-[10px] font-mono-pm uppercase tracking-wider transition-all"
                              style={{ background: 'rgba(192,193,255,0.1)', border: '1px solid rgba(192,193,255,0.2)', color: 'var(--pm-primary)' }}
                              onMouseEnter={e => { (e.currentTarget as any).style.background = 'rgba(192,193,255,0.18)'; }}
                              onMouseLeave={e => { (e.currentTarget as any).style.background = 'rgba(192,193,255,0.1)'; }}
                            >
                              Export
                            </button>
                          </td>
                        </tr>
                      ))}
                      {workspacesList.filter(w => w.status === 'retired' || w.status === 'inactive').length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-xs italic text-[var(--pm-on-surface-variant)]">No retired or inactive archives.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {/* Render Capability Edit Modal */}

      {capabilityModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-[#1c1d1f] border border-[var(--border-soft)] rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[var(--border-soft)] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white tracking-tight">Manage Capabilities</h3>
                <p className="text-xs text-[var(--text-secondary)]">{capabilityModal.userEmail}</p>
              </div>
              <button onClick={() => setCapabilityModal({ ...capabilityModal, isOpen: false })} className="text-[var(--text-secondary)] hover:text-white">
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="space-y-3">
                {['finance.manage', 'people.manage', 'project.update', 'task.update', 'workspace.update'].map(cap => (
                  <label key={cap} className="flex items-center gap-3 p-3 border border-[var(--border-soft)] rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      className="accent-indigo-500 w-4 h-4"
                      checked={capabilityModal.capabilities.includes(cap)}
                      onChange={(e) => {
                        const newCaps = e.target.checked 
                          ? [...capabilityModal.capabilities, cap] 
                          : capabilityModal.capabilities.filter(c => c !== cap);
                        setCapabilityModal({ ...capabilityModal, capabilities: newCaps });
                      }}
                    />
                    <div>
                      <div className="text-sm font-medium text-white">{cap}</div>
                      <div className="text-[10px] text-[var(--text-secondary)] font-mono">Controls {cap.replace('_', ' ')} functionality</div>
                    </div>
                  </label>
                ))}
              </div>
              
              <div className="pt-4 mt-2 border-t border-[var(--border-soft)]">
                <label className="block text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-2">
                  Reason for Change <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={capabilityModal.reason}
                  onChange={(e) => setCapabilityModal({ ...capabilityModal, reason: e.target.value })}
                  placeholder="e.g. Promoted to HR Manager"
                  className="w-full bg-black/20 border border-[var(--border-soft)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--border-soft)] flex justify-end gap-3 bg-[var(--surface-glass)]">
              <button 
                onClick={() => setCapabilityModal({ ...capabilityModal, isOpen: false })}
                className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-white transition-colors"
                disabled={capabilityModal.saving}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (!capabilityModal.reason.trim()) {
                    notify("A reason is required to change capabilities.", "error");
                    return;
                  }
                  setCapabilityModal(prev => ({ ...prev, saving: true }));
                  try {
                    const { error } = await supabase.from('users').update({ capabilities: capabilityModal.capabilities }).eq('id', capabilityModal.userId);
                    if (error) throw error;
                    // Note: Activity log reason is handled by trigger natively (well, trigger logs it, but we can't pass reason directly to trigger. So we insert explicitly to activityLog or the capability_change_logs could be updated, but for now we rely on the trigger and maybe log reason via activityService).
                    await import('../../services/activityLogService').then(m => 
                      m.activityLogService.appendLog({
                        workspace_id: activeProfiles[0]?.workspace_id || '',
                        action_type: 'capability_changed',
                        metadata: { target_user: capabilityModal.userId, capabilities: capabilityModal.capabilities, reason: capabilityModal.reason }
                      })
                    );
                    notify("Capabilities updated successfully.", "success");
                    setCapabilityModal({ ...capabilityModal, isOpen: false, saving: false });
                    invalidateAll();
                  } catch (err: any) {
                    notify(err.message || "Failed to update capabilities.", "error");
                    setCapabilityModal(prev => ({ ...prev, saving: false }));
                  }
                }}
                disabled={capabilityModal.saving || !capabilityModal.reason.trim()}
                className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {capabilityModal.saving ? 'Saving...' : 'Save Capabilities'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


