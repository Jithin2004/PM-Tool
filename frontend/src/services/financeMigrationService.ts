import { supabase } from '../lib/supabase';
import { financeSetupService } from './financeSetupService';
import { financeAccountingEngine } from '../core/engines/financeAccountingEngine';

export const financeMigrationService = {
  /**
   * Migrates all legacy `ledger_transactions` for a given workspace into balanced `journal_entries`.
   */
  async migrateLegacyTransactions(workspaceId: string, actorId: string) {
    // 1. Ensure chart of accounts exists and get map
    const accountMap = await financeSetupService.ensureDefaultAccounts(workspaceId);
    
    // We'll map generic legacy to these specific accounts
    const cashAccount = accountMap['Company Bank'];
    const revenueAccount = accountMap['Service Revenue'];
    const expenseAccount = accountMap['General Expense'];

    if (!cashAccount || !revenueAccount || !expenseAccount) {
      throw new Error('Failed to load default chart of accounts for migration');
    }

    // 2. Fetch unmigrated legacy transactions
    // We join with finance_migration_map. If there's no match, we migrate it.
    const { data: unmigrated, error } = await supabase
      .from('ledger_transactions')
      .select(`
        *,
        finance_migration_map (journal_entry_id)
      `)
      .eq('workspace_id', workspaceId);

    if (error) throw error;

    const toMigrate = (unmigrated || []).filter(tx => !tx.finance_migration_map || tx.finance_migration_map.length === 0);

    if (toMigrate.length === 0) {
      console.log(`[Finance Migration] Workspace ${workspaceId} is already fully migrated.`);
      return;
    }

    console.log(`[Finance Migration] Found ${toMigrate.length} legacy transactions to migrate for ${workspaceId}.`);

    let migratedCount = 0;

    for (const tx of toMigrate) {
      try {
        let journalId;
        const amount = Number(tx.amount);
        const absAmount = Math.abs(amount);

        if (tx.transaction_type === 'income' || amount > 0) {
          // DR Cash
          // CR Revenue
          journalId = await financeAccountingEngine.createBalancedEntry({
            workspaceId,
            description: `Legacy Income: ${tx.description || 'Migrated transaction'}`,
            sourceType: 'legacy_import',
            sourceId: tx.id,
            createdBy: actorId,
            entryDate: tx.transaction_date || tx.created_at,
            lines: [
              { account_id: cashAccount.id, debit_amount: absAmount, credit_amount: 0, description: 'Bank Deposit' },
              { account_id: revenueAccount.id, debit_amount: 0, credit_amount: absAmount, description: 'Legacy Revenue Recognition' }
            ]
          });
        } else {
          // DR Expense
          // CR Cash
          journalId = await financeAccountingEngine.createBalancedEntry({
            workspaceId,
            description: `Legacy Expense: ${tx.description || 'Migrated transaction'}`,
            sourceType: 'legacy_import',
            sourceId: tx.id,
            createdBy: actorId,
            entryDate: tx.transaction_date || tx.created_at,
            lines: [
              { account_id: expenseAccount.id, debit_amount: absAmount, credit_amount: 0, description: 'Legacy Expense Recognition' },
              { account_id: cashAccount.id, debit_amount: 0, credit_amount: absAmount, description: 'Bank Withdrawal' }
            ]
          });
        }

        // Write migration map
        await supabase.from('finance_migration_map').insert({
          legacy_transaction_id: tx.id,
          journal_entry_id: journalId
        });

        migratedCount++;
      } catch (err) {
        console.error(`[Finance Migration] Failed to migrate transaction ${tx.id}`, err);
        // Continue with others
      }
    }

    console.log(`[Finance Migration] Successfully migrated ${migratedCount} transactions for ${workspaceId}.`);
  }
};
