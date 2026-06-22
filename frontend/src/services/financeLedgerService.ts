import { supabase } from '../lib/supabase';
import { activityEventService } from './activityEventService';
import { financeAccountingEngine } from '../core/engines/financeAccountingEngine';
import { financeSetupService } from './financeSetupService';
import { moneyUtils } from '../utils/moneyUtils';

export const financeLedgerService = {
  /**
   * Registers a new invoice. 
   * Debits AR, Credits Revenue and Tax Payable.
   */
  async createInvoice(params: {
    workspaceId: string;
    userId: string;
    invoiceId: string;
    subtotal: number;
    taxAmount: number;
    description: string;
  }) {
    // Idempotency check
    const { data: existing } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('source_type', 'invoice')
      .eq('source_id', params.invoiceId)
      .maybeSingle();
      
    if (existing) {
      // Logging removed for production
      return existing.id;
    }

    const accountMap = await financeSetupService.ensureDefaultAccounts(params.workspaceId);
    
    const arAccount = accountMap['Accounts Receivable'];
    const revenueAccount = accountMap['Service Revenue'];
    const taxAccount = accountMap['Tax Payable'];

    if (!arAccount || !revenueAccount || !taxAccount) throw new Error('Missing default accounts');

    const totalAmount = moneyUtils.add(params.subtotal, params.taxAmount);

    const journalId = await financeAccountingEngine.createBalancedEntry({
      workspaceId: params.workspaceId,
      description: `Invoice Created: ${params.description}`,
      sourceType: 'invoice',
      sourceId: params.invoiceId,
      createdBy: params.userId,
      lines: [
        { account_id: arAccount.id, debit_amount: totalAmount }, // Money owed to us
        { account_id: revenueAccount.id, credit_amount: params.subtotal }, // Business income
        { account_id: taxAccount.id, credit_amount: params.taxAmount } // Money owed to govt
      ]
    });

    try {
      await activityEventService.recordActivity({
        workspace_id: params.workspaceId,
        actor_id: params.userId,
        entity_type: 'invoice',
        entity_id: params.invoiceId,
        action_type: 'invoice_created',
        metadata: { totalAmount, journalId }
      });
    } catch (e) {
      console.error('Failed to log event', e);
    }

    return journalId;
  },

  /**
   * Records a payment against an invoice.
   * Debits Cash/Bank, Credits AR.
   */
  async recordPayment(params: {
    workspaceId: string;
    userId: string;
    paymentId: string;
    invoiceId: string;
    amount: number;
    description: string;
  }) {
    // Idempotency check
    const { data: existing } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('source_type', 'payment')
      .eq('source_id', params.paymentId)
      .maybeSingle();
      
    if (existing) {
      // Logging removed for production
      return existing.id;
    }

    const accountMap = await financeSetupService.ensureDefaultAccounts(params.workspaceId);
    
    const bankAccount = accountMap['Company Bank'];
    const arAccount = accountMap['Accounts Receivable'];

    if (!bankAccount || !arAccount) throw new Error('Missing default accounts');

    const journalId = await financeAccountingEngine.createBalancedEntry({
      workspaceId: params.workspaceId,
      description: `Payment Received: ${params.description}`,
      sourceType: 'payment',
      sourceId: params.paymentId,
      createdBy: params.userId,
      lines: [
        { account_id: bankAccount.id, debit_amount: params.amount }, // Cash goes up
        { account_id: arAccount.id, credit_amount: params.amount } // Debt goes down
      ]
    });

    try {
      await activityEventService.recordActivity({
        workspace_id: params.workspaceId,
        actor_id: params.userId,
        entity_type: 'payment',
        entity_id: params.paymentId,
        action_type: 'payment_received',
        metadata: { amount: params.amount, invoiceId: params.invoiceId, journalId }
      });
    } catch (e) {
      console.error('Failed to log event', e);
    }

    return journalId;
  },

  /**
   * Records a general expense.
   * Debits Expense, Credits Cash/Bank.
   */
  async recordExpense(params: {
    workspaceId: string;
    userId: string;
    expenseId: string;
    amount: number;
    description: string;
    expenseCategory?: string; // 'Salary', 'Rent', 'Software', 'General'
  }) {
    // Idempotency check
    const { data: existing } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('source_type', 'expense')
      .eq('source_id', params.expenseId)
      .maybeSingle();
      
    if (existing) {
      // Logging removed for production
      return existing.id;
    }

    const accountMap = await financeSetupService.ensureDefaultAccounts(params.workspaceId);
    
    const bankAccount = accountMap['Company Bank'];
    const expenseAccountName = params.expenseCategory ? `${params.expenseCategory} Expense` : 'General Expense';
    const expenseAccount = accountMap[expenseAccountName] || accountMap['General Expense'];

    if (!bankAccount || !expenseAccount) throw new Error('Missing default accounts');

    const journalId = await financeAccountingEngine.createBalancedEntry({
      workspaceId: params.workspaceId,
      description: `Expense Recorded: ${params.description}`,
      sourceType: 'expense',
      sourceId: params.expenseId,
      createdBy: params.userId,
      lines: [
        { account_id: expenseAccount.id, debit_amount: params.amount }, // Expense recognized
        { account_id: bankAccount.id, credit_amount: params.amount } // Cash reduced
      ]
    });

    try {
      await activityEventService.recordActivity({
        workspace_id: params.workspaceId,
        actor_id: params.userId,
        entity_type: 'expense',
        entity_id: params.expenseId,
        action_type: 'expense_created',
        metadata: { amount: params.amount, category: expenseAccountName, journalId }
      });
    } catch (e) {
      console.error('Failed to log event', e);
    }

    return journalId;
  }
};

