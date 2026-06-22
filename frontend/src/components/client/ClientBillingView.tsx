import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { DollarSign, Clock, FileText, CheckCircle2, AlertCircle, Receipt, ArrowUpRight } from 'lucide-react';

interface BillingLog {
  id: string;
  hours_logged: number;
  description: string;
  is_billable: boolean;
  billing_status: 'unbilled' | 'invoiced' | 'paid';
  logged_at: string;
  tasks?: {
    name: string;
    projects?: {
      name: string;
      contract_rate?: number;
    };
  };
}

const DEFAULT_HOURLY_RATE = 150.0;

export const ClientBillingView: React.FC = () => {
  const [logs, setLogs] = useState<BillingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBillingData = async () => {
      try {
        setLoading(true);
        // RLS guarantees clients only see logs associated with tasks inside their specific projects
        const { data, error: fetchError } = await supabase
          .from('time_logs')
          .select(`
            id, hours_logged, description, is_billable, billing_status, logged_at,
            tasks (
              name,
              projects (
                name,
                contract_rate
              )
            )
          `)
          .eq('is_billable', true) // Clients usually only see billable time
          .order('logged_at', { ascending: false });

        if (fetchError) throw fetchError;
        setLogs((data as any) || []);
      } catch (err: any) {
        console.error('Error fetching billing data:', err);
        setError('Failed to load billing history. Please contact your project manager.');
      } finally {
        setLoading(false);
      }
    };

    fetchBillingData();
  }, []);

  // Compute Aggregates Dynamically
  const metrics = useMemo(() => {
    let totalHours = 0;
    let amountInvoiced = 0;
    let amountPaid = 0;
    let unbilledAccruals = 0;

    logs.forEach(log => {
      // Safely extract rate, falling back to default if null/undefined
      const rate = log.tasks?.projects?.contract_rate ?? DEFAULT_HOURLY_RATE;
      const hours = Number(log.hours_logged) || 0;
      const lineTotal = hours * rate;

      totalHours += hours;

      if (log.billing_status === 'invoiced') {
        amountInvoiced += lineTotal;
      } else if (log.billing_status === 'paid') {
        amountPaid += lineTotal;
      } else if (log.billing_status === 'unbilled') {
        unbilledAccruals += lineTotal;
      }
    });

    return {
      totalHours,
      amountInvoiced,
      amountPaid,
      unbilledAccruals
    };
  }, [logs]);

  // Currency Formatter
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-zinc-900 rounded-2xl border border-zinc-800"></div>
          ))}
        </div>
        <div className="h-96 bg-zinc-900 rounded-2xl border border-zinc-800 mt-8"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-50 tracking-tight flex items-center gap-3">
          <Receipt className="h-6 w-6 text-indigo-400" />
          Financial & Billing Overview
        </h1>
        <p className="text-zinc-400 mt-2">
          Real-time ledger of billable hours and accrued project costs.
        </p>
      </div>

      {/* Metric Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock className="h-16 w-16 text-indigo-500" />
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium text-zinc-400 mb-1">Total Billable Hours</p>
            <p className="text-3xl font-bold text-zinc-50">{metrics.totalHours.toFixed(2)} <span className="text-lg font-normal text-zinc-500">hrs</span></p>
          </div>
        </div>

        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ArrowUpRight className="h-16 w-16 text-amber-500" />
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium text-zinc-400 mb-1">Unbilled Accruals</p>
            <p className="text-3xl font-bold text-zinc-50">{formatCurrency(metrics.unbilledAccruals)}</p>
          </div>
        </div>

        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FileText className="h-16 w-16 text-blue-500" />
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium text-zinc-400 mb-1">Total Invoiced</p>
            <p className="text-3xl font-bold text-zinc-50">{formatCurrency(metrics.amountInvoiced)}</p>
          </div>
        </div>

        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium text-zinc-400 mb-1">Total Paid</p>
            <p className="text-3xl font-bold text-zinc-50">{formatCurrency(metrics.amountPaid)}</p>
          </div>
        </div>

      </div>

      {/* Invoice Ledger */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
          <h3 className="text-lg font-semibold text-zinc-50">Detailed Ledger</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="text-xs uppercase bg-zinc-950/50 text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Task / Project</th>
                <th className="px-6 py-4 font-medium text-right">Hours</th>
                <th className="px-6 py-4 font-medium text-right">Subtotal</th>
                <th className="px-6 py-4 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    No billable time logs have been recorded for your projects yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const rate = log.tasks?.projects?.contract_rate ?? DEFAULT_HOURLY_RATE;
                  const hours = Number(log.hours_logged) || 0;
                  const subtotal = hours * rate;

                  const statusColors = {
                    unbilled: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                    invoiced: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  };

                  return (
                    <tr key={log.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(log.logged_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-zinc-200 font-medium">{log.tasks?.name || 'Unknown Task'}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{log.tasks?.projects?.name || 'Unknown Project'}</p>
                        {log.description && (
                          <p className="text-xs text-zinc-400 mt-1 truncate max-w-sm">{log.description}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                        {hours.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-medium text-zinc-300">
                        {formatCurrency(subtotal)}
                        <p className="text-[10px] text-zinc-500 font-sans font-normal mt-0.5">@ {formatCurrency(rate)}/hr</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[log.billing_status]}`}>
                          {log.billing_status.charAt(0).toUpperCase() + log.billing_status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
