import { supabase } from '../lib/supabase';

export interface AutomationRule {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  trigger_type: string;
  conditions: Record<string, any>;
  actions: any[];
  enabled: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: string;
  rule_id: string;
  workspace_id: string;
  trigger_payload: Record<string, any>;
  status: 'success' | 'failed' | 'skipped';
  execution_result: Record<string, any>;
  executed_at: string;
  automation_context_id?: string;
  execution_depth: number;
}

export const automationRuleService = {
  async createRule(rule: Partial<AutomationRule>): Promise<AutomationRule | null> {
    const { data: user } = await supabase.auth.getUser();
    const payload = {
      ...rule,
      created_by: user.user?.id,
      updated_at: new Date().toISOString()
    };
    
    // Support backward compatibility
    if (rule.actions) {
      (payload as any).action_payload = rule.actions;
    } else {
      (payload as any).action_payload = [];
    }

    const { data, error } = await supabase
      .from('automation_rules')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[automationRuleService.createRule] Error:', error);
      return null;
    }
    return data;
  },

  async updateRule(ruleId: string, updates: Partial<AutomationRule>): Promise<boolean> {
    const payload = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    if (updates.actions) {
      (payload as any).action_payload = updates.actions;
    }

    const { error } = await supabase
      .from('automation_rules')
      .update(payload)
      .eq('id', ruleId);

    if (error) {
      console.error('[automationRuleService.updateRule] Error:', error);
      return false;
    }
    return true;
  },

  async toggleRule(ruleId: string, enabled: boolean): Promise<boolean> {
    return this.updateRule(ruleId, { enabled });
  },

  async deleteRule(ruleId: string): Promise<boolean> {
    const { error } = await supabase
      .from('automation_rules')
      .delete()
      .eq('id', ruleId);

    if (error) {
      console.error('[automationRuleService.deleteRule] Error:', error);
      return false;
    }
    return true;
  },

  async getWorkspaceRules(workspaceId: string): Promise<AutomationRule[]> {
    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[automationRuleService.getWorkspaceRules] Error:', error);
      return [];
    }
    
    // Backwards compatibility mapping
    return (data || []).map(r => ({
      ...r,
      actions: r.actions || r.action_payload || []
    })) as AutomationRule[];
  },

  async getRunHistory(workspaceId: string, limit = 100): Promise<AutomationRun[]> {
    const { data, error } = await supabase
      .from('automation_runs')
      .select('*, rule:automation_rules(name)')
      .eq('workspace_id', workspaceId)
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[automationRuleService.getRunHistory] Error:', error);
      return [];
    }
    return data as any[];
  }
};
