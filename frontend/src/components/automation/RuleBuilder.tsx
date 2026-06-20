import React, { useState } from 'react';
import { AutomationRule } from '../../services/automationRuleService';
import { Play, Settings, Save, X, Plus } from 'lucide-react';

interface RuleBuilderProps {
  initialRule?: Partial<AutomationRule>;
  onSave: (rule: Partial<AutomationRule>) => void;
  onCancel: () => void;
}

const TRIGGER_TYPES = [
  { value: 'task_created', label: 'Task Created' },
  { value: 'task_updated', label: 'Task Updated' },
  { value: 'document_approved', label: 'Document Approved' },
  { value: 'invoice_overdue', label: 'Invoice Overdue' }
];

const ACTION_TYPES = [
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'create_task', label: 'Create Task' },
  { value: 'change_status', label: 'Change Status' },
  { value: 'create_approval', label: 'Create Approval' }
];

export function RuleBuilder({ initialRule, onSave, onCancel }: RuleBuilderProps) {
  const [name, setName] = useState(initialRule?.name || '');
  const [description, setDescription] = useState(initialRule?.description || '');
  const [triggerType, setTriggerType] = useState(initialRule?.trigger_type || 'task_updated');
  const [conditions, setConditions] = useState<Record<string, any>>(initialRule?.conditions || {});
  const [actions, setActions] = useState<any[]>(initialRule?.actions || []);

  const handleAddCondition = () => {
    setConditions(prev => ({ ...prev, ['new_key']: 'new_value' }));
  };

  const handleConditionChange = (oldKey: string, newKey: string, value: string) => {
    setConditions(prev => {
      const next = { ...prev };
      if (oldKey !== newKey) {
        delete next[oldKey];
      }
      next[newKey] = value;
      return next;
    });
  };

  const handleRemoveCondition = (key: string) => {
    setConditions(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleAddAction = (type: string) => {
    setActions(prev => [...prev, { type }]);
  };

  const handleRemoveAction = (index: number) => {
    setActions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    onSave({
      name,
      description,
      trigger_type: triggerType,
      conditions,
      actions,
      enabled: true
    });
  };

  return (
    <div className="bg-surface border border-border rounded-xl shadow-lg max-w-3xl w-full mx-auto overflow-hidden">
      <div className="p-6 border-b border-border bg-surface-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-500" />
          {initialRule?.id ? 'Edit Automation Rule' : 'New Automation Rule'}
        </h2>
        <button onClick={onCancel} className="p-2 hover:bg-surface-3 rounded-lg text-text-tertiary">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 space-y-8">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Rule Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2 text-sm text-text-primary focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              placeholder="e.g., Notify PM on Blocked Task"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Description</label>
            <input 
              type="text" 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2 text-sm text-text-primary focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              placeholder="Optional description"
            />
          </div>
        </div>

        {/* WHEN block */}
        <div className="bg-surface-2 border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-indigo-500 mb-3 uppercase tracking-wider">WHEN</h3>
          <select 
            value={triggerType} 
            onChange={e => setTriggerType(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-sm text-text-primary outline-none"
          >
            {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* IF block */}
        <div className="bg-surface-2 border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider">IF (Conditions)</h3>
            <button onClick={handleAddCondition} className="text-xs font-medium text-amber-600 hover:text-amber-500 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add Condition
            </button>
          </div>
          
          {Object.keys(conditions).length === 0 ? (
            <p className="text-sm text-text-quaternary italic">Runs every time (no conditions)</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(conditions).map(([key, val], idx) => (
                <div key={idx} className="flex gap-3">
                  <input 
                    type="text" 
                    value={key}
                    onChange={e => handleConditionChange(key, e.target.value, val)}
                    placeholder="Field (e.g. priority)"
                    className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm"
                  />
                  <span className="flex items-center text-text-tertiary text-sm">equals</span>
                  <input 
                    type="text" 
                    value={val}
                    onChange={e => handleConditionChange(key, key, e.target.value)}
                    placeholder="Value (e.g. critical)"
                    className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm"
                  />
                  <button onClick={() => handleRemoveCondition(key)} className="text-text-tertiary hover:text-signal-critical p-1.5">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* THEN block */}
        <div className="bg-surface-2 border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-wider">THEN (Actions)</h3>
            <select 
              onChange={e => { if(e.target.value) handleAddAction(e.target.value); e.target.value=''; }}
              className="bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text-primary outline-none"
            >
              <option value="">+ Add Action...</option>
              {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          
          {actions.length === 0 ? (
            <p className="text-sm text-text-quaternary italic text-signal-critical">At least one action is required</p>
          ) : (
            <div className="space-y-3">
              {actions.map((act, idx) => (
                <div key={idx} className="flex items-center justify-between bg-surface border border-border p-3 rounded-lg">
                  <span className="text-sm font-medium text-text-primary">
                    {ACTION_TYPES.find(a => a.value === act.type)?.label || act.type}
                  </span>
                  <button onClick={() => handleRemoveAction(idx)} className="text-text-tertiary hover:text-signal-critical p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-6 border-t border-border bg-surface-2 flex justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary">
          Cancel
        </button>
        <button 
          onClick={handleSubmit} 
          disabled={!name || actions.length === 0}
          className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> Save Rule
        </button>
      </div>
    </div>
  );
}
