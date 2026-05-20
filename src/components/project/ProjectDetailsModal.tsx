import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Clock, Terminal, Lock, X, AlertTriangle, Users, Layers, LayoutGrid, CheckCircle2, Plus, Activity, BrainCircuit, Trash2, History, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { sha256 } from '../../utils/cryptoUtils';
import { Project, Team, User, Profile } from '../../types';
import { useDashboard } from '../../context/DashboardContext';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { calculateExpectedTime, calculateVariance } from '../../utils/timeUtils';

export function ProjectDetailsModal({
  project,
  teams,
  onClose,
  onUpdate,
  onDelete,
  workingHoursPerDay,
  currentUserProfile,
  userCustomRoles
}: {
  project: Project,
  teams: Team[],
  onClose: () => void,
  onUpdate: any,
  onDelete: (id: string, reason: string) => void,
  workingHoursPerDay: number,
  currentUserProfile: Profile | null,
  userCustomRoles: Record<string, string>
}) {
  const { tasks } = useDashboard();
  const hasTasks = tasks.some(t => t.project_id === project.id);

  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState(project.status);
  const [priority, setPriority] = useState(project.priority);
  const [teamId, setTeamId] = useState(project.team_id || '');
  const [pBest, setPBest] = useState(project.pert_best.toString());
  const [pLikely, setPLikely] = useState(project.pert_likely.toString());
  const [pWorst, setPWorst] = useState(project.pert_worst.toString());
  const [proposedStartDate, setProposedStartDate] = useState(project.proposed_start_date?.substring(0, 10) || '');
  const [clientDeadline, setClientDeadline] = useState(project.client_deadline?.substring(0, 10) || '');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const hasAllData = pBest !== '' && pLikely !== '' && pWorst !== '' && proposedStartDate !== '' && clientDeadline !== '';

  const team = teams.find(t => t.id === teamId);
  const parsedTeamData = team ? team.data : null;
  const engineerCount = Math.max(1, parsedTeamData?.developer_ids?.length || 1);

  const expectedRealHours = calculateExpectedTime(Number(pBest), Number(pLikely), Number(pWorst));
  const productiveHoursPerDay = workingHoursPerDay * 0.8;
  const calendarExpected = (expectedRealHours / productiveHoursPerDay / engineerCount).toFixed(2);
  const variance = calculateVariance(Number(pBest), Number(pWorst));
  const stdDev = Math.sqrt(variance);

  const [changeReasonPrompt, setChangeReasonPrompt] = useState<{ changes: any, open: boolean }>({ changes: null, open: false });
  const [changeReason, setChangeReason] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [dbLogs, setDbLogs] = useState<any[]>([]);

  const [verificationState, setVerificationState] = useState<'UNVERIFIED' | 'VERIFYING' | 'SECURED' | 'TAMPERED'>('UNVERIFIED');
  const [scanningIndex, setScanningIndex] = useState<number | null>(null);
  const [tamperedIndex, setTamperedIndex] = useState<number | null>(null);
  const [localLogs, setLocalLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchDbLogs = async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('change_logs')
            .select('*')
            .eq('project_id', project.id)
            .order('timestamp', { ascending: true });
          if (!error && data && data.length > 0) {
            const mapped = data.map(d => ({
              timestamp: d.timestamp,
              changes: d.changes,
              reason: d.reason,
              authorName: d.author_name,
              authorRole: d.author_role,
              previousHash: d.previous_hash || 'GENESIS_BLOCK',
              hash: d.hash || ''
            }));
            setDbLogs(mapped);
            setLocalLogs(mapped);
          } else {
            // Offline fallback
            const fallback = (project.tags || [])
              .filter(t => t.startsWith('LOG:'))
              .map(t => {
                const parsed = JSON.parse(t.substring(4));
                return {
                  ...parsed,
                  previousHash: parsed.previousHash || 'GENESIS_BLOCK',
                  hash: parsed.hash || ''
                };
              });
            setLocalLogs(fallback);
          }
        } catch (err) {
          console.error("Error fetching change logs from table:", err);
        }
      } else {
        const fallback = (project.tags || [])
          .filter(t => t.startsWith('LOG:'))
          .map(t => {
            const parsed = JSON.parse(t.substring(4));
            return {
              ...parsed,
              previousHash: parsed.previousHash || 'GENESIS_BLOCK',
              hash: parsed.hash || ''
            };
          });
        setLocalLogs(fallback);
      }
      setVerificationState('UNVERIFIED');
      setScanningIndex(null);
      setTamperedIndex(null);
    };
    fetchDbLogs();
  }, [project.id, project.tags]);

  const verifyLedger = async () => {
    if (localLogs.length === 0) return;
    setVerificationState('VERIFYING');
    setTamperedIndex(null);

    let currentPrevHash = 'GENESIS_BLOCK';

    for (let i = 0; i < localLogs.length; i++) {
      setScanningIndex(i);
      // artificial delay for scanning progress visualization
      await new Promise(resolve => setTimeout(resolve, 300));

      const log = localLogs[i];

      // 1. Verify previous hash matches current chain predecessor
      if (log.previousHash !== currentPrevHash) {
        setVerificationState('TAMPERED');
        setTamperedIndex(i);
        return;
      }

      // 2. Re-compute block hash
      const message = `${project.id}${log.timestamp}${log.changes}${log.reason}${log.authorName}${log.authorRole}${log.previousHash}`;
      const computedHash = await sha256(message);

      if (log.hash !== computedHash) {
        setVerificationState('TAMPERED');
        setTamperedIndex(i);
        return;
      }

      currentPrevHash = log.hash;
    }

    setVerificationState('SECURED');
    setScanningIndex(null);
  };

  const simulateTampering = () => {
    if (localLogs.length === 0) return;
    const updated = [...localLogs];
    const targetIdx = Math.floor(Math.random() * updated.length);
    updated[targetIdx] = {
      ...updated[targetIdx],
      changes: updated[targetIdx].changes + ' [TAMPERED_METADATA_VALUE]'
    };
    setLocalLogs(updated);
    setVerificationState('UNVERIFIED');
    setTamperedIndex(null);
    setScanningIndex(null);
  };

  const logs = useMemo(() => {
    return localLogs;
  }, [localLogs]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const changes: string[] = [];
    if (status !== project.status) changes.push(`Status (${project.status} -> ${status})`);
    if (priority !== project.priority) changes.push(`Priority (${project.priority} -> ${priority})`);
    if ((teamId || null) !== (project.team_id || null)) {
      const oldTeam = teams.find(t => t.id === project.team_id)?.name || 'UNALLOCATED';
      const newTeam = teams.find(t => t.id === teamId)?.name || 'UNALLOCATED';
      changes.push(`Team (${oldTeam} -> ${newTeam})`);
    }
    const oldDeadline = project.client_deadline?.substring(0, 10) || 'None';
    const newDeadline = clientDeadline || 'None';
    if (oldDeadline !== newDeadline) changes.push(`Client Deadline (${oldDeadline} -> ${newDeadline})`);

    const oldStart = project.proposed_start_date?.substring(0, 10) || 'None';
    const newStart = proposedStartDate || 'None';
    if (oldStart !== newStart) changes.push(`Proposed Start (${oldStart} -> ${newStart})`);

    const updates = {
      name,
      status: status as any,
      priority: priority as any,
      team_id: teamId || null,
      pert_best: Number(pBest),
      pert_likely: Number(pLikely),
      pert_worst: Number(pWorst),
      proposed_start_date: proposedStartDate || null,
      client_deadline: clientDeadline || null
    };

    if (changes.length > 0) {
      setChangeReasonPrompt({ changes: { ...updates, _log_summary: changes.join(', ') }, open: true });
    } else {
      onUpdate(project.id, updates);
      onClose();
    }
  };

  const handleConfirmChange = () => {
    if (!changeReason) return;

    const finalUpdates = { ...changeReasonPrompt.changes };
    delete finalUpdates._log_summary;

    // Strip LOG: tags from finalUpdates tags to prevent saving duplicate logging strings
    if (finalUpdates.tags) {
      finalUpdates.tags = finalUpdates.tags.filter((t: string) => !t.startsWith('LOG:'));
    }

    onUpdate(project.id, finalUpdates, {
      changes: changeReasonPrompt.changes._log_summary,
      reason: changeReason,
      authorName: currentUserProfile?.full_name || currentUserProfile?.email || 'Unknown User',
      authorRole: (currentUserProfile?.id && userCustomRoles[currentUserProfile.id]) || currentUserProfile?.role || 'viewer'
    });

    setChangeReasonPrompt({ changes: null, open: false });
    onClose();
  };

  const startDate = proposedStartDate ? new Date(proposedStartDate) : new Date(project.created_at);
  const now = new Date();
  const daysPassed = Math.max(0, (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.max(0, Number(calendarExpected) - daysPassed);
  const completionDate = new Date(startDate.getTime() + Number(calendarExpected) * 24 * 60 * 60 * 1000);

  const deadline = clientDeadline ? new Date(clientDeadline) : null;
  const deadlineVariance = deadline ? Math.floor((deadline.getTime() - completionDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-[#0c0c0c] border border-white/10 w-full max-w-2xl overflow-y-auto max-h-[90vh] md:max-h-none shadow-2xl rounded-sm my-auto">

        {showLogs && (
          <div className="absolute inset-0 z-50 bg-[#0c0c0c] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#0a0a0a]">
              <h4 className="text-sm font-mono text-white/90 uppercase tracking-widest flex items-center gap-2">
                <History className="w-4 h-4 text-blue-400" /> Project Ledger Center
              </h4>
              <button
                type="button"
                onClick={() => setShowLogs(false)}
                className="p-2 border border-white/10 hover:bg-white/5 transition-colors"
              >
                <Plus className="w-4 h-4 rotate-45 text-white/75" />
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              
              {/* Ledger Integrity Guard Panel */}
              <div className="border border-white/10 bg-white/[0.02] backdrop-blur-md p-6 rounded-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {verificationState === 'UNVERIFIED' && (
                      <div className="p-3 bg-white/5 border border-white/10 text-white/60">
                        <Shield className="w-6 h-6" />
                      </div>
                    )}
                    {verificationState === 'VERIFYING' && (
                      <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 animate-pulse">
                        <RefreshCw className="w-6 h-6 animate-spin" />
                      </div>
                    )}
                    {verificationState === 'SECURED' && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                    )}
                    {verificationState === 'TAMPERED' && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 animate-bounce">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <h5 className="text-xs font-mono uppercase tracking-[0.2em] font-bold">
                        {verificationState === 'UNVERIFIED' && "Ledger Verification Pending"}
                        {verificationState === 'VERIFYING' && "Analyzing Ledger Integrity"}
                        {verificationState === 'SECURED' && "Ledger Verified & Secured"}
                        {verificationState === 'TAMPERED' && "WARNING: TAMPERING DETECTED!"}
                      </h5>
                      <p className="text-[10px] font-mono text-white/50 mt-1 leading-relaxed">
                        {verificationState === 'UNVERIFIED' && "Cryptographic blockchain verification ready. Confirm WORM ledger sequence status."}
                        {verificationState === 'VERIFYING' && `Scanning block #${(scanningIndex ?? 0) + 1} of ${localLogs.length}... verifying signature matching.`}
                        {verificationState === 'SECURED' && `All ${localLogs.length} historical blocks matched SHA-256 genesis hashes perfectly.`}
                        {verificationState === 'TAMPERED' && `Chain validation broken at Block #${(tamperedIndex ?? 0) + 1}. Predecessor pointer mismatch detected.`}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {localLogs.length > 0 && (
                      <button
                        type="button"
                        onClick={verifyLedger}
                        disabled={verificationState === 'VERIFYING'}
                        className={`px-4 py-2 text-[10px] uppercase font-mono tracking-widest font-bold border transition-all ${
                          verificationState === 'SECURED'
                            ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/20'
                            : verificationState === 'TAMPERED'
                            ? 'bg-red-500/10 border-red-500/35 text-red-400 hover:bg-red-500/20'
                            : 'bg-white text-black border-white hover:bg-neutral-200'
                        }`}
                      >
                        {verificationState === 'VERIFYING' ? "Scanning..." : verificationState === 'SECURED' ? "Re-Verify" : "Verify Ledger"}
                      </button>
                    )}
                    {localLogs.length > 0 && (
                      <button
                        type="button"
                        onClick={simulateTampering}
                        disabled={verificationState === 'VERIFYING'}
                        className="px-4 py-2 text-[10px] uppercase font-mono tracking-widest border border-red-500/20 text-red-400/90 hover:bg-red-500/10 transition-all"
                        title="Mutate local block state to trigger warning UI"
                      >
                        Simulate Tamper
                      </button>
                    )}
                  </div>
                </div>

                {/* Verification Progress Bar */}
                {verificationState === 'VERIFYING' && (
                  <div className="w-full bg-white/5 h-1 relative overflow-hidden rounded-full">
                    <div
                      className="bg-yellow-500 h-full transition-all duration-300"
                      style={{ width: `${((scanningIndex ?? 0) / localLogs.length) * 100}%` }}
                    />
                  </div>
                )}
                {verificationState === 'SECURED' && (
                  <div className="w-full bg-emerald-500/20 h-1 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-full" />
                  </div>
                )}
                {verificationState === 'TAMPERED' && (
                  <div className="w-full bg-red-500/20 h-1 rounded-full overflow-hidden">
                    <div className="bg-red-500 h-full w-full animate-pulse" />
                  </div>
                )}
              </div>

              {/* Logs List */}
              <div className="space-y-4">
                {localLogs.length === 0 ? (
                  <p className="text-xs font-mono text-white/50 italic">No historical adjustments recorded.</p>
                ) : (
                  [...localLogs].reverse().map((log, reversedIndex) => {
                    const originalIndex = localLogs.length - 1 - reversedIndex;
                    const isScanning = verificationState === 'VERIFYING' && scanningIndex === originalIndex;
                    const isTamperedBlock = verificationState === 'TAMPERED' && tamperedIndex === originalIndex;
                    const isSecuredBlock = verificationState === 'SECURED';

                    return (
                      <div
                        key={originalIndex}
                        className={`border p-5 flex flex-col gap-3 transition-all relative ${
                          isScanning
                            ? 'border-yellow-500 bg-yellow-500/[0.02] shadow-[0_0_10px_rgba(234,179,8,0.05)]'
                            : isTamperedBlock
                            ? 'border-red-500 bg-red-500/[0.04] shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                            : isSecuredBlock
                            ? 'border-emerald-500/20 bg-emerald-500/[0.01]'
                            : 'border-white/10 bg-white/5'
                        }`}
                      >
                        {/* Upper Details Row */}
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-[10px] font-mono">
                          <div className="flex items-center gap-2">
                            <span className="text-white/30 uppercase tracking-widest font-bold">Block #{originalIndex + 1}</span>
                            <span className="text-white/50">{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                          
                          {/* Block Status Badge */}
                          <div className="flex items-center gap-2">
                            {isScanning && (
                              <span className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 px-2 py-0.5 rounded-sm uppercase tracking-wider text-[8px] animate-pulse">
                                Scanning...
                              </span>
                            )}
                            {isTamperedBlock && (
                              <span className="bg-red-500/20 border border-red-500/40 text-red-400 px-2 py-0.5 rounded-sm uppercase tracking-wider text-[8px] font-bold animate-pulse">
                                TAMPER DETECTED
                              </span>
                            )}
                            {isSecuredBlock && !isTamperedBlock && (
                              <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-sm uppercase tracking-wider text-[8px]">
                                Secured Block
                              </span>
                            )}
                            {log.authorName && (
                              <span className="text-blue-400 font-bold uppercase tracking-wider">
                                BY: {log.authorName} ({log.authorRole || 'Viewer'})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Audit Details */}
                        <div className="space-y-1.5 py-1 border-y border-white/[0.03]">
                          <p className="text-xs font-mono text-white/90 leading-relaxed">
                            <span className="text-white/40 uppercase tracking-widest text-[9px] mr-2">Changes:</span> 
                            {log.changes}
                          </p>
                          <p className="text-xs font-mono text-yellow-500/90 leading-relaxed">
                            <span className="text-white/40 uppercase tracking-widest text-[9px] mr-2">Reason:</span> 
                            {log.reason}
                          </p>
                        </div>

                        {/* Hash badging */}
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[9px] font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white/30 uppercase tracking-tighter">HASH:</span>
                            <span className={`px-2 py-0.5 border rounded-sm font-mono tracking-tight transition-colors ${
                              isTamperedBlock
                                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                : 'bg-black/40 border-white/10 text-white/70'
                            }`} title={log.hash}>
                              {log.hash ? `0x${log.hash.substring(0, 8)}...` : 'None'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <span className="text-white/30 uppercase tracking-tighter">PREV HASH:</span>
                            {log.previousHash === 'GENESIS_BLOCK' ? (
                              <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-sm uppercase text-[8px] tracking-widest font-bold">
                                GENESIS
                              </span>
                            ) : (
                              <span className="bg-black/40 border border-white/10 text-white/50 px-2 py-0.5 rounded-sm font-mono tracking-tight" title={log.previousHash}>
                                {log.previousHash ? `0x${log.previousHash.substring(0, 8)}...` : 'None'}
                              </span>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>
        )}

        {changeReasonPrompt.open && (
          <div className="absolute inset-0 z-50 bg-[#0c0c0c]/95 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="w-full max-w-md bg-black border border-white/20 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-yellow-500" />
                <h4 className="text-sm font-mono text-white/90 uppercase tracking-widest">Reason for Adjustment</h4>
              </div>
              <p className="text-[10px] font-mono text-white/60">The following adjustments require documentation for compliance:</p>
              <ul className="text-[10px] font-mono text-white/80 list-disc pl-4 space-y-1">
                {changeReasonPrompt.changes._log_summary.split(', ').map((c: string) => <li key={c}>{c}</li>)}
              </ul>
              <textarea
                autoFocus
                required
                value={changeReason}
                onChange={e => setChangeReason(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/20 p-3 text-xs font-mono min-h-[100px] focus:border-white/50 outline-none"
                placeholder="Enter reason for modifying these parameters..."
              />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={handleConfirmChange} disabled={!changeReason} className="flex-1 bg-white text-black text-[10px] uppercase font-mono py-2 disabled:opacity-50 tracking-widest font-semibold">Log & Commit</button>
                <button type="button" onClick={() => setChangeReasonPrompt({ changes: null, open: false })} className="flex-1 border border-white/20 text-white/70 text-[10px] uppercase font-mono py-2 hover:bg-white/5 tracking-widest">Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BrainCircuit className="w-4 h-4 text-white/85" />
                <span className="text-[10px] font-mono text-white/80 uppercase tracking-[0.2em]">Project Overview</span>
              </div>
              <h3 className="text-2xl font-medium tracking-tight">Predictive Workspace: {project.name}</h3>
            </div>
            <button onClick={onClose} className="p-2 border border-white/10 hover:bg-white/5 transition-colors">
              <Plus className="w-5 h-5 rotate-45 text-white/75" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Project Designation</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-black border border-white/10 h-11 px-4 font-mono text-sm focus:border-white/40 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full bg-black border border-white/10 h-11 px-3 font-mono text-xs focus:border-white/40 outline-none">
                    <option value="planning">PLANNING</option>
                    <option value="in-progress">IN_PROGRESS</option>
                    <option value="review">REVIEW</option>
                    <option value="deployed">DEPLOYED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Priority</label>
                  <select value={priority} onChange={e => setPriority(e.target.value as any)} className="w-full bg-black border border-white/10 h-11 px-3 font-mono text-xs focus:border-white/40 outline-none">
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Proposed Start</label>
                  <input type="date" value={proposedStartDate} onChange={e => setProposedStartDate(e.target.value)} className="w-full bg-black border border-white/10 h-11 px-3 font-mono text-xs focus:border-white/40 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Client Deadline</label>
                  <input type="date" value={clientDeadline} onChange={e => setClientDeadline(e.target.value)} className="w-full bg-black border border-white/10 h-11 px-3 font-mono text-xs focus:border-white/40 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Assign Team</label>
                <select value={teamId} onChange={e => setTeamId(e.target.value)} className="w-full bg-black border border-white/10 h-11 px-3 font-mono text-xs focus:border-white/40 outline-none">
                  <option value="">UNALLOCATED</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setShowLogs(true)}
                  className="flex items-center gap-2 text-xs font-mono text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest whitespace-nowrap"
                >
                  <History className="w-4 h-4" /> View Logs
                </button>

                {!isDeleting ? (
                  <button
                    type="button"
                    onClick={() => setIsDeleting(true)}
                    className="flex items-center gap-2 text-xs font-mono text-red-500 hover:text-red-400 transition-colors uppercase tracking-widest whitespace-nowrap"
                  >
                    <Trash2 className="w-4 h-4" /> Archive
                  </button>
                ) : (
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase font-mono text-red-500/80">Reason for Archiveing</label>
                    <textarea
                      required
                      value={deleteReason}
                      onChange={e => setDeleteReason(e.target.value)}
                      className="w-full bg-black border border-red-500/30 p-3 font-mono text-xs focus:border-red-500 outline-none min-h-[80px]"
                      placeholder="Specify reason..."
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onDelete(project.id, deleteReason)}
                        className="flex-1 bg-red-500 text-white py-2 text-[10px] font-mono uppercase tracking-widest hover:bg-red-600 transition-colors"
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDeleting(false)}
                        className="flex-1 border border-white/10 text-white/70 py-2 text-[10px] font-mono uppercase tracking-widest hover:bg-white/5 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 p-6 rounded-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10"><Activity className="w-12 h-12" /></div>
                <h4 className="text-[10px] font-mono text-white/85 uppercase tracking-widest mb-4">Predictive Outcome</h4>

                {hasAllData ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-white/5 p-3">
                        <p className="text-[10px] font-mono text-white/75 uppercase mb-1">Total Real Hours</p>
                        <p className="text-xl font-mono">{expectedRealHours.toFixed(1)}h</p>
                      </div>
                      <div className="bg-white/5 p-3">
                        <p className="text-[10px] font-mono text-white/75 uppercase mb-1">Working Days</p>
                        <p className="text-xl font-mono">{calendarExpected}d</p>
                      </div>
                      <div className="bg-blue-500/10 p-3 border border-blue-500/20">
                        <p className="text-[10px] font-mono text-blue-400 uppercase mb-1">Remaining ETA</p>
                        <p className="text-xl font-mono text-blue-400">{remainingDays.toFixed(1)}d</p>
                      </div>
                      <div className={`p-3 border ${deadlineVariance !== null && deadlineVariance < 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                        <p className={`text-[10px] font-mono uppercase mb-1 ${deadlineVariance !== null && deadlineVariance < 0 ? 'text-red-400' : 'text-green-400'}`}>Variance</p>
                        <p className={`text-xl font-mono ${deadlineVariance !== null && deadlineVariance < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {deadlineVariance !== null ? `${Math.abs(deadlineVariance)}d ${deadlineVariance < 0 ? 'behind' : 'ahead'}` : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="mb-6">
                      <p className="text-[10px] font-mono text-white/75 uppercase mb-2">Predicted End</p>
                      <p className="text-lg font-mono text-white">{completionDate.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                  </>
                ) : (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 mb-6 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-mono text-yellow-500 uppercase tracking-widest mb-1">Calculation Suspended</p>
                      <p className="text-[10px] font-mono text-yellow-500/80 leading-relaxed">Please obtain and input all PERT estimates and timeline constraints to initiate the predictive outcome engine.</p>
                    </div>
                  </div>
                )}

                {hasTasks && (
                  <div className="bg-blue-500/10 border border-blue-500/20 p-3 mb-4">
                    <p className="text-[9px] font-mono text-blue-400 uppercase tracking-widest mb-0.5">Automated Aggregation</p>
                    <p className="text-[10px] font-mono text-white/85 leading-tight">
                      PERT parameters are dynamically aggregated from task-level estimations. Manual override suspended.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 mb-6">
                  <div>
                    <p className="text-[9px] font-mono text-white/90 uppercase tracking-tighter mb-1">BEST (H)</p>
                    <input 
                      type="number" 
                      step="0.1" 
                      value={pBest} 
                      onChange={e => setPBest(e.target.value)} 
                      disabled={hasTasks}
                      className="w-full bg-black/40 border border-white/10 text-center py-1 font-mono text-[10px] text-white disabled:opacity-50 disabled:cursor-not-allowed" 
                    />
                  </div>
                  <div>
                    <p className="text-[9px] font-mono text-white/90 uppercase tracking-tighter mb-1">LIKELY (H)</p>
                    <input 
                      type="number" 
                      step="0.1" 
                      value={pLikely} 
                      onChange={e => setPLikely(e.target.value)} 
                      disabled={hasTasks}
                      className="w-full bg-black/40 border border-white/10 text-center py-1 font-mono text-[10px] text-white disabled:opacity-50 disabled:cursor-not-allowed" 
                    />
                  </div>
                  <div>
                    <p className="text-[9px] font-mono text-white/90 uppercase tracking-tighter mb-1">WORST (H)</p>
                    <input 
                      type="number" 
                      step="0.1" 
                      value={pWorst} 
                      onChange={e => setPWorst(e.target.value)} 
                      disabled={hasTasks}
                      className="w-full bg-black/40 border border-white/10 text-center py-1 font-mono text-[10px] text-white disabled:opacity-50 disabled:cursor-not-allowed" 
                    />
                  </div>
                </div>

                {hasAllData && (
                  <div className="pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center"><span className="text-[11px] font-mono text-white/75 uppercase tracking-tighter">Variance calibration</span><span className="text-[10px] font-mono text-yellow-500/80">Â±{stdDev.toFixed(2)}Ïƒ</span></div>
                    <p className="text-[10px] font-mono text-white/70 mt-1 italic leading-tight">Parallel processing factor: {engineerCount} engineers.</p>
                  </div>
                )}
              </div>
              <button type="submit" className="w-full bg-white text-black h-12 font-semibold uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition-all shadow-xl shadow-white/5">
                Commit System Updates
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
