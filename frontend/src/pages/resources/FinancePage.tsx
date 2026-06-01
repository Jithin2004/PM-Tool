import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { fetchFinanceData, Client, Invoice, Payment, Expense } from '../../services/financeService';
import { Plus, Landmark, Receipt, CreditCard, TrendingUp, TrendingDown, Wallet, Building2 } from 'lucide-react';

export default function FinancePage() {
  const { workspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    clients: Client[];
    invoices: Invoice[];
    payments: Payment[];
    expenses: Expense[];
    salaries: { base_salary: number }[];
  } | null>(null);

  useEffect(() => {
    if (!workspace?.id) return;
    loadData();
  }, [workspace?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await fetchFinanceData(workspace!.id);
      setData(result);
    } catch (err) {
      console.error('Failed to load finance data', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-text-tertiary" style={{ color: 'var(--pm-on-surface-variant)' }}>
        Loading ledgers...
      </div>
    );
  }

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const isCurrentMonth = (dateString: string) => {
    const d = new Date(dateString);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  };

  const revenueThisMonth = data.payments
    .filter(p => isCurrentMonth(p.payment_date))
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const pendingInvoices = data.invoices
    .filter(i => ['draft', 'sent', 'overdue'].includes(i.status))
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const salaryExpenses = data.salaries.reduce((sum, s) => sum + Number(s.base_salary), 0);
  
  const otherExpensesThisMonth = data.expenses
    .filter(e => isCurrentMonth(e.date))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const netProfit = revenueThisMonth - salaryExpenses - otherExpensesThisMonth;

  return (
    <div className="space-y-8 pb-16 font-geist h-full overflow-y-auto p-6" style={{ color: 'var(--pm-on-surface)' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts & Finance</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Financial oversight and ledger management.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium border"
            style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
            <Building2 className="w-4 h-4" />
            Manage Clients
          </button>
          <button className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            New Invoice
          </button>
        </div>
      </div>
      
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-1">
        <div className="p-5 rounded-xl border relative overflow-hidden" style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--pm-on-surface-variant)' }}>
            <TrendingUp className="text-emerald-500 w-4 h-4" />
            <span>Revenue (This Month)</span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight mt-2">${revenueThisMonth.toLocaleString()}</div>
        </div>
        
        <div className="p-5 rounded-xl border relative overflow-hidden" style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--pm-on-surface-variant)' }}>
            <Receipt className="text-amber-500 w-4 h-4" />
            <span>Pending Invoices</span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight mt-2">${pendingInvoices.toLocaleString()}</div>
        </div>

        <div className="p-5 rounded-xl border relative overflow-hidden" style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--pm-on-surface-variant)' }}>
            <TrendingDown className="text-rose-500 w-4 h-4" />
            <span>Salary Cost (Monthly)</span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight mt-2">${salaryExpenses.toLocaleString()}</div>
        </div>

        <div className="p-5 rounded-xl border relative overflow-hidden" style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--pm-on-surface-variant)' }}>
            <Wallet className={netProfit >= 0 ? "text-emerald-500 w-4 h-4" : "text-rose-500 w-4 h-4"} />
            <span>Net Profit (This Month)</span>
          </div>
          <div className={`text-2xl font-bold font-mono tracking-tight mt-2 ${netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {netProfit >= 0 ? '+' : ''}${netProfit.toLocaleString()}
          </div>
        </div>
      </div>
      
      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-1">
        <div className="rounded-xl border flex flex-col" style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <div className="px-5 py-4 border-b flex justify-between items-center" style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
            <h3 className="font-semibold text-sm">Recent Invoices</h3>
          </div>
          <div className="p-0">
            {data.invoices.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: 'var(--pm-on-surface-variant)' }}>No invoices created yet.</div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
                {data.invoices.slice(0, 5).map(inv => (
                  <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-black/5 transition-colors">
                    <div>
                      <div className="font-mono text-sm">{inv.invoice_number}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>{new Date(inv.issue_date).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-medium">${Number(inv.amount).toLocaleString()}</div>
                      <div className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full inline-block mt-1
                        ${inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' : 
                          inv.status === 'overdue' ? 'bg-rose-500/10 text-rose-500' : 
                          'bg-amber-500/10 text-amber-500'}`}>
                        {inv.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border flex flex-col" style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <div className="px-5 py-4 border-b flex justify-between items-center" style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
            <h3 className="font-semibold text-sm">Recent Expenses</h3>
          </div>
          <div className="p-0">
            {data.expenses.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: 'var(--pm-on-surface-variant)' }}>No expenses logged.</div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
                {data.expenses.slice(0, 5).map(exp => (
                  <div key={exp.id} className="p-4 flex items-center justify-between hover:bg-black/5 transition-colors">
                    <div>
                      <div className="text-sm font-medium">{exp.description}</div>
                      <div className="text-xs mt-1 capitalize" style={{ color: 'var(--pm-on-surface-variant)' }}>{exp.category} • {new Date(exp.date).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-medium text-rose-500">-${Number(exp.amount).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
