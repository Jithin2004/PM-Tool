import { trackSupabaseOperation } from '../core/observability/telemetry';
import { supabase } from '../lib/supabase';
import type { PostgrestError } from '@supabase/supabase-js';

export interface CompanyBillingProfile {
  id: string;
  workspace_id: string;
  legal_name: string;
  gstin: string | null;
  pan: string | null;
  billing_address: string | null;
  state: string;
  country: string;
  bank_details: any;
  invoice_prefix: string;
}

export interface Client {
  id: string;
  workspace_id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  billing_address: string;
  status: 'active' | 'inactive';
  gstin?: string;
  billing_state?: string;
  billing_country?: string;
  tax_type?: 'registered' | 'unregistered';
  currency?: string;
  default_currency?: string;
  advance_balance?: number;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  rate: number;
  tax_percentage: number;
  amount: number;
}

export interface Invoice {
  id: string;
  workspace_id: string;
  client_id: string;
  project_id: string | null;
  invoice_number: string;
  amount: number; // Legacy total amount
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  grand_total: number;
  balance_due: number;
  billing_state_snapshot: string | null;
  currency: string; // Base currency (Legacy)
  company_base_currency?: string;
  base_amount?: number;
  invoice_currency?: string;
  invoice_amount?: number;
  converted_amount?: number; // Legacy
  exchange_rate?: number;
  exchange_rate_locked?: boolean;
  exchange_locked_at?: string;
  exchange_override_reason?: string;
  conversion_date?: string;
  status: 'draft' | 'sent' | 'issued' | 'paid' | 'overdue' | 'cancelled' | 'partial' | 'partially_paid';
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  created_at: string;
  line_items?: InvoiceLineItem[];
  task_id?: string | null;
  billing_type?: string;
  payment_terms?: string;
  milestone_id?: string | null;
}

export interface BillingMilestone {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  amount: number;
  status: 'pending' | 'invoiced' | 'paid';
  invoice_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientCredit {
  id: string;
  workspace_id: string;
  client_id: string;
  amount: number;
  source_payment_id?: string | null;
  status: 'active' | 'used';
  created_at: string;
  updated_at: string;
}

export interface InvoiceAuditLog {
  id: string;
  workspace_id: string;
  invoice_id?: string | null;
  action: string;
  performed_by: string;
  reason?: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  method: string;
  reference_number: string;
  client_id?: string;
  advance_payment?: boolean;
}

export interface Expense {
  id: string;
  workspace_id: string;
  category: 'salary' | 'software' | 'infrastructure' | 'office' | 'misc';
  amount: number;
  date: string;
  description: string;
  project_id?: string | null;
  task_id?: string | null;
  billable?: boolean;
  reimbursed_invoice_id?: string | null;
}

export interface FinancialPeriod {
  id: string;
  workspace_id: string;
  month: number;
  year: number;
  status: 'open' | 'closed';
  closed_by?: string;
  closed_at?: string;
}

export interface FinancialSnapshot {
  id: string;
  workspace_id: string;
  period_id: string;
  total_revenue: number;
  total_salary_expense: number;
  total_other_expenses: number;
  net_profit: number;
  employee_count: number;
  client_count: number;
  project_count: number;
}

export interface FinancialAdjustment {
  id: string;
  period_id: string;
  type: 'revenue' | 'salary' | 'expense';
  amount: number;
  reason: string;
  created_by: string | null;
  created_at: string;
}

export interface AdvanceApplication {
  id: string;
  workspace_id: string;
  client_credit_id: string;
  invoice_id: string;
  amount_applied: number;
  applied_by: string;
  applied_at: string;
  notes?: string;
}

export interface CreditNote {
  id: string;
  workspace_id: string;
  client_id: string;
  invoice_id: string | null;
  credit_note_number: string;
  amount: number;
  reason: string;
  issue_date: string;
  created_by: string;
  created_at: string;
}

export async function fetchFinanceData(workspaceId: string) {
  const [companyProfile, clients, invoices, payments, expenses, salaries, periods, snapshots, adjustments, billingMilestones, clientCredits, advanceApplications, creditNotes] = await Promise.all([
    supabase.from('company_billing_profile').select('*').limit(50).eq('workspace_id', workspaceId).maybeSingle(),
    supabase.from('clients').select('*').limit(50).eq('workspace_id', workspaceId).is('deleted_at', null),
    supabase.from('invoices').select('*, invoice_line_items(*)').eq('workspace_id', workspaceId).is('deleted_at', null),
    supabase.from('payments').select('*').limit(50).eq('workspace_id', workspaceId),
    supabase.from('expenses').select('*').limit(50).eq('workspace_id', workspaceId),
    supabase.from('salaries').select('base_salary').eq('workspace_id', workspaceId),
    supabase.from('financial_periods').select('*').limit(50).eq('workspace_id', workspaceId),
    supabase.from('financial_snapshots').select('*').limit(50).eq('workspace_id', workspaceId),
    supabase.from('financial_adjustments').select('*, financial_periods!inner(workspace_id)').eq('financial_periods.workspace_id', workspaceId),
    supabase.from('billing_milestones').select('*').limit(50).eq('workspace_id', workspaceId),
    supabase.from('client_credits').select('*').limit(50).eq('workspace_id', workspaceId),
    supabase.from('advance_applications').select('*').limit(50).eq('workspace_id', workspaceId),
    supabase.from('credit_notes').select('*').limit(50).eq('workspace_id', workspaceId)
  ]);

  if (companyProfile.error && companyProfile.error.code !== 'PGRST116') throw companyProfile.error;
  if (clients.error) throw clients.error;
  if (invoices.error) throw invoices.error;
  if (payments.error) throw payments.error;
  if (expenses.error) throw expenses.error;
  if (salaries.error) throw salaries.error;
  if (periods.error && periods.error.code !== '42P01') throw periods.error;
  if (snapshots.error && snapshots.error.code !== '42P01') throw snapshots.error;
  if (adjustments.error && adjustments.error.code !== '42P01') throw adjustments.error;

  if (billingMilestones.error && billingMilestones.error.code !== '42P01') throw billingMilestones.error;
  if (clientCredits.error && clientCredits.error.code !== '42P01') throw clientCredits.error;
  if (advanceApplications.error && advanceApplications.error.code !== '42P01') throw advanceApplications.error;
  if (creditNotes.error && creditNotes.error.code !== '42P01') throw creditNotes.error;

  return {
    companyProfile: companyProfile.data as CompanyBillingProfile | null,
    clients: clients.data as Client[],
    invoices: invoices.data as Invoice[],
    payments: payments.data as Payment[],
    expenses: expenses.data as Expense[],
    salaries: salaries.data as { base_salary: number }[],
    periods: (periods.data || []) as FinancialPeriod[],
    snapshots: (snapshots.data || []) as FinancialSnapshot[],
    adjustments: (adjustments.data || []) as FinancialAdjustment[],
    billingMilestones: (billingMilestones.data || []) as BillingMilestone[],
    clientCredits: (clientCredits.data || []) as ClientCredit[],
    advanceApplications: (advanceApplications.data || []) as AdvanceApplication[],
    creditNotes: (creditNotes.data || []) as CreditNote[],
  };
}

export const createClient = async (workspaceId: string, client: Partial<Client>): Promise<Client> => {
  const { data, error } = await trackSupabaseOperation('supabase_from_clients', () => supabase.from('clients').insert([{ ...client, workspace_id: workspaceId }]).select().single());
  if (error) throw error;
  return data as Client;
};

export const fetchClients = async (workspaceId: string): Promise<Client[]> => {
  const { data, error } = await trackSupabaseOperation('supabase_from_clients', () => supabase.from('clients').select('*').limit(50).eq('workspace_id', workspaceId).is('deleted_at', null));
  if (error) throw error;
  return data as Client[];
};

export const deleteClient = async (clientId: string, workspaceId: string, performedBy: string): Promise<void> => {
  const { error } = await trackSupabaseOperation('supabase_from_clients', () => supabase.from('clients').update({ deleted_at: new Date().toISOString(), deleted_by: performedBy }).eq('id', clientId).eq('workspace_id', workspaceId));
  if (error) throw error;
};

export const restoreClient = async (clientId: string, workspaceId: string): Promise<void> => {
  const { error } = await trackSupabaseOperation('supabase_from_clients', () => supabase.from('clients').update({ deleted_at: null, deleted_by: null }).eq('id', clientId).eq('workspace_id', workspaceId));
  if (error) throw error;
};

export async function generateInvoice(workspaceId: string, invoice: Partial<Invoice>, lineItems: Partial<InvoiceLineItem>[], prefix: string = 'RPM') {
  // 1. Generate Invoice Number via RPC
  const { data: invNumber, error: rpcError } = await trackSupabaseOperation('supabase_rpc_generate_invoice_number', () => supabase.rpc('generate_invoice_number', {
    p_workspace_id: workspaceId,
    p_prefix: prefix
  }));
  if (rpcError) throw rpcError;
  
  if (invoice.exchange_rate_locked) {
    invoice.exchange_locked_at = new Date().toISOString();
  }

  // 2. Insert Invoice
  const { data: newInvoice, error: invError } = await trackSupabaseOperation('supabase_from_invoices', () => supabase.from('invoices').insert([{ 
    ...invoice, 
    workspace_id: workspaceId,
    invoice_number: invNumber 
  }]).select().single());
  
  if (invError) throw invError;

  // 3. Insert Line Items
  if (lineItems && lineItems.length > 0) {
    const itemsToInsert = lineItems.map(item => ({ ...item, invoice_id: newInvoice.id }));
    const { error: lineItemsError } = await trackSupabaseOperation('supabase_from_invoice_line_items', () => supabase.from('invoice_line_items').insert(itemsToInsert));
    if (lineItemsError) {
      console.error("Failed to insert line items", lineItemsError);
    }
  }

  return newInvoice;
}

export async function auditExchangeRateOverride(invoiceId: string, workspaceId: string, oldRate: number | null, newRate: number, changedBy: string, reason: string) {
  const { error } = await trackSupabaseOperation('supabase_from_exchange_rate_audits', () => supabase.from('exchange_rate_audits').insert([{
    invoice_id: invoiceId,
    workspace_id: workspaceId,
    old_rate: oldRate,
    new_rate: newRate,
    changed_by: changedBy,
    reason: reason
  }]));
  if (error) {
    console.error('Failed to log exchange rate audit:', error);
  }
}

export async function logPayment(workspaceId: string, payment: any) {
  const { data, error } = await trackSupabaseOperation('supabase_from_payments', () => supabase.from('payments').insert([payment]).select().single());
  if (error) throw error;
  return data;
}

export async function recordPayment(payment: Partial<Payment>) {
  const { data, error } = await trackSupabaseOperation('supabase_from_payments', () => supabase.from('payments').insert([payment]).select().single());
  if (error) throw error;
  return data;
}

export async function createExpense(workspaceId: string, expense: Partial<Expense>) {
  const { data, error } = await trackSupabaseOperation('supabase_from_expenses', () => supabase.from('expenses').insert([{ ...expense, workspace_id: workspaceId }]).select().single());
  if (error) throw error;
  return data;
}

export async function closeFinancialPeriod(workspaceId: string, month: number, year: number, userId: string) {
  const { data, error } = await trackSupabaseOperation('supabase_rpc_close_financial_period', () => supabase.rpc('close_financial_period', {
    p_workspace_id: workspaceId,
    p_month: month,
    p_year: year,
    p_user_id: userId
  }));
  if (error) throw error;
  return data;
}

export async function createFinancialAdjustment(adjustment: Partial<FinancialAdjustment>) {
  const { data, error } = await trackSupabaseOperation('supabase_from_financial_adjustments', () => supabase.from('financial_adjustments').insert([adjustment]).select().single());
  if (error) throw error;
  return data;
}

export async function checkPeriodClosed(workspaceId: string, dateStr: string): Promise<boolean> {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const { data } = await trackSupabaseOperation('supabase_from_financial_periods', () => supabase.from('financial_periods')
    .select('status')
    .eq('workspace_id', workspaceId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle());
  return data?.status === 'closed';
}

export async function cancelInvoice(invoice: Invoice, performedBy: string, reason: string) {
  if (invoice.status === 'paid') {
    throw new Error('Cannot cancel a paid invoice. Please issue a credit note instead.');
  }
  if (invoice.status !== 'issued' && invoice.status !== 'sent') {
    throw new Error('Only issued or sent invoices can be cancelled.');
  }
  if (await checkPeriodClosed(invoice.workspace_id, invoice.issue_date)) {
    throw new Error('Cannot cancel invoice in a closed financial period.');
  }

  const { error } = await trackSupabaseOperation('supabase_from_invoices', () => supabase.from('invoices').update({ status: 'cancelled' }).eq('id', invoice.id));
  if (error) throw error;

  await trackSupabaseOperation('supabase_from_invoice_audit_logs', () => supabase.from('invoice_audit_logs').insert([{
    workspace_id: invoice.workspace_id,
    invoice_id: invoice.id,
    action: 'cancelled',
    performed_by: performedBy,
    reason: reason,
    old_value: { status: invoice.status },
    new_value: { status: 'cancelled' }
  }]));
}

export async function createCreditNote(workspaceId: string, creditNote: Partial<CreditNote>) {
  if (creditNote.issue_date && await checkPeriodClosed(workspaceId, creditNote.issue_date)) {
    throw new Error('Cannot issue credit note in a closed financial period. Use financial adjustment.');
  }

  // 1. Generate Credit Note Number via RPC or simple logic (assuming prefix CN-)
  const { data: countData } = await trackSupabaseOperation('supabase_from_credit_notes', () => supabase.from('credit_notes').select('id', { count: 'exact' }).eq('workspace_id', workspaceId));
  const nextNum = (countData?.length || 0) + 1;
  const cnNumber = `CN-${String(nextNum).padStart(4, '0')}`;

  const { data, error } = await trackSupabaseOperation('supabase_from_credit_notes', () => supabase.from('credit_notes').insert([{ 
    ...creditNote, 
    workspace_id: workspaceId,
    credit_note_number: cnNumber
  }]).select().single());
  
  if (error) throw error;
  
  await trackSupabaseOperation('supabase_from_invoice_audit_logs', () => supabase.from('invoice_audit_logs').insert([{
    workspace_id: workspaceId,
    invoice_id: creditNote.invoice_id,
    action: 'credit_note_issued',
    performed_by: creditNote.created_by,
    reason: `Credit note ${cnNumber} issued for ${creditNote.amount}`
  }]));

  return data;
}

export async function applyAdvanceToInvoice(workspaceId: string, clientId: string, invoiceId: string, amount: number, performedBy: string) {
  // Get active client credits
  const { data: credits } = await trackSupabaseOperation('supabase_from_client_credits', () => supabase.from('client_credits').select('*').limit(50).eq('client_id', clientId).eq('status', 'active'));
  if (!credits || credits.length === 0) throw new Error("No active advances found.");

  // For simplicity, we just log it against the first credit or an aggregate.
  // We need a credit_id for advance_applications.
  const creditId = credits[0].id;

  const { error: appError } = await trackSupabaseOperation('supabase_from_advance_applications', () => supabase.from('advance_applications').insert([{
    workspace_id: workspaceId,
    client_credit_id: creditId,
    invoice_id: invoiceId,
    amount_applied: amount,
    applied_by: performedBy,
    notes: 'Applied from advance balance'
  }]));
  if (appError) throw appError;

  // Deduct from client advance_balance via RPC or simple update
  const { data: client } = await trackSupabaseOperation('supabase_from_clients', () => supabase.from('clients').select('advance_balance').eq('id', clientId).single());
  const currentAdvance = client?.advance_balance || 0;
  if (currentAdvance < amount) throw new Error("Insufficient advance balance.");

  await trackSupabaseOperation('supabase_from_clients', () => supabase.from('clients').update({ advance_balance: currentAdvance - amount }).eq('id', clientId));

  // Record it as a payment
  await recordPayment({
    invoice_id: invoiceId,
    amount: amount,
    payment_date: new Date().toISOString().split('T')[0],
    method: 'Advance Application',
    reference_number: `ADV-${creditId.substring(0,6)}`,
    client_id: clientId,
    advance_payment: false
  });

  await trackSupabaseOperation('supabase_from_invoice_audit_logs', () => supabase.from('invoice_audit_logs').insert([{
    workspace_id: workspaceId,
    invoice_id: invoiceId,
    action: 'advance_applied',
    performed_by: performedBy,
    reason: `Applied advance of ${amount}`
  }]));
}

export const upsertCompanyBillingProfile = async (profile: Partial<CompanyBillingProfile>) => {
  const { data, error } = await trackSupabaseOperation('supabase_from_company_billing_profile', () => supabase.from('company_billing_profile').upsert(profile, { onConflict: 'workspace_id' }).select().single());
  if (error) throw error;
  return data as CompanyBillingProfile;
};

export async function deleteInvoice(invoiceId: string, workspaceId: string, performedBy: string, reason: string) {
  // We can only delete draft invoices
  const { data: invoice } = await trackSupabaseOperation('supabase_from_invoices', () => supabase.from('invoices').select('status').eq('id', invoiceId).single());
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status !== 'draft') {
    throw new Error("Only draft invoices can be completely deleted. Please cancel issued invoices instead.");
  }

  const { error } = await trackSupabaseOperation('supabase_from_invoices', () => supabase.from('invoices').update({ deleted_at: new Date().toISOString(), deleted_by: performedBy }).eq('id', invoiceId));
  if (error) throw error;

  await trackSupabaseOperation('supabase_from_invoice_audit_logs', () => supabase.from('invoice_audit_logs').insert([{
    workspace_id: workspaceId,
    invoice_id: invoiceId,
    action: 'deleted',
    performed_by: performedBy,
    reason: reason,
    old_value: { status: invoice.status },
    new_value: { status: 'deleted_soft' }
  }]));

  await trackSupabaseOperation('supabase_from_activity_logs', () => supabase.from('activity_logs').insert([{
    workspace_id: workspaceId,
    actor_id: performedBy,
    action: 'deleted_invoice',
    entity_type: 'invoice',
    entity_id: invoiceId,
    metadata: { reason }
  }]));
}

export async function restoreInvoice(invoiceId: string, workspaceId: string, performedBy: string) {
  const { error } = await trackSupabaseOperation('supabase_from_invoices', () => supabase.from('invoices').update({ deleted_at: null, deleted_by: null }).eq('id', invoiceId).eq('workspace_id', workspaceId));
  if (error) throw error;

  await trackSupabaseOperation('supabase_from_invoice_audit_logs', () => supabase.from('invoice_audit_logs').insert([{
    workspace_id: workspaceId,
    invoice_id: invoiceId,
    action: 'restored',
    performed_by: performedBy,
    reason: 'Manual restore',
    old_value: { status: 'deleted_soft' },
    new_value: { status: 'draft' }
  }]));
}
