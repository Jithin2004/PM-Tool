import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { payrollForecastEngine } from '../../core/engines/payrollForecastEngine';
import { financialRiskEngine } from '../../core/engines/financialRiskEngine';
import { DollarSign, TrendingDown, TrendingUp, AlertCircle, Activity } from 'lucide-react';
import { hasCapability } from '../../core/auth/permissions';

export default function FinanceCommandCenter() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [payrollData, setPayrollData] = useState<any>(null);
  const [riskData, setRiskData] = useState<any>(null);
  
  const canViewFinance = hasCapability(profile?.role, 'manage_compensation') || profile?.role === 'owner';

  useEffect(() => {
    if (workspace && canViewFinance) {
      loadFinanceData();
    } else {
      setLoading(false);
    }
  }, [workspace, canViewFinance]);

  const loadFinanceData = async () => {
    try {
      // Mocking account fetch for demo
      const risks = await financialRiskEngine.scanFinancialHealth(workspace!.id);
      setRiskData(risks);
      
      const payroll = await payrollForecastEngine.forecastPayroll(workspace!.id, 'mock_account_id');
      setPayrollData(payroll);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!canViewFinance) {
    return (
      <div className="p-8 text-center bg-surface m-6 rounded-xl border border-border">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-text-primary">Restricted Access</h2>
        <p className="text-text-secondary mt-2">You do not have permission to view the Finance Command Center.</p>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center animate-pulse">Loading intelligence...</div>;

  return (
    <div className="space-y-8 pb-16 font-geist p-6 bg-surface">
      <div className="flex items-end justify-between px-1 pt-2 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" /> Finance Command Center
          </h1>
          <p className="text-sm mt-1 text-text-secondary">
            Global operational finance, runway calculation, and payroll forecasting.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-border bg-surface-2">
          <span className={`w-2 h-2 rounded-full ${(riskData?.risks?.length || 0) > 0 ? 'bg-amber-500 animate-pulse' : 'bg-signal-safe animate-pulse'}`} />
          <span className="font-mono-pm text-xs uppercase tracking-widest text-text-secondary">
             {(riskData?.risks?.length || 0) > 0 ? 'RISK DETECTED' : 'HEALTHY'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-xl bg-surface-2 border border-border">
          <p className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-2">Available Cash</p>
          <div className="text-3xl font-bold text-text-primary">
            ${riskData?.cash?.toLocaleString() || '0'}
          </div>
        </div>
        
        <div className="glass-panel p-6 rounded-xl bg-surface-2 border border-border">
          <p className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-2">Monthly Burn</p>
          <div className="text-3xl font-bold text-rose-400">
            ${riskData?.monthlyBurn?.toLocaleString() || '0'}
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl bg-surface-2 border border-border">
          <p className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-2">Runway</p>
          <div className="text-3xl font-bold text-emerald-400">
            {riskData?.runwayMonths === 999 ? 'Infinite' : `${riskData?.runwayMonths?.toFixed(1)} months`}
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl bg-surface-2 border border-border">
          <p className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-2">Overdue Receivables</p>
          <div className="text-3xl font-bold text-amber-400">
            ${riskData?.totalOverdue?.toLocaleString() || '0'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payroll Forecast */}
        <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-primary">
            <Activity className="w-5 h-5 text-indigo-400" /> Payroll Forecast Engine
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-surface rounded-lg border border-border-subtle">
              <span className="text-sm font-bold text-text-secondary">Upcoming Obligation</span>
              <span className="text-lg font-bold text-text-primary">${payrollData?.totalObligation?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-surface rounded-lg border border-border-subtle">
              <span className="text-sm font-bold text-text-secondary">Due Date</span>
              <span className="text-lg font-bold text-text-primary">{new Date(payrollData?.nextPayrollDate).toLocaleDateString()}</span>
            </div>
            
            {payrollData?.isAtRisk && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-500 mt-4 text-sm font-bold flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Shortage Risk Detected: ${payrollData.shortageRisk.toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* Risk Scanner */}
        <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-primary">
            <Shield className="w-5 h-5 text-amber-400" /> Financial Risk Escalations
          </h2>
          <div className="space-y-3">
            {riskData?.risks?.length === 0 ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 text-sm font-bold">
                No acute risks detected.
              </div>
            ) : (
              riskData?.risks?.map((r: any, idx: number) => (
                <div key={idx} className="p-3 bg-surface rounded-lg border border-border-subtle flex gap-3 items-start">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="block font-bold text-sm text-text-primary uppercase">{r.type.replace('_', ' ')}</span>
                    <span className="text-sm text-text-secondary">{r.message}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Temporary Shield mock
function Shield(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
