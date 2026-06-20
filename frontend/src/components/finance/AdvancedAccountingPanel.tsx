import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { BookOpen, AlertTriangle, RotateCcw } from 'lucide-react';
import { moneyUtils } from '../../utils/moneyUtils';
import { useAuth } from '../../context/AuthContext';
import { financeAccountingEngine } from '../../core/engines/financeAccountingEngine';
import { showPrompt, showAlert } from '../common/Dialogs';

export const AdvancedAccountingPanel: React.FC = () => {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace?.id) return;
    const fetchJournals = async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select(`
          id, entry_date, description, status, source_type,
          journal_lines ( id, debit_amount, credit_amount, description, finance_chart_accounts ( name, account_code ) )
        `)
        .eq('workspace_id', workspace.id)
        .order('entry_date', { ascending: false })
        .limit(50);

      if (!error && data) {
        setJournals(data);
      }
      setLoading(false);
    };
    fetchJournals();
  }, [workspace?.id]);

  const handleReverse = async (journal: any) => {
    if (!workspace?.id || !user?.id) return;

    const reason = await showPrompt(
      "No data is deleted. A correction entry will be created instead. Please provide a reason:",
      {
        title: "Reverse Entry"
      }
    );
    if (!reason) return;

    try {
      await financeAccountingEngine.reverseEntry(workspace.id, journal.id, user.id, reason);

      // Refresh journals
      const { data } = await supabase
        .from('journal_entries')
        .select(`
          id, entry_date, description, status, source_type,
          journal_lines ( id, debit_amount, credit_amount, description, finance_chart_accounts ( name, account_code ) )
        `)
        .eq('workspace_id', workspace.id)
        .order('entry_date', { ascending: false })
        .limit(50);

      if (data) setJournals(data);
    } catch (err: any) {
      await showAlert(err.message || "Failed to reverse entry", { type: "error" });
    }
  };

  if (loading) return <div className="p-4 text-sm text-[var(--pm-text-secondary)]">Loading ledger...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3 text-sm">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <div className="text-amber-500">
          <p className="font-semibold mb-1">Double-Entry Accounting Ledger</p>
          <p className="opacity-90">This view exposes raw debits and credits for workspace administrators and financial controllers. Modifying history directly is prohibited to maintain audit compliance.</p>
        </div>
      </div>

      <div className="space-y-4">
        {journals.map(j => {
          const totalDebit = j.journal_lines.reduce((s: number, l: any) => moneyUtils.add(s, l.debit_amount), 0);
          const totalCredit = j.journal_lines.reduce((s: number, l: any) => moneyUtils.add(s, l.credit_amount), 0);
          const isBalanced = totalDebit === totalCredit;

          return (
            <div key={j.id} className="bg-surface-2 border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-border bg-surface-3 flex justify-between items-center">
                <div>
                  <h4 className="font-medium text-[var(--pm-text)] flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-500" />
                    {j.description}
                  </h4>
                  <div className="text-xs text-[var(--pm-text-secondary)] mt-1 flex gap-3">
                    <span>{new Date(j.entry_date).toLocaleString()}</span>
                    <span className="capitalize text-indigo-400">Source: {j.source_type}</span>
                    <span className={`capitalize ${j.status === 'reversed' ? 'text-rose-500' : 'text-emerald-500'}`}>Status: {j.status}</span>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  {j.status !== 'reversed' && isBalanced && (
                    <button
                      onClick={() => handleReverse(j)}
                      className="text-[10px] uppercase font-bold tracking-widest text-text-tertiary hover:text-rose-500 flex items-center gap-1 transition-colors px-2 py-1 border border-transparent hover:border-rose-500/30 rounded bg-transparent hover:bg-rose-500/10"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reverse
                    </button>
                  )}
                  <div className={`text-xs font-semibold px-2 py-1 rounded ${isBalanced ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {isBalanced ? 'Balanced' : 'Unbalanced'}
                  </div>
                </div>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface-highest text-xs uppercase text-[var(--pm-text-secondary)] border-b border-border">
                    <tr>
                      <th className="px-5 py-2">Account</th>
                      <th className="px-5 py-2">Line Description</th>
                      <th className="px-5 py-2 text-right text-indigo-400">Debit</th>
                      <th className="px-5 py-2 text-right text-emerald-400">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {j.journal_lines.map((l: any) => (
                      <tr key={l.id} className="hover:bg-surface-highest transition-colors">
                        <td className="px-5 py-2.5 text-[var(--pm-text)] font-medium">
                          <span className="text-xs text-[var(--pm-text-tertiary)] mr-2">{l.finance_chart_accounts?.account_code}</span>
                          {l.finance_chart_accounts?.name}
                        </td>
                        <td className="px-5 py-2.5 text-[var(--pm-text-secondary)] truncate max-w-xs">{l.description || '-'}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-indigo-400">{l.debit_amount > 0 ? moneyUtils.format(l.debit_amount) : '-'}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-emerald-400">{l.credit_amount > 0 ? moneyUtils.format(l.credit_amount) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-surface-highest font-semibold text-[var(--pm-text)] border-t border-border">
                    <tr>
                      <td colSpan={2} className="px-5 py-2 text-right">Totals:</td>
                      <td className="px-5 py-2 text-right font-mono text-indigo-400">{moneyUtils.format(totalDebit)}</td>
                      <td className="px-5 py-2 text-right font-mono text-emerald-400">{moneyUtils.format(totalCredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
