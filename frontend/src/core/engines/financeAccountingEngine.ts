import { supabase } from '../../lib/supabase';
import { moneyUtils } from '../../utils/moneyUtils';

export interface JournalLineInput {
  account_id: string;
  debit_amount?: number;
  credit_amount?: number;
  description?: string;
}

export const financeAccountingEngine = {
  /**
   * Safe wrapper to create a balanced journal entry via database RPC to guarantee ACID transactions.
   */
  async createBalancedEntry(params: {
    workspaceId: string;
    description: string;
    sourceType: string;
    sourceId: string;
    createdBy: string;
    entryDate?: string;
    lines: JournalLineInput[];
  }) {
    // Basic local validation before sending to DB
    const totalDebit = params.lines.reduce((sum, line) => moneyUtils.add(sum, line.debit_amount || 0), 0);
    const totalCredit = params.lines.reduce((sum, line) => moneyUtils.add(sum, line.credit_amount || 0), 0);

    if (totalDebit !== totalCredit) {
      throw new Error(`Unbalanced journal entry detected: Debits = ${totalDebit}, Credits = ${totalCredit}`);
    }

    const { data, error } = await supabase.rpc('create_balanced_journal_entry', {
      p_workspace_id: params.workspaceId,
      p_description: params.description,
      p_source_type: params.sourceType,
      p_source_id: params.sourceId,
      p_created_by: params.createdBy,
      p_entry_date: params.entryDate || new Date().toISOString(),
      p_lines: params.lines
    });

    if (error) {
      console.error('Accounting Engine Error:', error);
      throw error;
    }

    return data; // Returns journal_entry_id
  },

  /**
   * Reverses an existing posted journal entry safely without deleting history.
   */
  async reverseEntry(workspaceId: string, journalId: string, reversedBy: string, reason: string) {
    // 1. Fetch original entry and lines
    const { data: original, error: origError } = await supabase
      .from('journal_entries')
      .select('*, journal_lines(*)')
      .eq('id', journalId)
      .eq('workspace_id', workspaceId)
      .single();

    if (origError || !original) throw origError || new Error('Journal entry not found');
    if (original.status === 'reversed') throw new Error('Journal entry is already reversed');

    // 2. Create reversal lines (swap debit/credit)
    const reversedLines = original.journal_lines.map((line: any) => ({
      account_id: line.account_id,
      debit_amount: line.credit_amount,
      credit_amount: line.debit_amount,
      description: `Reversal: ${line.description || 'Original line'}`
    }));

    // 3. Post reversal entry
    const newJournalId = await this.createBalancedEntry({
      workspaceId,
      description: `Reversal of #${original.entry_number || journalId} - ${reason}`,
      sourceType: 'reversal',
      sourceId: original.id,
      createdBy: reversedBy,
      lines: reversedLines
    });

    // 4. Mark original as reversed
    await supabase.from('journal_entries').update({ status: 'reversed' }).eq('id', journalId);

    return newJournalId;
  },

  /**
   * Validates if a specific account is currently balanced.
   */
  async validateEntry(journalId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('journal_lines')
      .select('debit_amount, credit_amount')
      .eq('journal_entry_id', journalId);

    if (error) throw error;

    const dr = data.reduce((sum, line) => moneyUtils.add(sum, line.debit_amount), 0);
    const cr = data.reduce((sum, line) => moneyUtils.add(sum, line.credit_amount), 0);

    return dr === cr;
  },

  /**
   * Closes an accounting period to prevent historical modifications.
   */
  async closePeriod(workspaceId: string, periodId: string, closedBy: string) {
    const { error } = await supabase
      .from('accounting_periods')
      .update({ 
        status: 'closed', 
        closed_by: closedBy,
        closed_at: new Date().toISOString()
      })
      .eq('id', periodId)
      .eq('workspace_id', workspaceId);

    if (error) throw error;
  }
};
