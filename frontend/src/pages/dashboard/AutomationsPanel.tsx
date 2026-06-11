import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchAutomationRules, createAutomationRule, toggleAutomationRule, deleteAutomationRule,
  fetchTemplates, installTemplate,
  AutomationRule, AutomationTemplate, BUILTIN_TEMPLATES,
} from '../../services/automationEngine';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { Zap, Plus, Settings2, Trash2, Shield, Activity, Power, Download } from 'lucide-react';

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AutomationsPanel() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const wsId = workspace?.id || '';
  const [tab, setTab] = useState<'rules' | 'marketplace'>('marketplace');
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [templates, setTemplates] = useState<AutomationTemplate[]>(BUILTIN_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEvent, setNewEvent] = useState('task.created');
  const [newActionType, setNewActionType] = useState('send_notification');

  const loadData = useCallback(async () => {
    if (!wsId) return;
    try {
      const [r, t] = await Promise.all([fetchAutomationRules(wsId), fetchTemplates()]);
      setRules(r);
      setTemplates(t);
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggle = async (ruleId: string, enabled: boolean) => {
    await toggleAutomationRule(ruleId, !enabled);
    await loadData();
  };

  const handleDelete = async (ruleId: string) => {
    await deleteAutomationRule(ruleId);
    await loadData();
  };

  const handleInstall = async (template: AutomationTemplate) => {
    const msgKey = `install_${template.id}`;
    const rule = await installTemplate(template, wsId);
    setMessages(prev => ({ ...prev, [msgKey]: rule ? 'Installed' : 'Failed' }));
    await loadData();
  };

  const handleCreateRule = async () => {
    if (!newName.trim()) return;
    await createAutomationRule({
      workspace_id: wsId, name: newName, trigger_event: newEvent,
      trigger_filters: {}, actions: [{ type: newActionType, params: {} }], enabled: true,
    });
    setNewName('');
    setShowCreate(false);
    await loadData();
  };

  if (loading) return (
    <div className="p-8 animate-fade-in flex flex-col items-center justify-center h-[50vh]">
      <div className="w-10 h-10 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mb-4" />
      <div className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Initializing Automation Engine...</div>
    </div>
  );

  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)] max-w-7xl mx-auto px-4" style={{ color: 'var(--pm-on-surface)' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2 pb-6 border-b border-border/50 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>
            Automation Engine
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Event-driven operational triggers, dynamic state machines, and background orchestration
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-border bg-surface-2"
          style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 operational-pulse" style={{ boxShadow: '0 0 8px rgba(45,212,191,0.5)' }} />
          <span className="font-mono-pm text-xs uppercase tracking-widest text-[var(--pm-on-surface-variant)]" style={{ color: 'var(--pm-on-surface-variant)' }}>
             ACTIVE RULES: {rules.filter(r => r.enabled).length}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-border/50 pb-px mb-8 relative">
        <button onClick={() => setTab('marketplace')}
          className={`text-[11px] font-bold uppercase tracking-widest px-1 pb-4 border-b-2 transition-all ${tab === 'marketplace' ? 'text-teal-400 border-teal-400' : 'text-text-quaternary border-transparent hover:text-text-secondary hover:border-border'}`}>
          Marketplace <span className="ml-1.5 bg-surface-3 px-2 py-0.5 rounded-full text-[9px]">{templates.length}</span>
        </button>
        <button onClick={() => setTab('rules')}
          className={`text-[11px] font-bold uppercase tracking-widest px-1 pb-4 border-b-2 transition-all ${tab === 'rules' ? 'text-teal-400 border-teal-400' : 'text-text-quaternary border-transparent hover:text-text-secondary hover:border-border'}`}>
          My Rules <span className="ml-1.5 bg-surface-3 px-2 py-0.5 rounded-full text-[9px]">{rules.length}</span>
        </button>
      </div>

      {/* ── Marketplace ── */}
      {tab === 'marketplace' && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {templates.map(tmpl => {
              const msgKey = `install_${tmpl.id}`;
              const installed = rules.find(r => r.name === tmpl.name);
              return (
                <div key={tmpl.id} className="group relative pm-card glass-panel p-6 border-transparent hover:border-[var(--pm-primary)] flex flex-col">
                  <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent rounded-2xl pointer-events-none" />
                  
                  <div className="relative z-10 flex-1">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary bg-surface-3 border border-border/50 px-2 py-1 rounded-md">{tmpl.category}</span>
                    </div>
                    <div className="text-sm font-bold text-text-primary mb-2 group-hover:text-teal-400 transition-colors">{tmpl.name}</div>
                    {tmpl.description && <div className="text-[11px] text-text-tertiary mb-5">{tmpl.description}</div>}
                  </div>
                  
                  <div className="relative z-10 border-t border-border/50 pt-4 mt-auto">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-text-tertiary mb-4 flex items-center gap-1.5"><Zap className="w-3 h-3 text-teal-500" /> Trigger: <span className="text-text-secondary">{tmpl.trigger_event}</span></div>
                    <div className="flex items-center justify-between">
                      {installed ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-signal-safe flex items-center gap-1.5 bg-signal-safe/10 px-3 py-1.5 rounded-lg border border-signal-safe/20"><Shield className="w-3 h-3" /> Installed</span>
                      ) : (
                        <button onClick={() => handleInstall(tmpl)}
                          className="px-4 py-2 bg-surface-3 border border-border/50 text-text-secondary text-[10px] font-bold uppercase tracking-wider hover:bg-teal-500/10 hover:border-teal-500/30 hover:text-teal-400 rounded-lg transition-all active:scale-95 flex items-center gap-1.5">
                          <Download className="w-3 h-3" /> Install Template
                        </button>
                      )}
                      {messages[msgKey] && <span className="text-[10px] font-bold uppercase tracking-wider text-signal-info">{messages[msgKey]}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Rules ── */}
      {tab === 'rules' && (
        <div>
          <div className="flex justify-end mb-6">
            <button onClick={() => setShowCreate(!showCreate)}
              className="px-5 py-2.5 bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[10px] font-bold uppercase tracking-wider hover:bg-teal-500/20 rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-sm">
              <Plus className="w-4 h-4" />
              {showCreate ? 'Cancel Creation' : 'Create Custom Rule'}
            </button>
          </div>

          {showCreate && (
            <div className="glass-panel pm-card rounded-2xl p-6 border-[var(--pm-primary)]/50 mb-8 shadow-lg animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-teal-500" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-5">Configure Automation</h3>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Rule Name (e.g., Alert on critical bugs)" className="w-full bg-surface-3/50 border border-border/50 focus:border-teal-500/50 p-3 rounded-xl text-sm text-text-primary mb-4 transition-all outline-none" />
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-2 block">Trigger Event</label>
                  <select value={newEvent} onChange={e => setNewEvent(e.target.value)}
                    className="w-full bg-surface-3/50 border border-border/50 focus:border-teal-500/50 p-3 rounded-xl text-sm text-text-primary outline-none transition-all cursor-pointer">
                    <option value="task.created">Task created</option>
                    <option value="task.status_changed">Task status changed</option>
                    <option value="task.completed">Task completed</option>
                    <option value="task.blocked">Task blocked</option>
                    <option value="sprint.completed">Sprint completed</option>
                    <option value="leave.approved">Leave approved</option>
                    <option value="document.created">Document created</option>
                    <option value="approval.completed">Approval completed</option>
                  </select>
                </div>
                <div className="sm:w-64">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-2 block">Action</label>
                  <select value={newActionType} onChange={e => setNewActionType(e.target.value)}
                    className="w-full bg-surface-3/50 border border-border/50 focus:border-teal-500/50 p-3 rounded-xl text-sm text-text-primary outline-none transition-all cursor-pointer">
                    <option value="send_notification">Notify</option>
                    <option value="move_task">Move task</option>
                    <option value="assign_task">Assign task</option>
                    <option value="create_task">Create task</option>
                    <option value="create_approval">Create approval</option>
                    <option value="call_webhook">Webhook</option>
                  </select>
                </div>
              </div>
              <button onClick={handleCreateRule} disabled={!newName.trim()}
                className="px-6 py-2.5 bg-teal-500 text-[var(--pm-text)] text-[var(--text-primary)] text-[11px] font-bold uppercase tracking-wider hover:bg-teal-400 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(20,184,166,0.3)]">
                Deploy Rule
              </button>
            </div>
          )}

          {rules.length === 0 ? (
            <div className="border border-dashed border-border/50 bg-surface/30 rounded-2xl p-16 flex flex-col items-center justify-center text-center">
              <Settings2 className="w-12 h-12 text-text-quaternary mb-4 opacity-50" />
              <span className="text-sm font-bold text-text-secondary mb-2">No active automation rules</span>
              <span className="text-xs text-text-tertiary">Install predefined templates from the marketplace or create your own custom workflow logic.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => (
                <div key={rule.id} className="pm-card glass-panel p-5 border-transparent hover:border-[var(--pm-primary)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-surface/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-sm font-bold text-text-primary">{rule.name}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${rule.enabled ? 'bg-signal-safe/10 border-signal-safe/20 text-signal-safe' : 'bg-surface-3 border-border/50 text-text-quaternary'}`}>
                        {rule.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                      <span className="flex items-center gap-1 bg-surface-3 px-2 py-1 rounded border border-border/50"><Zap className="w-3 h-3 text-teal-500" /> {rule.trigger_event}</span>
                      {rule.execution_count ? <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {rule.execution_count} runs</span> : null}
                      {rule.last_executed_at ? <span>Last run {timeAgo(rule.last_executed_at)}</span> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleToggle(rule.id, rule.enabled)}
                      className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-4 py-2 border rounded-lg transition-all active:scale-95 ${rule.enabled ? 'bg-surface-3 border-border/50 text-text-secondary hover:bg-surface-4' : 'bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20'}`}>
                      <Power className="w-3 h-3" /> {rule.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => handleDelete(rule.id)}
                      className="flex items-center justify-center p-2 border border-signal-critical/20 bg-signal-critical/5 text-signal-critical/60 hover:text-signal-critical hover:bg-signal-critical/10 rounded-lg transition-all active:scale-95" title="Delete Rule">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
