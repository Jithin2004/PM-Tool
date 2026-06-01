import { supabase } from '../lib/supabase';
import type { PostgrestError } from '@supabase/supabase-js';

export interface Client {
  id: string;
  workspace_id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  billing_address: string;
  status: 'active' | 'inactive';
}

export interface Invoice {
  id: string;
  workspace_id: string;
  client_id: string;
  project_id: string | null;
  invoice_number: string;
  amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  method: string;
  reference_number: string;
}

export interface Expense {
  id: string;
  workspace_id: string;
  category: 'salary' | 'software' | 'infrastructure' | 'office' | 'misc';
  amount: number;
  date: string;
  description: string;
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

export async function fetchFinanceData(workspaceId: string) {
  const [clients, invoices, payments, expenses, salaries, periods, snapshots, adjustments] = await Promise.all([
    supabase.from('clients').select('*').eq('workspace_id', workspaceId),
    supabase.from('invoices').select('*').eq('workspace_id', workspaceId),
    supabase.from('payments').select('*, invoices!inner(workspace_id)').eq('invoices.workspace_id', workspaceId),
    supabase.from('expenses').select('*').eq('workspace_id', workspaceId),
    supabase.from('salaries').select('base_salary').eq('workspace_id', workspaceId),
    supabase.from('financial_periods').select('*').eq('workspace_id', workspaceId),
    supabase.from('financial_snapshots').select('*').eq('workspace_id', workspaceId),
    supabase.from('financial_adjustments').select('*, financial_periods!inner(workspace_id)').eq('financial_periods.workspace_id', workspaceId)
  ]);

  if (clients.error) throw clients.error;
  if (invoices.error) throw invoices.error;
  if (payments.error) throw payments.error;
  if (expenses.error) throw expenses.error;
  if (salaries.error) throw salaries.error;
  if (periods.error && periods.error.code !== '42P01') throw periods.error;
  if (snapshots.error && snapshots.error.code !== '42P01') throw snapshots.error;
  if (adjustments.error && adjustments.error.code !== '42P01') throw adjustments.error;

  return {
    clients: clients.data as Client[],
    invoices: invoices.data as Invoice[],
    payments: payments.data as Payment[],
    expenses: expenses.data as Expense[],
    salaries: salaries.data as { base_salary: number }[],
    periods: (periods.data || []) as FinancialPeriod[],
    snapshots: (snapshots.data || []) as FinancialSnapshot[],
    adjustments: (adjustments.data || []) as FinancialAdjustment[],
  };
}

export async function createClient(workspaceId: string, client: Partial<Client>) {
  const { data, error } = await supabase.from('clients').insert([{ ...client, workspace_id: workspaceId }]).select().single();
  if (error) throw error;
  return data;
}

export async function createInvoice(workspaceId: string, invoice: Partial<Invoice>) {
  const { data, error } = await supabase.from('invoices').insert([{ ...invoice, workspace_id: workspaceId }]).select().single();
  if (error) throw error;
  return data;
}

export async function recordPayment(payment: Partial<Payment>) {
  const { data, error } = await supabase.from('payments').insert([payment]).select().single();
  if (error) throw error;
  return data;
}

export async function createExpense(workspaceId: string, expense: Partial<Expense>) {
  const { data, error } = await supabase.from('expenses').insert([{ ...expense, workspace_id: workspaceId }]).select().single();
  if (error) throw error;
  return data;
}

export async function closeFinancialPeriod(workspaceId: string, month: number, year: number, userId: string) {
  const { data, error } = await supabase.rpc('close_financial_period', {
    p_workspace_id: workspaceId,
    p_month: month,
    p_year: year,
    p_user_id: userId
  });
  if (error) throw error;
  return data;
}

export async function createFinancialAdjustment(adjustment: Partial<FinancialAdjustment>) {
  const { data, error } = await supabase.from('financial_adjustments').insert([adjustment]).select().single();
  if (error) throw error;
  return data;
}
