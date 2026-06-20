import React, { useState } from 'react';
import { X, Save, IndianRupee } from 'lucide-react';
import { logPayment, Invoice } from '../../services/financeService';
import { showAlert } from '../common/Dialogs';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useWorkspace } from '../../context/WorkspaceContext';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  invoices: Invoice[];
  onSuccess: () => void;
}

export function RecordPaymentModal({ isOpen, onClose, workspaceId, invoices, onSuccess }: RecordPaymentModalProps) {
  useEscapeKey(isOpen, onClose);
  const { workspace } = useWorkspace();
  const baseCurrency = workspace?.metadata?.baseCurrency || 'INR';
  
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [reference, setReference] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const unpaidInvoices = invoices.filter(inv => inv.status !== 'paid' && inv.balance_due > 0);
  const selectedInvoice = invoices.find(inv => inv.id === invoiceId);

  const handleSubmit = async () => {
    if (!invoiceId || !amount || Number(amount) <= 0) {
      await showAlert("Please select an invoice and enter a valid amount.", { type: "warning" });
      return;
    }

    if (selectedInvoice && Number(amount) > selectedInvoice.balance_due) {
      await showAlert(`Amount cannot exceed the balance due (${selectedInvoice.balance_due}).`, { type: "warning" });
      return;
    }

    setIsSubmitting(true);
    try {
      await logPayment(workspaceId, {
        workspace_id: workspaceId,
        invoice_id: invoiceId,
        amount: Number(amount),
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference_number: reference,
        notes: `Payment for Invoice ${selectedInvoice?.invoice_number}`,
      });

      // Post payment to accounting ledger
      try {
        const { financeLedgerService } = await import('../../services/financeLedgerService');
        await financeLedgerService.recordPayment({
          workspaceId,
          userId: 'system', // the RPC handles actual tracking, UI user info would be better if we had user object here.
          paymentId: `PAY-${Date.now()}`, // Temporary ID mapping. Ideally logPayment should return the ID
          invoiceId,
          amount: Number(amount),
          description: `Payment recorded via ${paymentMethod}. Ref: ${reference}`,
        });
      } catch (err) {
         console.error('Failed to post payment to ledger', err);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      await showAlert(err.message || "Failed to record payment", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-premium">
      <div className="modal-premium border border-[var(--border-soft)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col font-geist">
        <div className="flex justify-between items-center p-6 border-b border-[var(--border-soft)]">
          <h2 className="text-xl font-semibold text-text-primary">Record Payment</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--pm-surface)]/5 text-text-quaternary hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-sm text-text-secondary scrollbar-premium">
          <div className="space-y-1.5">
            <label className="font-medium text-text-primary">Select Unpaid Invoice <span className="text-rose-500">*</span></label>
            <select 
              value={invoiceId}
              onChange={e => {
                setInvoiceId(e.target.value);
                const inv = invoices.find(i => i.id === e.target.value);
                if (inv) setAmount(inv.balance_due);
              }}
              className="w-full input-premium h-11 px-4 text-sm outline-none cursor-pointer"
              required
            >
              <option value="">Choose invoice...</option>
              {unpaidInvoices.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} - Balance: {baseCurrency} {inv.balance_due}
                </option>
              ))}
            </select>
            {unpaidInvoices.length === 0 && (
              <p className="text-xs text-amber-500 mt-1">No unpaid invoices found.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Amount ({baseCurrency}) <span className="text-rose-500">*</span></label>
              <input 
                type="number" 
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full input-premium h-11 px-4 text-sm outline-none"
                required
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Payment Date <span className="text-rose-500">*</span></label>
              <input 
                type="date" 
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full input-premium h-11 px-4 text-sm outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Payment Method</label>
              <select 
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full input-premium h-11 px-4 text-sm outline-none cursor-pointer"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI / Digital</option>
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Reference Number</label>
              <input 
                type="text" 
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Transaction ID"
                className="w-full input-premium h-11 px-4 text-sm outline-none"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-[var(--border-soft)] bg-[var(--pm-surface-lowest)]/30 flex justify-end gap-3">
          <button onClick={onClose} className="btn-premium-secondary px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all">
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !invoiceId || !amount || unpaidInvoices.length === 0}
            className="btn-premium-primary flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Recording...' : (
              <>
                <Save className="w-4 h-4" />
                Record Payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
