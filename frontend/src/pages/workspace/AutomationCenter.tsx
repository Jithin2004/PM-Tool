import React, { useEffect, useState } from 'react';
import { AutomationRule, AutomationRun, automationRuleService } from '../../services/automationRuleService';
import { RuleBuilder } from '../../components/automation/RuleBuilder';
import { Plus, Power, Settings, Clock, AlertCircle, CheckCircle2, Zap, Activity } from 'lucide-react';
import { EmptyState } from '../../components/core';

export default function AutomationCenter() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<AutomationRule> | undefined>();
  
  // Hardcoded for demo, normally from context
  const workspaceId = 'current-workspace-id';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const fetchedRules = await automationRuleService.getWorkspaceRules(workspaceId);
    const fetchedRuns = await automationRuleService.getRunHistory(workspaceId);
    setRules(fetchedRules);
    setRuns(fetchedRuns);
  };

  const handleSaveRule = async (ruleData: Partial<AutomationRule>) => {
    if (editingRule?.id) {
      await automationRuleService.updateRule(editingRule.id, ruleData);
    } else {
      await automationRuleService.createRule({ ...ruleData, workspace_id: workspaceId });
    }
    setIsBuilding(false);
    setEditingRule(undefined);
    loadData();
  };

  const toggleRule = async (id: string, currentEnabled: boolean) => {
    await automationRuleService.toggleRule(id, !currentEnabled);
    loadData();
  };

  if (isBuilding) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <RuleBuilder 
          initialRule={editingRule}
          onSave={handleSaveRule} 
          onCancel={() => { setIsBuilding(false); setEditingRule(undefined); }} 
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Automation Center</h1>
          <p className="text-sm text-text-secondary mt-1">Manage workspace automation rules and execution history.</p>
        </div>
        <button 
          onClick={() => setIsBuilding(true)}
          className="btn-premium-primary px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Rules List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Settings className="w-5 h-5 text-text-tertiary" /> Active Rules
          </h2>
          
          {rules.length === 0 ? (
            <div className="mt-8">
              <EmptyState
                icon={Zap}
                title="No active rules"
                description="Automate repetitive tasks like assigning issues, sending notifications, or transitioning states."
                action={
                  <button onClick={() => setIsBuilding(true)} className="btn-premium-secondary px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 mx-auto">
                    <Plus className="w-4 h-4" /> Create Automation
                  </button>
                }
              />
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => (
                <div key={rule.id} className="bg-surface border border-border rounded-xl p-4 flex items-start justify-between shadow-sm">
                  <div>
                    <h3 className="font-semibold text-text-primary flex items-center gap-2">
                      {rule.name}
                      {!rule.enabled && <span className="px-2 py-0.5 bg-surface-3 text-text-tertiary text-xs rounded-full">Disabled</span>}
                    </h3>
                    <p className="text-sm text-text-secondary mt-1">{rule.description}</p>
                    <div className="flex gap-4 mt-3 text-xs font-medium">
                      <span className="text-indigo-500 uppercase">WHEN: {rule.trigger_type.replace('_', ' ')}</span>
                      <span className="text-amber-500 uppercase">IF: {Object.keys(rule.conditions || {}).length} conditions</span>
                      <span className="text-emerald-500 uppercase">THEN: {rule.actions?.length || 0} actions</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => { setEditingRule(rule); setIsBuilding(true); }}
                      className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-2 rounded-lg"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => toggleRule(rule.id, rule.enabled)}
                      className={`p-2 rounded-lg transition ${rule.enabled ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-text-tertiary hover:bg-surface-3'}`}
                    >
                      <Power className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Execution History */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Clock className="w-5 h-5 text-text-tertiary" /> Recent Runs
          </h2>
          
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {runs.length === 0 ? (
              <div className="p-12 border-t border-transparent">
                <EmptyState
                  icon={Activity}
                  title="No executions"
                  description="Recent automation activity will appear here once your rules trigger."
                />
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {runs.map(run => (
                  <div key={run.id} className="p-4 hover:bg-surface-2 transition">
                    <div className="flex items-start justify-between">
                      <div className="text-sm font-medium text-text-primary truncate">
                        {(run as any).rule?.name || 'Unknown Rule'}
                      </div>
                      {run.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-signal-critical shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-text-tertiary mt-1 flex justify-between">
                      <span>Depth: {run.execution_depth}</span>
                      <span>{new Date(run.executed_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
