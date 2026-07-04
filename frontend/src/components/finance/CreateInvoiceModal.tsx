import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Download } from 'lucide-react';
import { Client, Invoice, InvoiceLineItem, generateInvoice, CompanyBillingProfile, auditExchangeRateOverride } from '../../services/financeService';
import { generateInvoicePDF } from '../../services/invoicePdfService';
import { fetchDocumentTemplates, DocumentTemplate } from '../../services/documentTemplateService';
import { documentGenerator } from '../../services/documentGeneratorService';
import { showConfirm, showAlert } from '../common/Dialogs';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { hasCapability } from '../../core/auth/permissions';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  clients: Client[];
  companyProfile: CompanyBillingProfile | null;
  onSuccess: () => void;
  prefillProject?: any;
  totalInvoicedForProject?: number;
  prefillLineItems?: Partial<InvoiceLineItem>[];
  prefillBillingType?: string;
}

export function CreateInvoiceModal({ isOpen, onClose, workspaceId, clients, companyProfile, onSuccess, prefillProject, totalInvoicedForProject, prefillLineItems, prefillBillingType }: CreateInvoiceModalProps) {
  useEscapeKey(isOpen, onClose);
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const currentUserIsSuperAdmin = hasCapability(profile, 'audit.security');
  const baseCurrency = workspace?.metadata?.baseCurrency || 'INR';
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [billingType, setBillingType] = useState(prefillBillingType || 'Final Settlement');
  const [paymentTerms, setPaymentTerms] = useState('Net 15');
  const [overrideOverbill, setOverrideOverbill] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [exchangeOverrideReason, setExchangeOverrideReason] = useState('');
  const navigate = (path: string) => window.location.href = path;
  const [invoiceCurrency, setInvoiceCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(1);

  useEffect(() => {
    if (invoiceCurrency === baseCurrency) {
      setExchangeRate(1);
    }
  }, [invoiceCurrency, baseCurrency]);

  const [lineItems, setLineItems] = useState<Partial<InvoiceLineItem>[]>(prefillLineItems || [
    { description: '', quantity: 1, unit_price: 0, tax_percentage: 18, total: 0 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default');

  useEffect(() => {
    if (isOpen) {
      if (prefillProject && prefillProject.client_id) {
        setSelectedClient(prefillProject.client_id);
      }
      if (prefillLineItems) {
        setLineItems(prefillLineItems);
      }
      if (prefillBillingType) {
        setBillingType(prefillBillingType);
      }
      fetchDocumentTemplates(workspaceId).then(data => {
        const invoiceTemplates = data.filter(t => t.type === 'invoice');
        setTemplates(invoiceTemplates);
        const defaultTemplate = invoiceTemplates.find(t => t.is_default);
        if (defaultTemplate) {
          setSelectedTemplateId(defaultTemplate.id);
        }
      });
    }
  }, [isOpen, workspaceId, prefillProject, prefillLineItems, prefillBillingType]);

  useEffect(() => {
    if (selectedClient && clients) {
      const client = clients.find(c => c.id === selectedClient);
      if (prefillProject?.billing_currency) {
        setInvoiceCurrency(prefillProject.billing_currency);
      } else if (client?.default_currency) {
        setInvoiceCurrency(client.default_currency);
      } else if (client?.currency) {
        setInvoiceCurrency(client.currency);
      }
    }
  }, [selectedClient, clients, prefillProject]);

  useEffect(() => {
    if (!isOpen) return;
    const issueDateObj = new Date(issueDate);
    if (paymentTerms === 'Due immediately') {
      setDueDate(issueDateObj.toISOString().split('T')[0]);
    } else if (paymentTerms === 'Net 7') {
      issueDateObj.setDate(issueDateObj.getDate() + 7);
      setDueDate(issueDateObj.toISOString().split('T')[0]);
    } else if (paymentTerms === 'Net 15') {
      issueDateObj.setDate(issueDateObj.getDate() + 15);
      setDueDate(issueDateObj.toISOString().split('T')[0]);
    } else if (paymentTerms === 'Net 30') {
      issueDateObj.setDate(issueDateObj.getDate() + 30);
      setDueDate(issueDateObj.toISOString().split('T')[0]);
    }
  }, [paymentTerms, issueDate, isOpen]);

  // Early return must be after ALL hooks are defined (Rules of Hooks)
  if (!isOpen) return null;

  const client = clients.find(c => c.id === selectedClient);
  const isInterState = companyProfile && client 
    ? companyProfile.state.toLowerCase().trim() !== (client.billing_state || '').toLowerCase().trim()
    : false;

  const handleLineItemChange = (index: number, field: keyof InvoiceLineItem, value: string | number) => {
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total = Number(newItems[index].quantity || 0) * Number(newItems[index].unit_price || 0);
    }
    
    setLineItems(newItems);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0, tax_percentage: 18, total: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  // Calculations
  const subtotal = lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const discount_amount = 0; // Simplified for now
  const taxable_amount = subtotal - discount_amount;
  
  let cgst_amount = 0;
  let sgst_amount = 0;
  let igst_amount = 0;

  lineItems.forEach(item => {
    const itemTax = (item.total || 0) * ((item.tax_percentage || 0) / 100);
    if (isInterState) {
      igst_amount += itemTax;
    } else {
      cgst_amount += itemTax / 2;
      sgst_amount += itemTax / 2;
    }
  });

  const total_tax = cgst_amount + sgst_amount + igst_amount;
  const grand_total = taxable_amount + total_tax;

  const isOverbilled = prefillProject && prefillProject.contract_value > 0 && ((totalInvoicedForProject || 0) + grand_total > prefillProject.contract_value);

  const handleSubmit = async () => {
    if (!companyProfile) {
      const gotoSettings = await showConfirm("Complete your company billing details before generating GST invoices.", {
        title: "Company Billing Profile Required",
        confirmText: "Configure Now",
        cancelText: "Cancel"
      });
      if (gotoSettings) {
        onClose();
        navigate('/control/settings');
      }
      return;
    }
    if (!selectedClient) {
      await showAlert("Please select a client.", { type: "warning" });
      return;
    }
    if (isOverbilled && !overrideOverbill) {
      await showAlert("This invoice exceeds the project contract value. Super Admin override is required to proceed.", { type: "warning" });
      return;
    }
    if (invoiceCurrency !== baseCurrency) {
      if (!exchangeRate || isNaN(exchangeRate) || exchangeRate <= 0) {
        await showAlert("Please enter a valid exchange rate greater than 0.", { type: "warning" });
        return;
      }
      if (exchangeRate !== 1 && !exchangeOverrideReason) {
        await showAlert("You must provide a reason for overriding the default exchange rate.", { type: "warning" });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const invoiceData: Partial<Invoice> = {
        client_id: selectedClient,
        amount: grand_total, // legacy field fallback
        subtotal,
        discount_amount,
        taxable_amount,
        cgst_amount,
        sgst_amount,
        igst_amount,
        total_tax,
        grand_total,
        balance_due: grand_total,
        billing_state_snapshot: client?.billing_state || null,
        currency: baseCurrency, // Base currency (Legacy)
        company_base_currency: baseCurrency,
        base_amount: grand_total * exchangeRate,
        invoice_currency: invoiceCurrency,
        invoice_amount: grand_total,
        exchange_rate: exchangeRate,
        exchange_rate_locked: true,
        exchange_override_reason: invoiceCurrency !== baseCurrency && exchangeRate !== 1 ? exchangeOverrideReason : undefined,
        converted_amount: grand_total * exchangeRate,
        conversion_date: new Date().toISOString(),
        status: 'sent',
        issue_date: issueDate,
        due_date: dueDate,
        billing_type: billingType,
        payment_terms: paymentTerms,
        project_id: prefillProject?.id || null,
      };

      const newInvoice = await generateInvoice(workspaceId, invoiceData, lineItems, companyProfile.invoice_prefix);
      
      if (exchangeRate !== 1 && exchangeOverrideReason) {
         // Audit the manual change (assuming previous rate was 1)
         await auditExchangeRateOverride((newInvoice as Invoice).id, workspaceId, 1, exchangeRate, 'system', exchangeOverrideReason);
      }

      if (selectedTemplateId === 'default') {
        // Auto-generate PDF using hardcoded default
        await generateInvoicePDF(companyProfile, client!, newInvoice as Invoice, lineItems as InvoiceLineItem[]);
      } else {
        // Auto-generate using custom template
        const template = templates.find(t => t.id === selectedTemplateId);
        if (template) {
          const templateData = {
            company_name: companyProfile.legal_name,
            client_name: client?.company_name || '',
            invoice_number: (newInvoice as Invoice).invoice_number,
            amount: grand_total,
            gst: total_tax,
            date: issueDate,
            signature: companyProfile.legal_name,
          };
          const blob = await documentGenerator(template, templateData);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${(newInvoice as Invoice).invoice_number.replace(/\//g, '_')}_Invoice.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
      
      onSuccess();
      onClose();
    } catch (err: any) {
      await showAlert(err.message || "Failed to generate invoice", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-premium">
      <div className="modal-premium border border-[var(--border-soft)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col font-geist">
        <div className="flex justify-between items-center p-6 border-b border-[var(--border-soft)]">
          <h2 className="text-xl font-semibold text-text-primary">Create GST Invoice</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--pm-surface)]/5 text-text-quaternary hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm text-text-secondary scrollbar-premium">
          {/* Client & Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5 md:col-span-1">
              <label className="font-medium text-text-primary">Client <span className="text-rose-500">*</span></label>
              <select 
                value={selectedClient} 
                onChange={e => setSelectedClient(e.target.value)}
                className="w-full input-premium h-11 px-4 text-sm outline-none cursor-pointer"
              >
                <option value="" disabled>Select a client...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name} {c.gstin ? `(GST: ${c.gstin})` : ''}</option>
                ))}
              </select>
              {client && (
                <div className="text-xs mt-2 text-text-tertiary">
                  State: {client.billing_state || 'Not set'} | Type: {isInterState ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Issue Date <span className="text-rose-500">*</span></label>
              <input 
                type="date" 
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                className="w-full input-premium h-11 px-4 text-sm outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Payment Terms <span className="text-rose-500">*</span></label>
              <select 
                value={paymentTerms} 
                onChange={e => setPaymentTerms(e.target.value)}
                className="w-full input-premium h-11 px-4 text-sm outline-none cursor-pointer"
              >
                <option value="Due immediately">Due immediately</option>
                <option value="Net 7">Net 7</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Due Date <span className="text-rose-500">*</span></label>
              <input 
                type="date" 
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                disabled={paymentTerms !== 'Custom'}
                className="w-full input-premium h-11 px-4 text-sm outline-none disabled:opacity-50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Billing Type <span className="text-rose-500">*</span></label>
              <select 
                value={billingType}
                onChange={e => setBillingType(e.target.value)}
                className="w-full input-premium h-11 px-4 text-sm outline-none cursor-pointer"
              >
                <option value="Advance Payment">Advance Payment</option>
                <option value="Milestone Payment">Milestone Payment</option>
                <option value="Task Billing">Task Billing</option>
                <option value="Expense Reimbursement">Expense Reimbursement</option>
                <option value="Final Settlement">Final Settlement</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Template <span className="text-[10px] normal-case opacity-60 ml-1">(Optional)</span></label>
              <select 
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
                className="w-full input-premium h-11 px-4 text-sm outline-none cursor-pointer"
              >
                <option value="default">System Default PDF</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} {t.is_default ? '(Default)' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="font-medium text-text-primary text-base">Line Items</label>
              <button onClick={addLineItem} className="text-accent-primary hover:text-emerald-400 font-medium flex items-center gap-1 text-sm">
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>
            
            <div className="border border-border/50 rounded-lg overflow-hidden bg-surface-3/10 backdrop-blur-md">
              <table className="w-full text-left whitespace-nowrap table-premium">
                <thead className="border-b border-border/50 text-xs text-text-tertiary uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 w-1/2">Description</th>
                    <th className="px-4 py-3 w-20">Qty</th>
                    <th className="px-4 py-3 w-32">Unit Price ({invoiceCurrency})</th>
                    <th className="px-4 py-3 w-24">Tax %</th>
                    <th className="px-4 py-3 w-32 text-right">Total ({invoiceCurrency})</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {lineItems.map((item, index) => (
                    <tr key={index}>
                      <td className="p-2">
                        <input type="text" value={item.description} onChange={e => handleLineItemChange(index, 'description', e.target.value)} placeholder="Item description" className="w-full bg-transparent border-none outline-none px-2 text-sm text-text-primary" />
                      </td>
                      <td className="p-2">
                        <input type="number" min="1" value={item.quantity} onChange={e => handleLineItemChange(index, 'quantity', Number(e.target.value))} className="w-full bg-transparent border-none outline-none px-2 text-sm text-text-primary" placeholder="Qty" />
                      </td>
                      <td className="p-2">
                        <input type="number" min="0" value={item.unit_price} onChange={e => handleLineItemChange(index, 'unit_price', Number(e.target.value))} className="w-full bg-transparent border-none outline-none px-2 text-sm text-text-primary" placeholder={`Price (${invoiceCurrency})`} />
                      </td>
                      <td className="p-2">
                        <select value={item.tax_percentage} onChange={e => handleLineItemChange(index, 'tax_percentage', Number(e.target.value))} className="w-full bg-transparent border-none outline-none px-2 text-sm text-text-primary">
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>
                      <td className="p-2 text-right font-mono text-sm text-text-primary pr-4">
                        {(item.total || 0).toFixed(2)}
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => removeLineItem(index)} className="text-text-tertiary hover:text-rose-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Calculation */}
          <div className="flex justify-end pt-4">
            <div className="w-72 space-y-3 font-mono text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Subtotal:</span>
                <span>{invoiceCurrency} {subtotal.toFixed(2)}</span>
              </div>
              
              {isInterState ? (
                <div className="flex justify-between text-text-secondary">
                  <span>IGST:</span>
                  <span>{invoiceCurrency} {igst_amount.toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-text-secondary">
                    <span>CGST:</span>
                    <span>{invoiceCurrency} {cgst_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>SGST:</span>
                    <span>{invoiceCurrency} {sgst_amount.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="border-t border-border/50 pt-3 flex justify-between font-bold text-lg text-text-primary">
                <span>Grand Total:</span>
                <span>{invoiceCurrency} {grand_total.toFixed(2)}</span>
              </div>
              
              <div className="border-t border-border/50 pt-4 mt-4">
                <h4 className="text-sm font-semibold mb-3">Client Currency Settings</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Invoice Currency</label>
                    <select 
                      value={invoiceCurrency}
                      onChange={e => setInvoiceCurrency(e.target.value)}
                      className="w-full input-premium p-2 text-xs outline-none cursor-pointer"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="AED">AED (د.إ)</option>
                    </select>
                  </div>
                  {invoiceCurrency !== baseCurrency && (
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Exchange Rate (1 {invoiceCurrency} = {baseCurrency} X)</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={exchangeRate}
                        onChange={e => setExchangeRate(Number(e.target.value))}
                        className="w-full input-premium p-2 text-xs outline-none"
                        required
                      />
                    </div>
                  )}
                </div>
                {invoiceCurrency !== baseCurrency && exchangeRate !== 1 && (
                  <div className="mb-3">
                    <label className="block text-xs text-text-secondary mb-1 flex items-center gap-1">
                      Exchange Rate Override Reason <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={exchangeOverrideReason} 
                      onChange={e => setExchangeOverrideReason(e.target.value)} 
                      placeholder="Required reason for audit..." 
                      className="w-full input-premium p-2 text-xs outline-none"
                    />
                  </div>
                )}
                {invoiceCurrency !== baseCurrency && (
                  <div className="flex flex-col gap-1.5 bg-accent-primary/10 border border-accent-primary/20 rounded p-3 text-xs mt-3">
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>Invoice Total:</span>
                      <span className="font-bold text-text-primary">{invoiceCurrency} {grand_total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-border/30 pt-1.5 mt-1.5">
                      <span>Accounting Value:</span>
                      <span className="font-bold text-accent-primary">{baseCurrency} {(grand_total * exchangeRate).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Overbilling Warning */}
          {isOverbilled && (
            <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-rose-500/20 rounded-lg text-rose-500">
                  <X className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-rose-500 mb-1">Contract Overbilling Alert</h4>
                  <p className="text-xs text-rose-400/80 mb-3">
                    This invoice (₹{grand_total.toFixed(2)}) plus previously invoiced amounts (₹{totalInvoicedForProject?.toFixed(2)}) exceeds the project contract value of ₹{prefillProject.contract_value?.toFixed(2)}.
                  </p>
                  {currentUserIsSuperAdmin ? (
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                        <input type="checkbox" checked={overrideOverbill} onChange={e => setOverrideOverbill(e.target.checked)} className="accent-rose-500" />
                        Acknowledge & Override (Super Admin Only)
                      </label>
                      {overrideOverbill && (
                        <input 
                          type="text" 
                          value={overrideReason} 
                          onChange={e => setOverrideReason(e.target.value)} 
                          placeholder="Reason for override..." 
                          className="w-full input-premium p-2 text-xs outline-none border-rose-500/30 focus:border-rose-500"
                          required
                        />
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-rose-400 font-bold">You do not have permission to override this limit. Contact a Super Admin.</p>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--border-soft)] bg-[var(--pm-surface-lowest)]/30 flex justify-end gap-3">
          <button onClick={onClose} className="btn-premium-secondary px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all">
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !selectedClient || subtotal <= 0 || (isOverbilled && (!overrideOverbill || !overrideReason))}
            className="btn-premium-primary flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Generating...' : (
              <>
                <Download className="w-4 h-4" />
                Create & PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
