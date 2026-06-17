
import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  fetchFinanceData, closeFinancialPeriod, createFinancialAdjustment, deleteInvoice, cancelInvoice,
  Client, Invoice, Payment, Expense, FinancialPeriod, FinancialSnapshot, FinancialAdjustment, CompanyBillingProfile, fetchClients
} from '../../services/financeService';
import { Plus, Landmark, Receipt, CreditCard, TrendingUp, TrendingDown, 
  Wallet, Building2, ChevronLeft, ChevronRight, Lock, 
  AlertCircle, History, Download, X, Trash2, FileText, Clock } from 'lucide-react';
import { CreateInvoiceModal } from '../../components/finance/CreateInvoiceModal';
import { ManageClientsModal } from '../../components/finance/ManageClientsModal';
import { generateInvoicePDF } from '../../services/invoicePdfService';
import { showAlert, showConfirm, showPrompt } from '../../components/common/Dialogs';
import { PremiumEmptyState } from '../../components/ui/PremiumEmptyState';
import { deliverableService, Milestone } from '../../services/deliverableService';
import { profitabilityService, ProjectProfitability } from '../../services/profitabilityService';
import { Icon } from '../../components/ui/Icon';

export default function FinancePage() {
  const { workspace } = useWorkspace();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  const [activeTab, setActiveTab] = useState<string>('reports');

  useEffect(() => {
    const syncTab = () => {
      const searchParams = new URLSearchParams(window.location.search);
      setActiveTab(searchParams.get('tab') || 'reports');
    };
    syncTab();
    window.addEventListener('popstate', syncTab);
    return () => window.removeEventListener('popstate', syncTab);
  }, []);

  const [data, setData] = useState<{
    clients: Client[];
    invoices: Invoice[];
    payments: Payment[];
    expenses: Expense[];
    salaries: { user_id: string; base_salary: number }[];
    employmentRecords?: { user_id: string; employment_status: string }[];
    periods: FinancialPeriod[];
    snapshots: FinancialSnapshot[];
    adjustments: FinancialAdjustment[];
    companyProfile: CompanyBillingProfile;
  } | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showManageClientsModal, setShowManageClientsModal] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({ type: 'expense', amount: '', reason: '' });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [billableMilestones, setBillableMilestones] = useState<Milestone[]>([]);
  const [projectProfitability, setProjectProfitability] = useState<ProjectProfitability[]>([]);
  const [showTimeInvoiceModal, setShowTimeInvoiceModal] = useState(false);
  const [selectedClientForTime, setSelectedClientForTime] = useState('');
  const [isGeneratingTimeInvoice, setIsGeneratingTimeInvoice] = useState(false);

  useEffect(() => {
    if (!workspace?.id) return;
    loadData();
    fetchClients(workspace.id).then(setClients);

    // Realtime subscriptions
    const periodsSub = supabase.channel('financial_periods_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_periods', filter: `workspace_id=eq.${workspace.id}` }, () => {
        loadData();
      }).subscribe();
      
    const snapshotsSub = supabase.channel('financial_snapshots_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_snapshots', filter: `workspace_id=eq.${workspace.id}` }, () => {
        loadData();
      }).subscribe();

    // Adjustments doesn't have workspace_id directly, but changes usually trigger load
    const adjustmentsSub = supabase.channel('financial_adjustments_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_adjustments' }, () => {
        loadData();
      }).subscribe();

    const clientsSub = supabase.channel('clients_changes_finance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `workspace_id=eq.${workspace.id}` }, () => {
        fetchClients(workspace.id).then(setClients);
        loadData();
      }).subscribe();

    return () => {
      supabase.removeChannel(periodsSub);
      supabase.removeChannel(snapshotsSub);
      supabase.removeChannel(adjustmentsSub);
      supabase.removeChannel(clientsSub);
    };
  }, [workspace?.id]);

  const loadData = async () => {
    try {
      if (!data) setLoading(true);
      const result = await fetchFinanceData(workspace!.id);
      setData(result as any);
      
      const milestones = await deliverableService.getMilestones(workspace!.id, 'ready_for_billing');
      setBillableMilestones(milestones);
      
      const profitability = await profitabilityService.getWorkspaceProfitability(workspace!.id);
      setProjectProfitability(profitability);
    } catch (err) {
      console.error('Failed to load finance data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseMonth = async () => {
    if (!workspace?.id || !user?.id) return;
    if (await showConfirm(`Are you sure you want to close ${getMonthName(viewMonth)} ${viewYear}? This will lock records and store a permanent snapshot.`)) {
      try {
        await closeFinancialPeriod(workspace.id, viewMonth, viewYear, user.id);
      } catch (err: any) {
        handleDbError(err);
      }
    }
  };

  const handleDbError = (err: any) => {
    if (err?.message?.includes('Cannot modify financial records in a closed period')) {
      setErrorMsg("This financial period is closed. Add an adjustment instead.");
    } else {
      setErrorMsg(err?.message || "An unexpected error occurred.");
    }
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const submitAdjustment = async () => {
    const period = data?.periods.find(p => p.month === viewMonth && p.year === viewYear);
    if (!period || !user?.id) return;

    if (!adjustmentForm.amount || !adjustmentForm.reason) {
      showAlert("Amount and Reason are required.");
      return;
    }

    try {
      await createFinancialAdjustment({
        period_id: period.id,
        type: adjustmentForm.type as 'revenue'|'salary'|'expense',
        amount: Number(adjustmentForm.amount),
        reason: adjustmentForm.reason,
        created_by: user.id
      });
      setShowAdjustmentModal(false);
      setAdjustmentForm({ type: 'expense', amount: '', reason: '' });
      loadData();
    } catch (err) {
      handleDbError(err);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-text-tertiary" style={{ color: 'var(--pm-on-surface-variant)' }}>
        Loading ledgers...
      </div>
    );
  }

  const period = data.periods.find(p => p.month === viewMonth && p.year === viewYear);
  const snapshot = period ? data.snapshots.find(s => s.period_id === period.id) : null;
  const isClosed = period?.status === 'closed';

  const periodAdjustments = period ? data.adjustments.filter(a => a.period_id === period.id) : [];

  const isCurrentMonth = (dateString: string) => {
    const d = new Date(dateString);
    return (d.getMonth() + 1) === viewMonth && d.getFullYear() === viewYear;
  };

  // Payment/Revenue mapping with GST extraction
  let currentMonthRevenue = 0;
  let currentMonthGST = 0;

  data.payments.filter(p => isCurrentMonth(p.payment_date)).forEach(p => {
    const inv = data.invoices.find(i => i.id === p.invoice_id);
    if (inv && (inv.grand_total > 0 || inv.amount > 0)) {
      const gTotal = inv.grand_total || inv.amount;
      const taxAmt = inv.total_tax || 0;
      const taxRatio = taxAmt / gTotal;
      const paymentGST = Number(p.amount) * taxRatio;
      currentMonthGST += paymentGST;
      currentMonthRevenue += (Number(p.amount) - paymentGST);
    } else {
      currentMonthRevenue += Number(p.amount);
    }
  });

  const baseRevenue = isClosed && snapshot ? Number(snapshot.total_revenue) : currentMonthRevenue;
  const baseGST = isClosed ? 0 : currentMonthGST;

  const hasEmploymentRecords = data.employmentRecords && data.employmentRecords.length > 0;
  const baseSalary = isClosed && snapshot ? Number(snapshot.total_salary_expense) :
    data.salaries.reduce((sum, s) => {
      if (!hasEmploymentRecords) {
        return sum + Number(s.base_salary);
      }
      const emp = data.employmentRecords?.find(e => e.user_id === s.user_id);
      const isActive = emp ? emp.employment_status === 'active' : false;
      return isActive ? sum + Number(s.base_salary) : sum;
    }, 0);

  const baseOther = isClosed && snapshot ? Number(snapshot.total_other_expenses) :
    data.expenses.filter(e => isCurrentMonth(e.date)).reduce((sum, e) => sum + Number(e.amount), 0);

  // Adjustment totals
  const adjRevenue = periodAdjustments.filter(a => a.type === 'revenue').reduce((sum, a) => sum + Number(a.amount), 0);
  const adjSalary = periodAdjustments.filter(a => a.type === 'salary').reduce((sum, a) => sum + Number(a.amount), 0);
  const adjOther = periodAdjustments.filter(a => a.type === 'expense').reduce((sum, a) => sum + Number(a.amount), 0);

  // Final totals
  const revenueThisMonth = baseRevenue + adjRevenue;
  const salaryExpenses = baseSalary + adjSalary;
  const otherExpensesThisMonth = baseOther + adjOther;
  const netProfit = revenueThisMonth - salaryExpenses - otherExpensesThisMonth;

  const pendingInvoicesAmount = data.invoices
    .filter(i => ['draft', 'sent', 'overdue', 'partial'].includes(i.status))
    .reduce((sum, i) => sum + Number(i.balance_due || i.amount || 0), 0);

  function getMonthName(m: number) {
    return new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' });
  }

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const isFinanceEmpty = data.invoices.length === 0 && data.expenses.length === 0 && data.payments.length === 0 && data.salaries.length === 0 && clients.length === 0;

  if (isFinanceEmpty) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-surface">
        <div className="max-w-md w-full glass-panel rounded-xl border border-border p-8 text-center">
          <PremiumEmptyState
            icon={Landmark}
            title="Setup Financial Tracking"
            description="Your workspace currently has no financial data. Manage clients, generate invoices, track expenses, and monitor profitability."
            action={
              <button 
                onClick={() => setShowManageClientsModal(true)} 
                className="btn-premium-primary px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 mx-auto"
              >
                <Building2 className="w-4 h-4" /> Add First Client
              </button>
            }
          />
        </div>
        
        {/* Manage Clients Modal */}
        {workspace && (
          <ManageClientsModal
            isOpen={showManageClientsModal}
            onClose={() => setShowManageClientsModal(false)}
            workspaceId={workspace.id}
            clients={clients}
            onSuccess={() => { fetchClients(workspace.id).then(setClients); loadData(); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 h-full overflow-y-auto p-6 scrollbar-premium premium-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between px-1 pt-2 gap-4 md:gap-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Accounts & Finance</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Financial oversight and ledger management.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setShowManageClientsModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border border-[var(--border-soft)] bg-[var(--surface-glass)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-white transition-all active:scale-[0.98]"
          >
            <Building2 className="w-4 h-4 text-indigo-400" />
            Manage Clients
          </button>
          {!isClosed ? (
            <>
              <button 
                onClick={() => setShowTimeInvoiceModal(true)} 
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-[var(--pm-primary)] border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all active:scale-[0.98]"
              >
                <Clock className="w-4 h-4" />
                Bill Time
              </button>
              <button 
                onClick={() => setShowInvoiceModal(true)} 
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                New Invoice
              </button>
            </>
          ) : (
            <button 
              onClick={() => setShowAdjustmentModal(true)} 
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-amber-600 hover:bg-amber-700 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Add Adjustment
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="px-4 py-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl flex items-center gap-3 mx-1">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Period Selector */}
      <div className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-glass)] backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-1 hover:bg-[var(--surface-hover)] rounded-full transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          <div className="text-lg font-semibold w-40 text-center text-white">
            {getMonthName(viewMonth)} {viewYear}
          </div>
          <button onClick={nextMonth} className="p-1 hover:bg-[var(--surface-hover)] rounded-full transition-colors"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-3">
          {isClosed ? (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-xs font-semibold uppercase tracking-wider border border-amber-500/15">
              <Lock className="w-3.5 h-3.5" />
              Closed Period
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-semibold uppercase tracking-wider border border-emerald-500/15">
              Open Period
            </div>
          )}
          {!isClosed && (
            <button onClick={handleCloseMonth} className="btn-premium-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
              Close Month
            </button>
          )}
        </div>
      </div>
      
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-1">
        <div className="premium-panel premium-hover-lift rounded-2xl p-5 border border-[var(--border-soft)]">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">
            <TrendingUp className="text-emerald-400 w-4 h-4" />
            <span>Revenue</span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight mt-2 flex items-baseline gap-2 text-white">
            ${revenueThisMonth.toLocaleString()}
            {adjRevenue !== 0 && (
              <span className={`text-xs font-medium ${adjRevenue > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ({adjRevenue > 0 ? '+' : ''}{adjRevenue.toLocaleString()})
              </span>
            )}
          </div>
        </div>
        
        <div className="premium-panel premium-hover-lift rounded-2xl p-5 border border-[var(--border-soft)]">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">
            <Receipt className="text-amber-400 w-4 h-4" />
            <span>Pending Receivables</span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight mt-2 flex items-baseline gap-2 text-white">
            ${pendingInvoicesAmount.toLocaleString()}
          </div>
          {!isClosed && baseGST > 0 && (
            <div className="text-[10px] mt-1 text-[var(--text-secondary)] italic">
              (GST: ${baseGST.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})})
            </div>
          )}
        </div>
 
        <div className="premium-panel premium-hover-lift rounded-2xl p-5 border border-[var(--border-soft)]">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">
            <TrendingDown className="text-rose-400 w-4 h-4" />
            <span>Salary Cost</span>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight mt-2 flex items-baseline gap-2 text-white">
            ${salaryExpenses.toLocaleString()}
            {adjSalary !== 0 && (
              <span className={`text-xs font-medium ${adjSalary > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                ({adjSalary > 0 ? '+' : ''}{adjSalary.toLocaleString()})
              </span>
            )}
          </div>
        </div>
 
        <div className="premium-panel premium-hover-lift rounded-2xl p-5 border border-[var(--border-soft)]">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">
            <Wallet className={netProfit >= 0 ? "text-emerald-400 w-4 h-4" : "text-rose-400 w-4 h-4"} />
            <span>Net Profit</span>
          </div>
          <div className={`text-2xl font-bold font-mono tracking-tight mt-2 ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netProfit >= 0 ? '+' : ''}${netProfit.toLocaleString()}
          </div>
          {isClosed && (adjRevenue !== 0 || adjSalary !== 0 || adjOther !== 0) && (
            <div className="text-[10px] mt-1 text-[var(--text-secondary)] italic">
              Orig: ${snapshot?.net_profit?.toLocaleString() || 0}
            </div>
          )}
        </div>
      </div>
      
      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-1">
        
        {/* Adjustments Section - visible if closed and adjustments exist */}
        {['reports', 'budgets'].includes(activeTab) && isClosed && periodAdjustments.length > 0 ? (
          <div className="premium-panel rounded-2xl flex flex-col col-span-1 lg:col-span-2 border border-[var(--border-soft)]">
            <div className="px-5 py-4 border-b border-[var(--border-soft)] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-sm text-white">Adjustment History</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-premium">
                <thead>
                  <tr>
                    <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)]">Reason</th>
                    <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)]">Type Correction</th>
                    <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)]">Date</th>
                    <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)] text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {periodAdjustments.map(adj => (
                    <tr key={adj.id}>
                      <td className="text-xs font-semibold text-[var(--text-secondary)]">{adj.reason}</td>
                      <td className="text-xs text-[var(--text-secondary)] capitalize font-mono text-[10px]">{adj.type}</td>
                      <td className="text-xs text-[var(--text-secondary)]">{new Date(adj.created_at).toLocaleDateString()}</td>
                      <td className={`text-right font-mono text-xs font-bold ${adj.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {adj.amount >= 0 ? '+' : ''}{Number(adj.amount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* Project Profitability Section */}
        {activeTab === 'reports' && projectProfitability.length > 0 && (
          <div className="premium-panel rounded-2xl flex flex-col col-span-1 lg:col-span-2 border border-[var(--border-soft)]">
            <div className="px-5 py-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-indigo-500/5">
              <div className="flex items-center gap-2">
                <Icon name="monitoring" size={16} className="text-indigo-400" />
                <h3 className="font-semibold text-sm text-indigo-400">Project Financial Control</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-premium">
                <thead>
                  <tr>
                    <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)]">Project</th>
                    <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)] text-right">Revenue</th>
                    <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)] text-right">Labor Cost</th>
                    <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)] text-right">Margin</th>
                    <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)] text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projectProfitability.map(p => (
                    <tr key={p.project_id}>
                      <td className="text-xs font-semibold text-[var(--text-secondary)]">{p.project_name}</td>
                      <td className="text-right text-xs font-mono text-[var(--text-secondary)]">${Number(p.revenue).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</td>
                      <td className="text-right text-xs font-mono text-[var(--text-secondary)]">${Number(p.actual_cost).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</td>
                      <td className="text-right">
                        <div className="flex flex-col items-end">
                          <span className={`text-xs font-mono font-bold ${p.margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ${Number(p.margin).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                          </span>
                          <span className="text-[10px] text-[var(--text-secondary)] font-mono">{Number(p.margin_percentage).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="text-right">
                         <span className={`text-[9px] uppercase tracking-widest font-mono font-bold px-2 py-0.5 rounded border ${
                            p.risk === 'Healthy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' : 
                            p.risk === 'At Risk' ? 'bg-amber-500/10 text-amber-400 border-amber-500/15' : 
                            'bg-rose-500/10 text-rose-400 border-rose-500/15'}`}>
                            {p.risk}
                          </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Billable Deliverables Section */}
        {activeTab === 'invoices' && billableMilestones.length > 0 && (
          <div className="premium-panel rounded-2xl flex flex-col col-span-1 lg:col-span-2 border border-emerald-500/30">
            <div className="px-5 py-4 border-b border-emerald-500/30 flex justify-between items-center bg-emerald-500/5">
              <div className="flex items-center gap-2">
                <Icon name="check_circle" size={16} className="text-emerald-400" />
                <h3 className="font-semibold text-sm text-emerald-400">Billable Deliverables (Client Approved)</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-premium">
                <thead>
                  <tr>
                    <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)]">Project</th>
                    <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)]">Deliverable</th>
                    <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)] text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {billableMilestones.map(m => (
                    <tr key={m.id}>
                      <td className="text-xs font-semibold text-[var(--text-secondary)]">{m.project_name}</td>
                      <td className="text-xs text-[var(--text-secondary)]">{m.title}</td>
                      <td className="text-right">
                        <button 
                          className="px-3 py-1.5 text-xs font-bold rounded bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                          onClick={() => {
                            // Pre-fill invoice modal based on milestone
                            setShowInvoiceModal(true);
                            // In a full implementation, we would pass the milestone to the modal.
                          }}
                        >
                          Generate Invoice
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
 
        {activeTab === 'invoices' && (
          <div className="premium-panel rounded-2xl flex flex-col col-span-1 lg:col-span-2 border border-[var(--border-soft)]">
            <div className="px-5 py-4 border-b border-[var(--border-soft)] flex justify-between items-center">
              <h3 className="font-semibold text-sm text-white">Recent Invoices</h3>
            </div>
          <div className="p-0">
            {data.invoices.length === 0 ? (
              <PremiumEmptyState 
                icon={Receipt} 
                title="No Invoices Issued" 
                description="Billing history and outstanding invoices will appear here once you generate an invoice for client work."
                action={(
                  <button onClick={() => setShowInvoiceModal(true)} className="btn-premium-primary px-4 py-2 rounded text-xs mt-2">
                    Generate First Invoice
                  </button>
                )}
              />
            ) : (
              <div className="overflow-x-auto scrollbar-premium">
                <table className="w-full text-left border-collapse table-premium">
                  <thead>
                    <tr>
                      <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)]">Invoice #</th>
                      <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)]">Date</th>
                      <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)]">Amount</th>
                      <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)]">Status</th>
                      <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.slice(0, 5).map(inv => (
                      <tr key={inv.id}>
                        <td className="font-mono text-xs text-[var(--text-secondary)] font-medium">{inv.invoice_number}</td>
                        <td className="text-xs text-[var(--text-secondary)]">{new Date(inv.issue_date).toLocaleDateString()}</td>
                        <td className="font-mono text-xs text-[var(--text-secondary)] font-bold">${Number(inv.grand_total || inv.amount).toLocaleString()}</td>
                        <td>
                          <span className={`text-[9px] uppercase tracking-widest font-mono font-bold px-2 py-0.5 rounded border ${
                            inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' : 
                            inv.status === 'overdue' ? 'bg-rose-500/10 text-rose-400 border-rose-500/15' : 
                            inv.status === 'partial' ? 'bg-blue-500/10 text-blue-400 border-blue-500/15' :
                            'bg-amber-500/10 text-amber-400 border-amber-500/15 animate-pulse'}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={async () => {
                                try {
                                  const client = data.clients.find(c => c.id === inv.client_id);
                                  const comp = data.companyProfile;
                                  if (comp && client) {
                                    await generateInvoicePDF(comp, client, inv, inv.line_items || []);
                                  } else {
                                    showAlert("Missing company profile or client details.");
                                  }
                                } catch(err) {
                                  console.error(err);
                                }
                              }}
                              className="p-1.5 text-[var(--text-secondary)] hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                              title="Download PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            {inv.status === 'draft' && (
                              <button 
                                onClick={async () => {
                                  if (!workspace?.id || !profile?.id) return;
                                  if (await showConfirm(`Are you sure you want to completely delete draft invoice ${inv.invoice_number}? This action is irreversible.`)) {
                                    try {
                                      await deleteInvoice(inv.id, workspace.id, profile.id, 'User initiated deletion');
                                      loadData();
                                    } catch (e: any) {
                                      showAlert(e.message || "Failed to delete invoice");
                                    }
                                  }
                                }}
                                className="p-1.5 text-[var(--text-secondary)] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                                title="Delete Draft"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {(inv.status === 'issued' || inv.status === 'sent') && (
                              <button 
                                onClick={async () => {
                                  if (!workspace?.id || !profile?.id) return;
                                  const reason = await showPrompt('Why are you cancelling this invoice?', { title: 'Cancellation Reason' });
                                  if (reason) {
                                    try {
                                      await cancelInvoice(inv, profile.id, reason);
                                      loadData();
                                    } catch (e: any) {
                                      showAlert(e.message || "Failed to cancel invoice");
                                    }
                                  }
                                }}
                                className="p-1.5 text-[var(--text-secondary)] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                                title="Cancel Invoice"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        )}
 
        {activeTab === 'budgets' && (
        <div className="premium-panel rounded-2xl flex flex-col border border-[var(--border-soft)]">
          <div className="px-5 py-4 border-b border-[var(--border-soft)] flex justify-between items-center">
            <h3 className="font-semibold text-sm text-white">Expenses (This Month)</h3>
          </div>
          <div className="p-0">
            {data.expenses.filter(e => isCurrentMonth(e.date)).length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center">
                <TrendingDown className="w-8 h-8 text-text-quaternary mb-3" />
                <p className="text-sm font-medium text-text-secondary">No expenses logged this month.</p>
                <p className="text-xs text-text-tertiary mt-1">Track outgoing costs to accurately monitor profitability.</p>
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-premium">
                <table className="w-full text-left border-collapse table-premium">
                  <thead>
                    <tr>
                      <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)]">Description</th>
                      <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)]">Category</th>
                      <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)]">Date</th>
                      <th className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--text-secondary)] text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expenses.filter(e => isCurrentMonth(e.date)).slice(0, 5).map(exp => (
                      <tr key={exp.id}>
                        <td className="text-xs font-semibold text-[var(--text-secondary)]">{exp.description}</td>
                        <td className="text-xs text-[var(--text-secondary)] uppercase tracking-wide font-mono text-[10px]">{exp.category}</td>
                        <td className="text-xs text-[var(--text-secondary)]">{new Date(exp.date).toLocaleDateString()}</td>
                        <td className="text-right font-mono text-xs font-bold text-rose-400">-${Number(exp.amount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Payroll Empty State */}
        {activeTab === 'payroll' && (
          <div className="premium-panel rounded-2xl flex flex-col col-span-1 lg:col-span-2 border border-[var(--border-soft)] p-12 text-center items-center justify-center">
            <Building2 className="w-12 h-12 text-indigo-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Payroll & Compensation Engine</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-md">Detailed payroll management, tax deductions, and salary disbursement are securely handled in the centralized Logistics module.</p>
            <button onClick={() => {
              window.history.pushState(null, '', '/resources/payroll');
              window.dispatchEvent(new CustomEvent('popstate'));
            }} className="btn-premium-primary px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wider">
              Go to Logistics
            </button>
          </div>
        )}

      </div>
 
      {/* Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div onClick={() => setShowAdjustmentModal(false)} className="absolute inset-0 modal-overlay-premium" />
          <div className="relative modal-premium p-6 rounded-2xl max-w-md w-full text-white max-h-[90vh] flex flex-col scrollbar-premium">
            <div className="flex justify-between items-center mb-4 flex-none">
              <h2 className="text-lg font-bold tracking-tight text-white">Add Adjustment</h2>
              <button onClick={() => setShowAdjustmentModal(false)} className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-secondary)] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 scrollbar-premium">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-2">Type</label>
                <select 
                  value={adjustmentForm.type} 
                  onChange={e => setAdjustmentForm({ ...adjustmentForm, type: e.target.value })}
                  className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500/50 text-white cursor-pointer transition-colors"
                >
                  <option value="revenue">Revenue</option>
                  <option value="salary">Salary</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-2">Amount ($)</label>
                <input 
                  type="number" 
                  value={adjustmentForm.amount} 
                  onChange={e => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })}
                  placeholder="e.g. -500 or 1200"
                  className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500/50 text-white transition-all focus:bg-black/50"
                />
                <p className="text-[10px] mt-1 text-[var(--text-secondary)] italic">Use negative values for deductions.</p>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-2">Reason</label>
                <input 
                  type="text" 
                  value={adjustmentForm.reason} 
                  onChange={e => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  placeholder="e.g. Server Cost Correction"
                  className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500/50 text-white transition-all focus:bg-black/50"
                />
              </div>
              <button 
                onClick={submitAdjustment}
                className="w-full btn-premium-primary py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider active:scale-[0.98] mt-4"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Invoice Modal */}
      {workspace && (
        <CreateInvoiceModal 
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          workspaceId={workspace.id}
          clients={clients}
          companyProfile={data.companyProfile}
          onSuccess={() => { loadData(); fetchClients(workspace.id).then(setClients); }}
        />
      )}

      {/* Time to Invoice Modal */}
      {showTimeInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div onClick={() => setShowTimeInvoiceModal(false)} className="absolute inset-0 modal-overlay-premium" />
          <div className="relative modal-premium p-6 rounded-2xl max-w-md w-full text-white max-h-[90vh] flex flex-col scrollbar-premium">
            <div className="flex justify-between items-center mb-4 flex-none">
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2"><Clock className="w-5 h-5 text-emerald-400" /> Invoice Unbilled Time</h2>
              <button onClick={() => setShowTimeInvoiceModal(false)} className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-secondary)] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 scrollbar-premium">
              <p className="text-xs text-[var(--text-secondary)]">This will generate a consolidated draft invoice for all unbilled work sessions and deliverables for the selected client.</p>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-2">Select Client</label>
                <select 
                  value={selectedClientForTime} 
                  onChange={e => setSelectedClientForTime(e.target.value)}
                  className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500/50 text-white cursor-pointer transition-colors"
                >
                  <option value="">-- Choose Client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>
              
              <button 
                onClick={async () => {
                  if (!selectedClientForTime) return showAlert("Please select a client.");
                  setIsGeneratingTimeInvoice(true);
                  try {
                    const { error } = await supabase.rpc('generate_invoice_from_time_logs', {
                      p_workspace_id: workspace?.id,
                      p_client_id: selectedClientForTime,
                      p_creator_id: profile?.id
                    });
                    if (error) throw error;
                    showAlert("Draft invoice generated successfully.", "success");
                    setShowTimeInvoiceModal(false);
                    loadData();
                  } catch (e: any) {
                    showAlert(e.message || "Failed to generate invoice");
                  } finally {
                    setIsGeneratingTimeInvoice(false);
                  }
                }}
                disabled={!selectedClientForTime || isGeneratingTimeInvoice}
                className="w-full btn-premium-primary py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider active:scale-[0.98] mt-4 disabled:opacity-50"
              >
                {isGeneratingTimeInvoice ? 'Processing...' : 'Generate Draft Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Manage Clients Modal */}
      {workspace && (
        <ManageClientsModal
          isOpen={showManageClientsModal}
          onClose={() => setShowManageClientsModal(false)}
          workspaceId={workspace.id}
          clients={clients}
          onSuccess={() => { fetchClients(workspace.id).then(setClients); loadData(); }}
        />
      )}
    </div>
  );
}
