import React, { useState } from 'react';
import { X, Plus, Trash2, Save, Edit2, Download } from 'lucide-react';
import { Client, Invoice, Payment } from '../../services/financeService';
import { generateClientStatementPDF } from '../../services/invoicePdfService';
import { supabase } from '../../lib/supabase';
import { Project } from '../../core/types/project';
import { showAlert, showConfirm } from '../../components/common/Dialogs';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ManageClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  clients: Client[];
  onSuccess: () => void;
}

export function ManageClientsModal({ isOpen, onClose, workspaceId, clients, onSuccess }: ManageClientsModalProps) {
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEscapeKey(isOpen, onClose);

  React.useEffect(() => {
    if (isOpen && workspaceId) {
      Promise.all([
        supabase.from('projects').select('*').eq('workspace_id', workspaceId),
        supabase.from('invoices').select('*').eq('workspace_id', workspaceId),
        supabase.from('payments').select('*').eq('workspace_id', workspaceId),
      ]).then(([p, i, pay]) => {
        if (p.data) setProjects(p.data as Project[]);
        if (i.data) setInvoices(i.data as Invoice[]);
        if (pay.data) setPayments(pay.data as Payment[]);
      });
    }
  }, [isOpen, workspaceId]);

  const clientProjects = projects.filter(p => p.client_id === editingClient?.id);
  const totalContractValue = clientProjects.reduce((sum, p) => sum + (p.contract_value || 0), 0);
  
  const clientInvoices = invoices.filter(i => i.client_id === editingClient?.id);
  const totalInvoiced = clientInvoices.reduce((sum, i) => sum + (i.grand_total || i.amount || 0), 0);
  
  const clientPayments = payments.filter(p => p.client_id === editingClient?.id || clientInvoices.some(i => i.id === p.invoice_id));
  const totalPaid = clientPayments.reduce((sum, p) => sum + p.amount, 0);
  
  const outstanding = Math.max(0, totalInvoiced - totalPaid);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!editingClient?.company_name) return;
    setIsSubmitting(true);
    try {
      if (editingClient.id) {
        await supabase.from('clients').update(editingClient).eq('id', editingClient.id);
      } else {
        await supabase.from('clients').insert([{ ...editingClient, workspace_id: workspaceId }]);
      }
      onSuccess();
      setEditingClient(null);
    } catch (e: any) {
      showAlert(e.message || 'Failed to save client');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadStatement = async () => {
    if (!editingClient?.id) return;
    try {
      const { data: comp } = await supabase.from('company_billing_profile').select('*').eq('workspace_id', workspaceId).single();
      if (!comp) return showAlert("Company billing profile not set up.");
      
      const { data: cns } = await supabase.from('credit_notes').select('*').eq('client_id', editingClient.id);
      const { data: advances } = await supabase.from('client_credits').select('*').eq('client_id', editingClient.id);
      
      
      
      await generateClientStatementPDF(
        comp as any,
        editingClient as Client,
        clientInvoices,
        clientPayments,
        cns || [],
        advances || []
      );
    } catch (e: any) {
      showAlert("Failed to generate statement: " + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('Delete this client?')) return;
    try {
      await supabase.from('clients').delete().eq('id', id);
      onSuccess();
    } catch (e: any) {
      showAlert(e.message || 'Failed to delete client');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-premium">
      <div className="modal-premium border border-[var(--border-soft)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col font-geist overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-[var(--border-soft)]">
          <h2 className="text-xl font-semibold text-[var(--pm-text)]">Manage Clients</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--pm-surface)]/5 text-text-quaternary hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Client List */}
          <div className="w-1/2 border-r border-[var(--border-soft)] flex flex-col">
            <div className="p-4 border-b border-[var(--border-soft)] bg-[var(--pm-surface-lowest)]/30">
              <button
                onClick={() => setEditingClient({ company_name: '', currency: 'INR', tax_type: 'unregistered' })}
                className="btn-premium-primary w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              >
                <Plus className="w-4 h-4" /> Add New Client
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 scrollbar-premium space-y-2">
              {clients.map(client => (
                <div key={client.id} className="p-4 rounded-xl border border-[var(--border-soft)] bg-[var(--pm-surface-lowest)]/10 hover:bg-[var(--pm-surface-hover)] flex justify-between items-center transition-all">
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--pm-text)]">{client.company_name}</h4>
                    <p className="text-xs text-[var(--pm-text-tertiary)]">{client.email || 'No email'} | {client.currency || 'INR'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingClient(client)} className="p-1.5 text-accent-primary hover:bg-[var(--pm-surface-hover)] rounded-md transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(client.id)} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="w-1/2 flex flex-col bg-[var(--pm-surface-lowest)]/10">
            {editingClient ? (
              <div className="p-6 flex-1 overflow-y-auto space-y-4 scrollbar-premium">
                <h3 className="text-base font-bold uppercase tracking-wider text-[var(--pm-text)] mb-4">{editingClient.id ? 'Edit Client Details' : 'Register New Client'}</h3>
                
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--pm-text-secondary)]">Company Name</label>
                  <input type="text" value={editingClient.company_name || ''} onChange={e => setEditingClient({...editingClient, company_name: e.target.value})} className="w-full input-premium h-11 px-4 text-sm outline-none" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--pm-text-secondary)]">Email</label>
                    <input type="email" value={editingClient.email || ''} onChange={e => setEditingClient({...editingClient, email: e.target.value})} className="w-full input-premium h-11 px-4 text-sm outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--pm-text-secondary)]">Phone</label>
                    <input type="text" value={editingClient.phone || ''} onChange={e => setEditingClient({...editingClient, phone: e.target.value})} className="w-full input-premium h-11 px-4 text-sm outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--pm-text-secondary)]">Billing Currency</label>
                    <select value={editingClient.currency || 'INR'} onChange={e => setEditingClient({...editingClient, currency: e.target.value})} className="w-full input-premium h-11 px-4 text-sm outline-none cursor-pointer">
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="AUD">AUD (A$)</option>
                      <option value="CAD">CAD (C$)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--pm-text-secondary)]">GST / Tax ID</label>
                    <input type="text" value={editingClient.gstin || ''} onChange={e => setEditingClient({...editingClient, gstin: e.target.value})} className="w-full input-premium h-11 px-4 text-sm outline-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--pm-text-secondary)]">Billing Address</label>
                  <textarea value={editingClient.billing_address || ''} onChange={e => setEditingClient({...editingClient, billing_address: e.target.value})} className="w-full input-premium p-4 text-sm outline-none resize-none h-20" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--pm-text-secondary)]">State</label>
                    <input type="text" value={editingClient.billing_state || ''} onChange={e => setEditingClient({...editingClient, billing_state: e.target.value})} className="w-full input-premium h-11 px-4 text-sm outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--pm-text-secondary)]">Country</label>
                    <input type="text" value={editingClient.billing_country || 'India'} onChange={e => setEditingClient({...editingClient, billing_country: e.target.value})} className="w-full input-premium h-11 px-4 text-sm outline-none" />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-[var(--border-soft)]">
                  <button onClick={() => setEditingClient(null)} className="btn-premium-secondary px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all">Cancel</button>
                  <button onClick={handleSave} disabled={isSubmitting} className="btn-premium-primary px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2">
                    <Save className="w-4 h-4" /> Save
                  </button>
                </div>

                {editingClient.id && (
                  <div className="mt-8 pt-6 border-t border-[var(--border-soft)] space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--pm-text)]">Client Finance Ledger</h4>
                      <button onClick={handleDownloadStatement} className="btn-premium-secondary px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-all">
                        <Download className="w-3.5 h-3.5" /> Statement
                      </button>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="p-4 bg-[var(--pm-surface)] border border-[var(--border-soft)] rounded-xl">
                        <div className="text-[9px] uppercase font-mono text-[var(--pm-text-tertiary)] mb-1">Total Projects</div>
                        <div className="text-lg font-bold text-[var(--pm-text)]">{clientProjects.length}</div>
                      </div>
                      <div className="p-4 bg-[var(--pm-surface)] border border-[var(--border-soft)] rounded-xl">
                        <div className="text-[9px] uppercase font-mono text-[var(--pm-text-tertiary)] mb-1">Contract Value</div>
                        <div className="text-lg font-bold text-[var(--pm-text)]">{editingClient.currency || 'INR'} {totalContractValue.toLocaleString()}</div>
                      </div>
                      <div className="p-4 bg-[var(--pm-surface)] border border-[var(--border-soft)] rounded-xl">
                        <div className="text-[9px] uppercase font-mono text-[var(--pm-text-tertiary)] mb-1">Total Invoiced</div>
                        <div className="text-lg font-bold text-[var(--pm-text)]">{editingClient.currency || 'INR'} {totalInvoiced.toLocaleString()}</div>
                      </div>
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <div className="text-[9px] uppercase font-mono text-emerald-400 mb-1">Total Paid</div>
                        <div className="text-lg font-bold text-emerald-400">{editingClient.currency || 'INR'} {totalPaid.toLocaleString()}</div>
                      </div>
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <div className="text-[9px] uppercase font-mono text-amber-400 mb-1">Outstanding</div>
                        <div className="text-lg font-bold text-amber-400">{editingClient.currency || 'INR'} {outstanding.toLocaleString()}</div>
                      </div>
                      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                        <div className="text-[9px] uppercase font-mono text-blue-400 mb-1">Advance Balance</div>
                        <div className="text-lg font-bold text-blue-400">{editingClient.currency || 'INR'} {(editingClient.advance_balance || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[var(--pm-text-tertiary)] flex-col gap-2 p-6">
                <Plus className="w-12 h-12 opacity-20 text-accent-primary" />
                <p className="text-sm">Select a client to edit or register a new one.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
