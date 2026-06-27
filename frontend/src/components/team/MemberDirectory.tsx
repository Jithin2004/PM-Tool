import { hasCapability } from '../../core/auth/permissions';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { Icon } from '../ui/Icon';
import { supabase } from '../../lib/supabase';
import { DocumentGeneratorDropdown } from '../hr/DocumentGeneratorDropdown';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { ExitHandoffEngine, HandoffAuditReport } from '../../core/system/ExitHandoffEngine';
import { hasAuthority } from '../../core/auth/permissions';

function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin:       'HR',
    manager:     'Project Manager',
    pm:          'Project Manager',
    editor:      'Employee',
    developer:   'Employee',
    viewer:      'External Access'
  };
  return labels[role] || 'Member';
}

function getInitials(name: string) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function MemberDirectory() {
  const { profile: currentUserProfile } = useAuth();
  const { profiles, invalidateAll, systemData } = useDashboard();
  const { raw: { skills = [], userSkills = [] } } = useOperationalData();
  const { workspace } = useWorkspace();
  
  const [selectedMemberDetails, setSelectedMemberDetails] = useState<any | null>(null);
  const [dojEditState, setDojEditState] = useState<{ active: boolean; newDoj: string; reason: string }>({ active: false, newDoj: '', reason: '' });
  const [handoffState, setHandoffState] = useState<{
    active: boolean;
    targetStatus: 'resigned' | 'terminated' | null;
    report: HandoffAuditReport | null;
    loading: boolean;
    transferToUserId: string;
    transferring: boolean;
    transferredCount: number;
    transferError: string | null;
    handoffNotes: string;
  }>({
    active: false,
    targetStatus: null,
    report: null,
    loading: false,
    transferToUserId: '',
    transferring: false,
    transferredCount: 0,
    transferError: null,
    handoffNotes: '',
  });

  useEscapeKey(!!selectedMemberDetails && !dojEditState.active && !handoffState.active, () => setSelectedMemberDetails(null));
  useEscapeKey(dojEditState.active, () => setDojEditState({ active: false, newDoj: '', reason: '' }));
  useEscapeKey(handoffState.active, () => setHandoffState(prev => ({ ...prev, active: false })));

  const userCustomRoles = systemData.userCustomRoles || {};
  const activeProfiles = profiles.filter(p => p.status === 'active' && p.role !== 'uninvited');

  return (
    <div className="space-y-6">
      <div className="rounded-xl shadow-2xl overflow-x-auto bg-surface-3/10 border border-border/50 backdrop-blur-md">
        <table className="w-full text-left border-collapse min-w-[600px] table-premium">
          <thead>
            <tr>
              <th className="text-[11px] font-mono uppercase tracking-widest">Member Directory</th>
              <th className="text-[11px] font-mono uppercase tracking-widest">Department</th>
              <th className="text-[11px] font-mono uppercase tracking-widest text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'rgba(70,69,84,0.1)' }}>
            {activeProfiles.map((p: any) => {
              const initials = getInitials(p.full_name || p.email || '');
              return (
                <tr key={p.id} className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer" onClick={() => setSelectedMemberDetails(p)}>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                        {initials}
                      </div>
                      <div>
                        <div className="font-medium hover:underline" style={{ color: 'var(--pm-on-surface)' }}>
                          {p.full_name || 'Unknown'}
                        </div>
                        <div className="font-mono text-[11px] mt-0.5 uppercase opacity-60 text-text-secondary">
                          {p.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-surface-3 text-text-secondary border border-border">
                      {userCustomRoles[p.id] || 'General'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="text-[11px] font-mono uppercase tracking-widest text-indigo-400 hover:text-indigo-300">
                      View Profile
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedMemberDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-premium">
          <div onClick={() => setSelectedMemberDetails(null)} className="absolute inset-0 z-0 cursor-pointer" />
          <div className="relative modal-premium w-full max-w-xl rounded-2xl shadow-2xl p-6 z-10 animate-in fade-in zoom-in-95 duration-200 text-white max-h-[90vh] overflow-y-auto scrollbar-premium">
            <button 
              onClick={() => setSelectedMemberDetails(null)}
              aria-label="Close modal"
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
              style={{ color: 'var(--pm-on-surface-variant)' }}
            >
              <Icon name="close" size={20} />
            </button>
            <h3 className="text-xl font-semibold mb-6">Member Details</h3>

            <div className="space-y-6">
              {/* Profile Information */}
              <div className="border border-[var(--border-soft)] rounded-lg p-4 bg-[var(--surface-glass)]">
                <h4 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4">Profile Information</h4>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
                    {getInitials(selectedMemberDetails.full_name || selectedMemberDetails.email || '')}
                  </div>
                  <div>
                    <div className="font-semibold text-lg">{selectedMemberDetails.full_name || 'Unknown User'}</div>
                    <div className="text-sm text-[var(--text-secondary)] font-mono mt-1">{selectedMemberDetails.email}</div>
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              <div className="border border-[var(--border-soft)] rounded-lg p-4 bg-[var(--surface-glass)]">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)]">Employment Details</h4>
                  
                  <div className="flex gap-2">
                    {workspace?.id && (
                      <>
                        <DocumentGeneratorDropdown
                          workspaceId={workspace.id}
                          type="offer_letter"
                          companyName="Resolve PM"
                          buttonText="Offer Letter"
                          fileName={`Offer_Letter_${(selectedMemberDetails.full_name || 'User').replace(/\s+/g, '_')}`}
                          data={{
                            employee_name: selectedMemberDetails.full_name || 'User',
                            role: getRoleLabel(selectedMemberDetails.role),
                            salary: 'TBD',
                            joining_date: selectedMemberDetails.date_of_joining ? new Date(selectedMemberDetails.date_of_joining).toLocaleDateString() : 'TBD'
                          }}
                        />
                        <DocumentGeneratorDropdown
                          workspaceId={workspace.id}
                          type="experience_letter"
                          companyName="Resolve PM"
                          buttonText="Experience Letter"
                          fileName={`Experience_Letter_${(selectedMemberDetails.full_name || 'User').replace(/\s+/g, '_')}`}
                          data={{
                            employee_name: selectedMemberDetails.full_name || 'User',
                            role: getRoleLabel(selectedMemberDetails.role),
                            start_date: selectedMemberDetails.date_of_joining ? new Date(selectedMemberDetails.date_of_joining).toLocaleDateString() : 'TBD',
                            end_date: new Date().toLocaleDateString()
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] uppercase text-[var(--text-secondary)] font-mono mb-1">Role</div>
                    <div className="font-medium">{getRoleLabel(selectedMemberDetails.role)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-[var(--text-secondary)] font-mono mb-1">Department</div>
                    <div className="font-medium">{userCustomRoles[selectedMemberDetails.id] || 'General'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-[var(--text-secondary)] font-mono mb-1">Employment Status</div>
                    {hasCapability(currentUserProfile?.role, 'user.manage') && selectedMemberDetails.id !== currentUserProfile.id ? (
                      <select
                        value={selectedMemberDetails.employment_status || 'active'}
                        onChange={async (e) => {
                          const val = e.target.value as any;
                          if (val === 'resigned' || val === 'terminated') {
                            setHandoffState({
                              active: true,
                              targetStatus: val,
                              report: null,
                              loading: true,
                              transferToUserId: '',
                              transferring: false,
                              transferredCount: 0,
                              transferError: null,
                              handoffNotes: '',
                            });
                            const report = await ExitHandoffEngine.generateHandoffReport(workspace!.id, selectedMemberDetails.id);
                            setHandoffState(prev => ({ ...prev, report, loading: false }));
                          } else {
                            const { error } = await supabase.from('employment_records')
                              .update({ employment_status: val })
                              .eq('user_id', selectedMemberDetails.id);
                            if (!error) {
                              setSelectedMemberDetails({ ...selectedMemberDetails, employment_status: val });
                              invalidateAll();
                            }
                          }
                        }}
                        className="bg-black/40 border border-[var(--border-soft)] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500 capitalize"
                      >
                        <option value="active" className="bg-[#1f2937]">Active</option>
                        <option value="resigned" className="bg-[#1f2937]">Resigned</option>
                        <option value="terminated" className="bg-[#1f2937]">Terminated</option>
                        <option value="suspended" className="bg-[#1f2937]">Suspended</option>
                        <option value="on_leave" className="bg-[#1f2937]">On Leave</option>
                      </select>
                    ) : (
                      <div className="font-medium capitalize">{selectedMemberDetails.employment_status || 'Active'}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-[var(--text-secondary)] font-mono mb-1">Date of Joining</div>
                    {hasCapability(currentUserProfile?.role, 'user.manage') ? (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="font-medium text-white">
                          {selectedMemberDetails.date_of_joining ? new Date(selectedMemberDetails.date_of_joining).toLocaleDateString() : 'N/A'}
                        </div>
                        <button 
                          onClick={() => setDojEditState({ active: true, newDoj: selectedMemberDetails.date_of_joining ? selectedMemberDetails.date_of_joining.split('T')[0] : '', reason: '' })}
                          className="p-1 rounded bg-[var(--surface-glass)] hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-secondary)] hover:text-white"
                          title="Edit Date of Joining"
                        >
                          <Icon name="pencil" size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="font-medium mt-1">
                        {selectedMemberDetails.date_of_joining ? new Date(selectedMemberDetails.date_of_joining).toLocaleDateString() : 'N/A'}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Employee Lifecycle Analytics */}
                {selectedMemberDetails.date_of_joining && (
                  <div className="mt-4 p-3 bg-black/20 border border-[var(--border-soft)] rounded-lg flex items-center justify-between text-sm">
                    {selectedMemberDetails.employee_type === 'Full Time' && (
                      <>
                        <span className="text-[var(--text-secondary)]">Company Tenure</span>
                        <span className="font-medium text-white">
                          {Math.floor((new Date().getTime() - new Date(selectedMemberDetails.date_of_joining).getTime()) / (1000 * 3600 * 24 * 365))} years, 
                          {Math.floor(((new Date().getTime() - new Date(selectedMemberDetails.date_of_joining).getTime()) / (1000 * 3600 * 24)) % 365 / 30)} months
                        </span>
                      </>
                    )}
                    {(selectedMemberDetails.employee_type === 'Intern' || selectedMemberDetails.employee_type === 'Contract') && (
                      <>
                        <span className="text-[var(--text-secondary)]">{selectedMemberDetails.employee_type === 'Intern' ? 'Internship Duration' : 'Contract Remaining'}</span>
                        <span className="font-medium text-white">
                          {selectedMemberDetails.contract_end ? (
                            Math.max(0, Math.floor((new Date(selectedMemberDetails.contract_end).getTime() - new Date().getTime()) / (1000 * 3600 * 24))) + ' days remaining'
                          ) : 'End date not set'}
                        </span>
                      </>
                    )}
                  </div>
                )}
                
                <div className="mt-4 pt-4 border-t border-[var(--pm-border)]">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--pm-text-secondary)] mb-3">Professional Skills</h4>
                  <div className="space-y-2">
                    {(() => {
                      const memberSkills = userSkills.filter(us => us.user_id === selectedMemberDetails.id);
                      if (memberSkills.length === 0) {
                        return <div className="text-xs text-[var(--pm-text-tertiary)] italic">No skills recorded yet.</div>;
                      }
                      return memberSkills.map(us => {
                        const skillDef = skills.find(s => s.id === us.skill_id);
                        return (
                          <div key={us.id} className="flex justify-between items-center text-xs">
                            <span className="font-medium text-[var(--pm-text)]">{skillDef?.name || 'Unknown Skill'}</span>
                            <span className="text-[10px] uppercase tracking-wider text-[var(--pm-text-tertiary)] bg-[var(--pm-surface-highest)] px-2 py-0.5 rounded-full border border-[var(--pm-border)]">{us.level}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {dojEditState.active && selectedMemberDetails && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 modal-overlay-premium">
          <div className="relative modal-premium w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col text-white">
            <div className="px-6 py-4 border-b border-[var(--border-soft)] flex items-center justify-between">
              <h3 className="font-semibold text-white tracking-tight">Update Date of Joining</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-2">New DOJ</label>
                <input
                  type="date"
                  value={dojEditState.newDoj}
                  onChange={(e) => setDojEditState({ ...dojEditState, newDoj: e.target.value })}
                  className="w-full input-premium px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-2">Reason for change</label>
                <textarea
                  value={dojEditState.reason}
                  onChange={(e) => setDojEditState({ ...dojEditState, reason: e.target.value })}
                  placeholder="Required for HR Audit"
                  className="w-full input-premium px-3 py-2 text-sm outline-none min-h-[80px]"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--border-soft)] flex justify-end gap-3 bg-black/10">
              <button
                onClick={() => setDojEditState({ active: false, newDoj: '', reason: '' })}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary btn-premium-secondary rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={!dojEditState.reason.trim() || !dojEditState.newDoj}
                onClick={async () => {
                  const { newDoj, reason } = dojEditState;
                  const { error } = await supabase.from('employment_records')
                    .update({ date_of_joining: new Date(newDoj).toISOString() })
                    .eq('user_id', selectedMemberDetails.id);
                    
                  if (!error) {
                    await supabase.from('employment_change_logs').insert({
                      employee_id: selectedMemberDetails.id,
                      field_changed: 'date_of_joining',
                      previous_value: selectedMemberDetails.date_of_joining || '',
                      new_value: new Date(newDoj).toISOString(),
                      changed_by: currentUserProfile?.id,
                      reason: reason.trim()
                    });
                    setSelectedMemberDetails({ ...selectedMemberDetails, date_of_joining: new Date(newDoj).toISOString() });
                    invalidateAll();
                    setDojEditState({ active: false, newDoj: '', reason: '' });
                  }
                }}
                className="px-4 py-2 text-sm font-semibold btn-premium-primary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-white"
              >
                Save Change
              </button>
            </div>
          </div>
        </div>
      )}

      {handoffState.active && selectedMemberDetails && (
        <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 modal-overlay-premium">
          <div className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" onClick={() => setHandoffState(prev => ({ ...prev, active: false }))} />
          <div className="relative modal-premium w-full max-w-2xl rounded-2xl shadow-2xl p-6 z-10 animate-in fade-in zoom-in-95 duration-200 text-white max-h-[85vh] overflow-y-auto scrollbar-premium flex flex-col bg-[#1f2937] border border-[var(--border-soft)]">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-soft)] mb-4">
              <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <Icon name="exit_to_app" size={20} className="text-red-400" />
                Exit Handoff & Ownership Transfer
              </h3>
              <button 
                onClick={() => setHandoffState(prev => ({ ...prev, active: false }))}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="text-sm text-[var(--text-secondary)] mb-6">
              You are transitioning <span className="font-semibold text-white">{selectedMemberDetails.full_name || selectedMemberDetails.email}</span> to <span className="font-semibold text-red-400 uppercase">{handoffState.targetStatus}</span> status. To ensure no work is lost, audit and transfer responsibilities below.
            </div>

            {handoffState.loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
                <span className="text-xs font-mono text-[var(--text-secondary)]">Auditing employee ownership...</span>
              </div>
            ) : (
              <div className="space-y-6 flex-1">
                {/* Ownership Report */}
                <div className="border border-[var(--border-soft)] rounded-xl p-4 bg-black/20 space-y-4">
                  <h4 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border-soft)] pb-2">Ownership Report</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-3 rounded-lg border border-[var(--border-soft)]">
                      <div className="text-[10px] uppercase font-mono text-[var(--text-secondary)]">Active Tasks</div>
                      <div className="text-xl font-bold text-white mt-1">{handoffState.report?.activeTasks.length || 0}</div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg border border-[var(--border-soft)]">
                      <div className="text-[10px] uppercase font-mono text-[var(--text-secondary)]">Owned Projects</div>
                      <div className="text-xl font-bold text-white mt-1">{handoffState.report?.ownedProjects.length || 0}</div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg border border-[var(--border-soft)]">
                      <div className="text-[10px] uppercase font-mono text-[var(--text-secondary)]">Pending Approvals</div>
                      <div className="text-xl font-bold text-white mt-1">{handoffState.report?.pendingApprovals.length || 0}</div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg border border-[var(--border-soft)]">
                      <div className="text-[10px] uppercase font-mono text-[var(--text-secondary)] font-medium">Unanswered Mentions</div>
                      <div className="text-xl font-bold text-white mt-1">{handoffState.report?.unansweredMentions.length || 0}</div>
                    </div>
                  </div>

                  {/* List of active tasks and owned projects */}
                  {((handoffState.report?.activeTasks.length || 0) > 0 || (handoffState.report?.ownedProjects.length || 0) > 0) && (
                    <div className="text-xs space-y-2 pt-2 text-[var(--text-secondary)]">
                      {handoffState.report?.ownedProjects.length ? (
                        <div>
                          <span className="font-semibold text-white">Owned Projects:</span> {handoffState.report.ownedProjects.map((p: any) => p.name).join(', ')}
                        </div>
                      ) : null}
                      {handoffState.report?.activeTasks.length ? (
                        <div>
                          <span className="font-semibold text-white">Pending Tasks:</span> {handoffState.report.activeTasks.map((t: any) => t.name).join(', ')}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Transfer Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)]">Reassign Ownership</h4>
                  
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-2">Select Teammate to receive tasks, projects, and approvals:</label>
                    <select
                      value={handoffState.transferToUserId}
                      onChange={(e) => setHandoffState(prev => ({ ...prev, transferToUserId: e.target.value }))}
                      className="w-full bg-black/40 border border-[var(--border-soft)] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="" className="bg-[#1f2937]">-- Choose Teammate --</option>
                      {activeProfiles
                        .filter(p => p.id !== selectedMemberDetails.id)
                        .map(p => (
                          <option key={p.id} value={p.id} className="bg-[#1f2937]">
                            {p.full_name || p.email} ({p.role})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-2">Handoff Notes & Instructions:</label>
                    <textarea 
                      value={handoffState.handoffNotes}
                      onChange={(e) => setHandoffState(prev => ({ ...prev, handoffNotes: e.target.value }))}
                      placeholder="Add context, pending passwords, client relationships, or other key info for the successor..."
                      className="w-full bg-black/30 border border-[var(--border-soft)] rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500/50 text-white min-h-[100px] transition-colors"
                    />
                  </div>
                </div>

                {handoffState.transferError && (
                  <div className="text-xs text-red-400 bg-red-400/10 border border-red-500/20 p-3 rounded-lg">
                    {handoffState.transferError}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-soft)]">
                  <button
                    onClick={() => setHandoffState(prev => ({ ...prev, active: false }))}
                    className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-white rounded-lg transition-colors border border-[var(--border-soft)]"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!handoffState.transferToUserId || handoffState.transferring}
                    onClick={async () => {
                      setHandoffState(prev => ({ ...prev, transferring: true, transferError: null }));
                      
                      const report = handoffState.report;
                      if (!report) return;

                      const taskIds = report.activeTasks.map(t => t.id);
                      const projectIds = report.ownedProjects.map(p => p.id);
                      const approvalIds = report.pendingApprovals.map(a => a.id);
                      const fileIds = report.ownedFiles.map(f => f.id);

                      // 1. Transfer items
                      const transferRes = await ExitHandoffEngine.transferOwnership(
                        workspace!.id,
                        selectedMemberDetails.id,
                        handoffState.transferToUserId,
                        { taskIds, projectIds, approvalIds, fileIds }
                      );

                      if (!transferRes.success) {
                        setHandoffState(prev => ({ ...prev, transferring: false, transferError: transferRes.error || 'Failed to transfer ownership' }));
                        return;
                      }

                      // 2. Update status
                      const statusRes = await ExitHandoffEngine.updateEmploymentStatus(
                        workspace!.id,
                        selectedMemberDetails.id,
                        handoffState.targetStatus!,
                        currentUserProfile!.id
                      );

                      if (statusRes) {
                        // 3. Log into employee_handoffs
                        await supabase.from('employee_handoffs').insert({
                          workspace_id: workspace!.id,
                          departing_user_id: selectedMemberDetails.id,
                          manager_id: currentUserProfile!.id,
                          target_user_id: handoffState.transferToUserId,
                          notes: handoffState.handoffNotes,
                          metadata: {
                            transferred_tasks: taskIds.length,
                            transferred_projects: projectIds.length,
                            transferred_approvals: approvalIds.length,
                            transferred_files: fileIds.length
                          }
                        });

                        setSelectedMemberDetails({
                          ...selectedMemberDetails,
                          employment_status: handoffState.targetStatus!
                        });
                        invalidateAll();
                        setHandoffState(prev => ({ ...prev, active: false, transferring: false }));
                      } else {
                        setHandoffState(prev => ({ ...prev, transferring: false, transferError: 'Ownership transferred, but failed to update status.' }));
                      }
                    }}
                    className="px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    {handoffState.transferring && <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                    Transfer & Save Status
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

