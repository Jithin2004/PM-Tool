import { supabase } from '../lib/supabase';

export interface ChartOfAccount {
  id: string;
  account_code: string;
  name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  status: 'active' | 'archived';
}

export const financeSetupService = {
  /**
   * Idempotently seeds the default chart of accounts for a workspace.
   */
  async ensureDefaultAccounts(workspaceId: string): Promise<Record<string, ChartOfAccount>> {
    // 1. Fetch existing accounts
    const { data: existingAccounts, error: fetchError } = await supabase
      .from('finance_chart_accounts')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (fetchError) throw fetchError;

    const existingNames = new Set(existingAccounts?.map(a => a.name) || []);
    
    // 2. Define defaults
    const defaults: Array<Partial<ChartOfAccount>> = [
      { account_code: '1000', name: 'Cash', account_type: 'asset' },
      { account_code: '1010', name: 'Company Bank', account_type: 'asset' },
      { account_code: '1200', name: 'Accounts Receivable', account_type: 'asset' },
      
      { account_code: '2000', name: 'Accounts Payable', account_type: 'liability' },
      { account_code: '2200', name: 'Tax Payable', account_type: 'liability' },
      
      { account_code: '3000', name: 'Owner Equity', account_type: 'equity' },
      
      { account_code: '4000', name: 'Sales Revenue', account_type: 'revenue' },
      { account_code: '4100', name: 'Service Revenue', account_type: 'revenue' },
      
      { account_code: '5000', name: 'Salary Expense', account_type: 'expense' },
      { account_code: '5100', name: 'Rent Expense', account_type: 'expense' },
      { account_code: '5200', name: 'Software Expense', account_type: 'expense' },
      { account_code: '5900', name: 'General Expense', account_type: 'expense' }
    ];

    // 3. Filter what needs to be created
    const toCreate = defaults.filter(d => !existingNames.has(d.name!)).map(d => ({
      workspace_id: workspaceId,
      account_code: d.account_code,
      name: d.name,
      account_type: d.account_type,
      status: 'active'
    }));

    if (toCreate.length > 0) {
      const { error: insertError } = await supabase
        .from('finance_chart_accounts')
        .insert(toCreate);
      
      if (insertError) throw insertError;
    }

    // 4. Return map of all accounts (for easy lookup)
    const { data: finalAccounts } = await supabase
      .from('finance_chart_accounts')
      .select('*')
      .eq('workspace_id', workspaceId);

    const accountMap: Record<string, ChartOfAccount> = {};
    for (const acc of finalAccounts || []) {
      accountMap[acc.name] = acc;
    }

    return accountMap;
  }
};
