import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchAutomationRules, createAutomationRule, toggleAutomationRule, deleteAutomationRule,
  fetchTemplates, installTemplate,
  AutomationRule, AutomationTemplate, BUILTIN_TEMPLATES,
} from '../../services/automationEngine';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';

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
    const [r, t] = await Promise.all([fetchAutomationRules(wsId), fetchTemplates()]);
    setRules(r);
    setTemplates(t);
    setLoading(false);
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
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[10px] font-mono uppercase tracking-wide text-text-quaternary">CONTROL</span>
        <span className="text-text-quaternary">/</span>
        <span className="text-xs font-mono text-text-secondary">Automations</span>
      </div>
      <div className="text-[11px] font-mono text-text-quaternary">Loading automations...</div>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[10px] font-mono uppercase tracking-wide text-text-quaternary">CONTROL</span>
        <span className="text-text-quaternary">/</span>
        <span className="text-xs font-mono text-text-secondary">Automations</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border pb-3 mb-6">
        <button onClick={() => setTab('marketplace')}
          className={`text-[10px] font-mono uppercase tracking-wider ${tab === 'marketplace' ? 'text-text-primary border-b-2 border-white/40 pb-3' : 'text-text-quaternary hover:text-text-tertiary'}`}>
          Marketplace ({templates.length})
        </button>
        <button onClick={() => setTab('rules')}
          className={`text-[10px] font-mono uppercase tracking-wider ${tab === 'rules' ? 'text-text-primary border-b-2 border-white/40 pb-3' : 'text-text-quaternary hover:text-text-tertiary'}`}>
          My Rules ({rules.length})
        </button>
      </div>

      {/* ── Marketplace ── */}
      {tab === 'marketplace' && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map(tmpl => {
              const msgKey = `install_${tmpl.id}`;
              const installed = rules.find(r => r.name === tmpl.name);
              return (
                <div key={tmpl.id} className="border border-border bg-surface-3 p-4 hover:border-border transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-mono uppercase text-text-quaternary bg-white/5 px-1.5 py-0.5">{tmpl.category}</span>
                  </div>
                  <div className="text-xs font-mono text-text-secondary mb-1">{tmpl.name}</div>
                  {tmpl.description && <div className="text-[9px] font-mono text-text-quaternary mb-3">{tmpl.description}</div>}
                  <div className="text-[8px] font-mono text-text-quaternary mb-3">Trigger: {tmpl.trigger_event}</div>
                  <div className="flex items-center gap-2">
                    {installed ? (
                      <span className="text-[9px] font-mono text-emerald-400">Installed</span>
                    ) : (
                      <button onClick={() => handleInstall(tmpl)}
                        className="px-3 py-1.5 bg-surface-3 border border-border text-signal-info text-[9px] font-mono uppercase tracking-wider hover:bg-surface-3">
                        Install
                      </button>
                    )}
                    {messages[msgKey] && <span className="text-[9px] font-mono text-text-quaternary">{messages[msgKey]}</span>}
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
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowCreate(!showCreate)}
              className="px-3 py-1.5 bg-surface-3 border border-border text-signal-info text-[9px] font-mono uppercase tracking-wider hover:bg-surface-3">
              {showCreate ? 'Cancel' : 'New Rule'}
            </button>
          </div>

          {showCreate && (
            <div className="border border-border bg-surface-3 p-4 mb-4">
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Rule name" className="w-full bg-bg border border-border p-2 text-[11px] font-mono text-text-primary placeholder-white/20 mb-2" />
              <div className="flex gap-2 mb-2">
                <select value={newEvent} onChange={e => setNewEvent(e.target.value)}
                  className="flex-1 bg-bg border border-border p-2 text-[11px] font-mono text-text-primary">
                  <option value="task.created">Task created</option>
                  <option value="task.status_changed">Task status changed</option>
                  <option value="task.completed">Task completed</option>
                  <option value="task.blocked">Task blocked</option>
                  <option value="sprint.completed">Sprint completed</option>
                  <option value="leave.approved">Leave approved</option>
                  <option value="document.created">Document created</option>
                  <option value="approval.completed">Approval completed</option>
                </select>
                <select value={newActionType} onChange={e => setNewActionType(e.target.value)}
                  className="w-36 bg-bg border border-border p-2 text-[11px] font-mono text-text-primary">
                  <option value="send_notification">Notify</option>
                  <option value="move_task">Move task</option>
                  <option value="assign_task">Assign task</option>
                  <option value="create_task">Create task</option>
                  <option value="create_approval">Create approval</option>
                  <option value="call_webhook">Webhook</option>
                </select>
              </div>
              <button onClick={handleCreateRule}
                className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[9px] font-medium">Create</button>
            </div>
          )}

          {rules.length === 0 ? (
            <div className="border border-border bg-surface-3 p-12 text-center">
              <span className="text-[10px] font-mono text-text-quaternary">No automation rules yet</span>
              <span className="text-[8px] font-mono text-text-quaternary mt-1 block">Install from marketplace or create one</span>
            </div>
          ) : (
            <div className="space-y-1">
              {rules.map(rule => (
                <div key={rule.id} className="border border-border bg-surface-3 px-4 py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-secondary">{rule.name}</span>
                      <span className={`text-[9px] font-mono ${rule.enabled ? 'text-emerald-400' : 'text-text-quaternary'}`}>
                        {rule.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <div className="text-[8px] font-mono text-text-quaternary mt-0.5">
                      {rule.trigger_event}
                      {rule.execution_count ? ` · ${rule.execution_count} runs` : ''}
                      {rule.last_executed_at ? ` · last ${timeAgo(rule.last_executed_at)}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <button onClick={() => handleToggle(rule.id, rule.enabled)}
                      className={`text-[9px] font-mono px-2 py-1 border ${rule.enabled ? 'border-border text-signal-warning' : 'border-emerald-500/30 text-emerald-400'} hover:border-white/30`}>
                      {rule.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => handleDelete(rule.id)}
                      className="text-[9px] font-mono px-2 py-1 border border-red-500/20 text-signal-critical/60 hover:border-red-500/40">Delete</button>
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
