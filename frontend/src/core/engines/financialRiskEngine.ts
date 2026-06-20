import { supabase } from '../../lib/supabase';
import { financeLedgerService } from '../../services/financeLedgerService';

export const financialRiskEngine = {
  /**
   * Scans global financial health and emits escalations if necessary.
   */
  async scanFinancialHealth(workspaceId: string) {
    // 1. Get Accounts & Settings
    const { data: accounts } = await supabase.from('finance_accounts').select('*').eq('workspace_id', workspaceId);
    const { data: settingsRow } = await supabase.from('finance_settings').select('settings').eq('workspace_id', workspaceId).single();
    
    if (!accounts || accounts.length === 0) return null;
    const primaryAccountId = accounts[0].id;
    const lowRunwayMonths = settingsRow?.settings?.low_runway_months || 3;

    // 2. Get Balances
    const cash = 0 /* mocked balance */;

    // 3. Get recent burn (expenses in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: recentExpenses } = await supabase
      .from('ledger_transactions')
      .select('amount')
      .eq('workspace_id', workspaceId)
      .eq('transaction_type', 'expense')
      .gte('transaction_date', thirtyDaysAgo.toISOString());

    const monthlyBurn = (recentExpenses || []).reduce((sum, tx) => sum + Number(tx.amount), 0);
    
    // 4. Calculate Runway
    const runwayMonths = monthlyBurn > 0 ? cash / monthlyBurn : 999;

    // 5. Get Overdue Receivables
    const { data: overdueInvoices } = await supabase
      .from('invoices')
      .select('balance_due')
      .eq('workspace_id', workspaceId)
      .eq('status', 'overdue');
      
    const totalOverdue = (overdueInvoices || []).reduce((sum, inv) => sum + Number(inv.balance_due), 0);

    const risks = [];

    if (runwayMonths < lowRunwayMonths) {
      risks.push({
        type: 'low_runway',
        severity: 'high',
        message: `Cash runway is ${runwayMonths.toFixed(1)} months. Threshold is ${lowRunwayMonths} months.`
      });
      await this._escalate(workspaceId, 'low_runway', `Runway critically low: ${runwayMonths.toFixed(1)} months.`);
    }

    if (totalOverdue > monthlyBurn) {
      risks.push({
        type: 'high_receivables',
        severity: 'medium',
        message: `Overdue receivables (${totalOverdue}) exceed monthly burn (${monthlyBurn}).`
      });
    }

    return {
      cash,
      monthlyBurn,
      runwayMonths,
      totalOverdue,
      risks
    };
  },

  async _escalate(workspaceId: string, riskType: string, message: string) {
    // Only escalate if not already escalated recently
    const { data: existing } = await supabase
      .from('universal_approvals')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('type', riskType)
      .eq('status', 'pending')
      .maybeSingle();

    if (!existing) {
      await supabase.from('universal_approvals').insert({
        workspace_id: workspaceId,
        entity_type: 'finance_risk',
        entity_id: 'global',
        type: riskType,
        status: 'pending',
        metadata: { message }
      });
    }
  }
};
