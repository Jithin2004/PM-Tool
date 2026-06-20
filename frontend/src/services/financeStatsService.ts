import { supabase } from '../lib/supabase';
import { moneyUtils } from '../utils/moneyUtils';

export interface FinanceSummary {
  cashAvailable: number;
  moneyComingIn: number; // AR
  moneyGoingOut: number; // Expenses
  liabilities: number;
  profit: number; // Revenue - Expenses
}

export const financeStatsService = {
  /**
   * Generates a high-level summary from the journal lines for normal users.
   */
  async getBusinessSummary(workspaceId: string): Promise<FinanceSummary> {
    const { data: lines, error } = await supabase
      .from('journal_lines')
      .select('debit_amount, credit_amount, finance_chart_accounts(account_type, account_code)')
      .eq('finance_chart_accounts.workspace_id', workspaceId);

    // Note: Due to PostgREST limitations on nested filtering on foreign tables sometimes not omitting rows,
    // we fetch lines and filter locally or use a view. For speed, assuming a workspace doesn't have 100k lines yet.
    // If we only get lines joined properly:
    
    // We should do a more precise fetch
    const { data: rawLines, error: rawError } = await supabase.rpc('get_workspace_journal_lines', { p_workspace_id: workspaceId });
    
    // Fallback if RPC doesn't exist yet:
    const { data: accounts, error: accErr } = await supabase
      .from('finance_chart_accounts')
      .select('id, account_type, name')
      .eq('workspace_id', workspaceId);

    if (accErr) throw accErr;

    const accountMap = new Map(accounts?.map(a => [a.id, a]) || []);

    const { data: allLines, error: lineErr } = await supabase
      .from('journal_lines')
      .select('account_id, debit_amount, credit_amount')
      // Note: we can't easily filter by workspace_id without a join, but RLS protects us.
      .limit(10000); 

    if (lineErr) throw lineErr;

    let cash = 0;
    let ar = 0;
    let rev = 0;
    let exp = 0;
    let ap = 0;

    for (const line of allLines || []) {
      const acc = accountMap.get(line.account_id);
      if (!acc) continue; // Not our workspace's account

      const d = Number(line.debit_amount || 0);
      const c = Number(line.credit_amount || 0);

      if (acc.name === 'Company Bank' || acc.name === 'Cash') {
        cash = moneyUtils.add(cash, moneyUtils.subtract(d, c)); // Asset = DR - CR
      }
      if (acc.name === 'Accounts Receivable') {
        ar = moneyUtils.add(ar, moneyUtils.subtract(d, c)); // Asset
      }
      if (acc.account_type === 'revenue') {
        rev = moneyUtils.add(rev, moneyUtils.subtract(c, d)); // Revenue = CR - DR
      }
      if (acc.account_type === 'liability') {
        ap = moneyUtils.add(ap, moneyUtils.subtract(c, d)); // Liability = CR - DR
      }
      if (acc.account_type === 'expense') {
        exp = moneyUtils.add(exp, moneyUtils.subtract(d, c)); // Expense = DR - CR
      }
    }

    return {
      cashAvailable: cash,
      moneyComingIn: ar,
      moneyGoingOut: exp,
      liabilities: ap,
      profit: moneyUtils.subtract(rev, exp)
    };
  }
};

