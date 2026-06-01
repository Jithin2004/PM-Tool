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

export async function fetchFinanceData(workspaceId: string) {
  const [clients, invoices, payments, expenses, salaries] = await Promise.all([
    supabase.from('clients').select('*').eq('workspace_id', workspaceId),
    supabase.from('invoices').select('*').eq('workspace_id', workspaceId),
    supabase.from('payments').select('*, invoices!inner(workspace_id)').eq('invoices.workspace_id', workspaceId),
    supabase.from('expenses').select('*').eq('workspace_id', workspaceId),
    supabase.from('salaries').select('base_salary').eq('workspace_id', workspaceId),
  ]);

  if (clients.error) throw clients.error;
  if (invoices.error) throw invoices.error;
  if (payments.error) throw payments.error;
  if (expenses.error) throw expenses.error;
  if (salaries.error) throw salaries.error;

  return {
    clients: clients.data as Client[],
    invoices: invoices.data as Invoice[],
    payments: payments.data as Payment[],
    expenses: expenses.data as Expense[],
    salaries: salaries.data as { base_salary: number }[],
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
