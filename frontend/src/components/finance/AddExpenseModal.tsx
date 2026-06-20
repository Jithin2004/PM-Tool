import React, { useState } from 'react';
import { X, Save, IndianRupee } from 'lucide-react';
import { createExpense } from '../../services/financeService';
import { showAlert } from '../common/Dialogs';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useWorkspace } from '../../context/WorkspaceContext';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onSuccess: () => void;
}

export function AddExpenseModal({ isOpen, onClose, workspaceId, onSuccess }: AddExpenseModalProps) {
  useEscapeKey(isOpen, onClose);
  const { workspace } = useWorkspace();
  const baseCurrency = workspace?.metadata?.baseCurrency || 'INR';
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<'salary' | 'software' | 'infrastructure' | 'office' | 'misc'>('misc');
  const [vendor, setVendor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [reference, setReference] = useState('');
  const [taxAmount, setTaxAmount] = useState<number | ''>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!description || !amount || Number(amount) <= 0) {
      await showAlert("Please enter a valid description and amount.", { type: "warning" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Build an extended description to store additional context safely without schema changes
      let extendedDescription = description;
      if (vendor) extendedDescription += ` | Vendor: ${vendor}`;
      if (reference) extendedDescription += ` | Ref: ${reference}`;
      if (paymentMethod) extendedDescription += ` | Via: ${paymentMethod}`;
      if (taxAmount) extendedDescription += ` | Tax Included: ${taxAmount}`;

      await createExpense(workspaceId, {
        description: extendedDescription,
        amount: Number(amount),
        date,
        category,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      await showAlert(err.message || "Failed to add expense", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-premium">
      <div className="modal-premium border border-[var(--border-soft)] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col font-geist">
        <div className="flex justify-between items-center p-6 border-b border-[var(--border-soft)]">
          <h2 className="text-xl font-semibold text-text-primary">Add Expense</h2>
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
            <label className="font-medium text-text-primary">Description <span className="text-rose-500">*</span></label>
            <input 
              type="text" 
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What was this expense for?"
              className="w-full input-premium h-11 px-4 text-sm outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Amount ({baseCurrency}) <span className="text-rose-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-text-tertiary">₹</span>
                </div>
                <input 
                  type="number" 
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full input-premium h-11 pl-8 pr-4 text-sm outline-none"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Date <span className="text-rose-500">*</span></label>
              <input 
                type="date" 
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full input-premium h-11 px-4 text-sm outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Category</label>
              <select 
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full input-premium h-11 px-4 text-sm outline-none cursor-pointer"
              >
                <option value="software">Software & Subscriptions</option>
                <option value="infrastructure">Infrastructure & Hosting</option>
                <option value="salary">Salary & Wages</option>
                <option value="office">Office & Supplies</option>
                <option value="misc">Miscellaneous</option>
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Payment Method</label>
              <select 
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full input-premium h-11 px-4 text-sm outline-none cursor-pointer"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Cash">Cash</option>
                <option value="Debit Card">Debit Card</option>
                <option value="UPI">UPI / Digital</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-medium text-text-primary">Vendor / Paid To</label>
            <input 
              type="text" 
              value={vendor}
              onChange={e => setVendor(e.target.value)}
              placeholder="e.g. AWS, Google, WeWork"
              className="w-full input-premium h-11 px-4 text-sm outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Reference / Receipt Number</label>
              <input 
                type="text" 
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Transaction ID or Receipt #"
                className="w-full input-premium h-11 px-4 text-sm outline-none"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="font-medium text-text-primary">Tax Amount Included (Optional)</label>
              <input 
                type="number" 
                min="0"
                step="0.01"
                value={taxAmount}
                onChange={e => setTaxAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
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
            disabled={isSubmitting || !description || !amount}
            className="btn-premium-primary flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : (
              <>
                <Save className="w-4 h-4" />
                Add Expense
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
