import React, { useState } from 'react';
import { X, Landmark } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface FinanceInitializationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function FinanceInitializationModal({ isOpen, onClose, onSuccess }: FinanceInitializationModalProps) {
  const { workspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    baseCurrency: 'INR',
    fiscalYearStart: 'April',
    accountName: 'Main Corporate Account',
    startingBalance: 0
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    
    setLoading(true);
    try {
      // Placeholder service call to save baseline financial data
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // We would normally dispatch this to a finance service 
      // e.g. await initializeFinanceAccounts(workspace.id, formData);
      
      // Update local storage or trigger a refetch to unlock the dashboard
      localStorage.setItem(`finance_init_${workspace.id}`, 'true');
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[var(--surface)] border border-[var(--border-soft)] shadow-2xl rounded-2xl overflow-hidden premium-fade-in-up">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-soft)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Landmark className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Initialize Finance</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider text-[10px]">
                Base Currency
              </label>
              <select 
                value={formData.baseCurrency}
                onChange={e => setFormData({ ...formData, baseCurrency: e.target.value })}
                className="w-full bg-[var(--surface-hover)] border border-[var(--border-soft)] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="INR">INR - Indian Rupee</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider text-[10px]">
                Fiscal Year Start Month
              </label>
              <select 
                value={formData.fiscalYearStart}
                onChange={e => setFormData({ ...formData, fiscalYearStart: e.target.value })}
                className="w-full bg-[var(--surface-hover)] border border-[var(--border-soft)] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="January">January</option>
                <option value="April">April</option>
                <option value="July">July</option>
                <option value="October">October</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider text-[10px]">
                Primary Treasury Account Name
              </label>
              <input 
                type="text"
                required
                value={formData.accountName}
                onChange={e => setFormData({ ...formData, accountName: e.target.value })}
                className="w-full bg-[var(--surface-hover)] border border-[var(--border-soft)] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="e.g. Main Corporate Account"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider text-[10px]">
                Starting Bank Balance
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] font-mono">$</span>
                <input 
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.startingBalance}
                  onChange={e => setFormData({ ...formData, startingBalance: parseFloat(e.target.value) })}
                  className="w-full bg-[var(--surface-hover)] border border-[var(--border-soft)] rounded-xl pl-8 pr-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-soft)]">
            <button 
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="btn-premium-primary px-6 py-2.5 rounded-xl text-sm font-bold tracking-wide"
            >
              {loading ? 'Initializing...' : 'Initialize Accounts'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
