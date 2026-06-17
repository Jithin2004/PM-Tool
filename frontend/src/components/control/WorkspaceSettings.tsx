import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { Settings, Globe, Bell, Shield, ToggleLeft, Save, Database, RefreshCw, ChevronDown, Building2, Download, Briefcase, Key, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { upsertCompanyBillingProfile } from '../../services/financeService';
import { SandboxWorkspaceManager } from '../workspace/SandboxWorkspaceManager';
import { PilotReadinessPanel } from '../workspace/PilotReadinessPanel';
import { WorkspaceReadiness } from './WorkspaceReadiness';
import { OperationalHealth } from './OperationalHealth';
import { ExportCenter } from './ExportCenter';
import { BillingSettings } from './BillingSettings';

const TABS = [
  { id: 'organization', label: 'Organization' },
  { id: 'working_rules', label: 'Working Rules' },
  { id: 'people_rules', label: 'People Rules' },
  { id: 'finance', label: 'Finance Settings' },
  { id: 'billing', label: 'Billing & Plans' },
  { id: 'client_access', label: 'Client Access' },
  { id: 'security', label: 'Security' },
  { id: 'export', label: 'Export & Backup' }
];

export function WorkspaceSettings() {
  const { profile } = useAuth();
  const { workspace, updateWorkspaceSettings } = useWorkspace();
  const { raw: { profiles } } = useOperationalData();
  const { notify } = useDashboard();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'organization';
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab) setActiveTab(tab);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [formState, setFormState] = useState({
    companyName: '',
    country: '',
    region: '',
    timezone: 'UTC',
    mode: 'KANBAN',
    autoArchive: true,
    notifications: true,
    workingTimeFrom: '09:00',
    workingTimeTo: '17:00',
    passwordPolicy: 'standard',
    magicLinkExpiry: '24h',
    attendanceEnabled: true,
    payrollEnabled: false,
    productivityFactor: 0.8,
    baseCurrency: 'USD',
  });

  const [billingProfile, setBillingProfile] = useState({
    legal_name: '',
    gstin: '',
    pan: '',
    billing_address: '',
    state: '',
    country: 'India',
    invoice_prefix: 'RPM'
  });

  useEffect(() => {
    if (workspace?.settings) {
      setFormState({
        companyName: workspace.settings.companyName || '',
        country: workspace.settings.country || '',
        region: workspace.settings.region || '',
        timezone: workspace.settings.timezone || 'UTC',
        mode: workspace.settings.executionMode || workspace.settings.default_mode || 'KANBAN',
        autoArchive: workspace.settings.auto_archive ?? true,
        notifications: workspace.settings.notifications ?? true,
        workingTimeFrom: workspace.settings.workStart || workspace.settings.workingTimeFrom || '09:00',
        workingTimeTo: workspace.settings.workEnd || workspace.settings.workingTimeTo || '17:00',
        passwordPolicy: workspace.settings.passwordPolicy || 'standard',
        magicLinkExpiry: workspace.settings.magicLinkExpiry || '24h',
        attendanceEnabled: workspace.settings.attendanceEnabled ?? true,
        payrollEnabled: workspace.settings.payrollEnabled ?? false,
        productivityFactor: workspace.settings.productivityFactor ?? 0.8,
        baseCurrency: workspace.settings.baseCurrency || 'USD',
      });
    }
    if (workspace?.id) {
      supabase.from('company_billing_profile').select('*').eq('workspace_id', workspace.id).maybeSingle().then(({ data }) => {
        if (data) {
          setBillingProfile({
            legal_name: data.legal_name || '',
            gstin: data.gstin || '',
            pan: data.pan || '',
            billing_address: data.billing_address || '',
            state: data.state || '',
            country: data.country || 'India',
            invoice_prefix: data.invoice_prefix || 'RPM'
          });
        }
      });
    }
  }, [workspace?.settings, workspace?.id]);

  const owner = useMemo(() => {
    if (!workspace?.ownerId || !profiles) return null;
    return profiles.find((u: any) => u.id === workspace.ownerId);
  }, [workspace?.ownerId, profiles]);

  const ownerDisplay = owner ? (owner.full_name || owner.email) : (workspace?.ownerId || 'N/A');

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateWorkspaceSettings({
        companyName: formState.companyName,
        country: formState.country,
        region: formState.region,
        timezone: formState.timezone,
        executionMode: formState.mode,
        default_mode: formState.mode,
        auto_archive: formState.autoArchive,
        notifications: formState.notifications,
        workStart: formState.workingTimeFrom,
        workingTimeFrom: formState.workingTimeFrom,
        workEnd: formState.workingTimeTo,
        workingTimeTo: formState.workingTimeTo,
        passwordPolicy: formState.passwordPolicy,
        magicLinkExpiry: formState.magicLinkExpiry,
        attendanceEnabled: formState.attendanceEnabled,
        payrollEnabled: formState.payrollEnabled,
        productivityFactor: formState.productivityFactor,
        baseCurrency: formState.baseCurrency,
      });
      await upsertCompanyBillingProfile({
        workspace_id: workspace!.id,
        legal_name: billingProfile.legal_name || 'My Company',
        gstin: billingProfile.gstin || null,
        pan: billingProfile.pan || null,
        billing_address: billingProfile.billing_address || null,
        state: billingProfile.state || 'N/A',
        country: billingProfile.country || 'India',
        invoice_prefix: billingProfile.invoice_prefix || 'RPM'
      });
      notify('Settings saved successfully', 'success');
    } catch (err: any) {
      notify(err.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8 premium-fade-in-up pb-32">
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-accent-primary/20 via-accent-secondary/20 to-transparent blur-2xl opacity-50 -z-10" />
        <h2 className="text-4xl font-semibold tracking-tight text-white mb-2">Company Control Center</h2>
        <p className="text-xs text-[var(--text-secondary)] tracking-wide max-w-2xl">Unified settings and operational rules for your organization.</p>
      </div>

      <WorkspaceReadiness />
      <OperationalHealth />
      
      <div className="flex premium-segmented-control w-full overflow-x-auto scrollbar-premium">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              window.history.replaceState(null, '', `?tab=${tab.id}`);
            }}
            className={`flex-1 py-2 text-xs font-mono uppercase tracking-wider premium-segmented-control-btn whitespace-nowrap px-4 ${
              activeTab === tab.id ? 'active' : ''
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {activeTab === 'organization' && (
          <div className="space-y-8">
            <div className="premium-panel border border-[var(--border-soft)] rounded-2xl p-6 sm:p-8">
              <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-[var(--text-secondary)] mb-6 flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-indigo-400" />
                Organization Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group/input">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Company Name</label>
                  <input value={formState.companyName} onChange={e => setFormState(s => ({ ...s, companyName: e.target.value }))} className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all focus:bg-black/50" />
                </div>
                <div className="group/input">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Timezone</label>
                  <select value={formState.timezone} onChange={e => setFormState(s => ({ ...s, timezone: e.target.value }))} className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all focus:bg-black/50 cursor-pointer">
                    <option value="UTC">UTC (Universal Coordinated Time)</option>
                    <option value="America/New_York">Eastern Time (US & Canada)</option>
                    <option value="Europe/London">London</option>
                    <option value="Asia/Kolkata">India Standard Time</option>
                  </select>
                </div>
                <div className="group/input">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Country</label>
                  <input value={formState.country} onChange={e => setFormState(s => ({ ...s, country: e.target.value }))} className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all focus:bg-black/50" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'working_rules' && (
          <div className="space-y-8">
            <div className="premium-panel border border-[var(--border-soft)] rounded-2xl p-6 sm:p-8">
              <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-[var(--text-secondary)] mb-6 flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-cyan-400" />
                Working Hours & Execution
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group/input">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Day Start Time</label>
                  <input type="time" value={formState.workingTimeFrom} onChange={e => setFormState(s => ({ ...s, workingTimeFrom: e.target.value }))} className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all focus:bg-black/50" />
                </div>
                <div className="group/input">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Day End Time</label>
                  <input type="time" value={formState.workingTimeTo} onChange={e => setFormState(s => ({ ...s, workingTimeTo: e.target.value }))} className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all focus:bg-black/50" />
                </div>
                <div className="group/input md:col-span-2">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Default View Mode</label>
                  <select value={formState.mode} onChange={e => setFormState(s => ({ ...s, mode: e.target.value }))} className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all focus:bg-black/50 cursor-pointer">
                    <option value="KANBAN">Kanban</option>
                    <option value="SCRUM">Scrum / Sprint</option>
                    <option value="TIMELINE">Timeline / Gantt</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'people_rules' && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="premium-panel border border-[var(--border-soft)] rounded-2xl p-6 sm:p-8">
              <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-[var(--text-secondary)] mb-6 flex items-center gap-2.5">
                <Users className="w-4 h-4 text-purple-400" />
                Employee Lifecycle & Governance
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group/input">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Attendance Tracking</label>
                  <select value={formState.attendanceEnabled ? 'true' : 'false'} onChange={e => setFormState(s => ({ ...s, attendanceEnabled: e.target.value === 'true' }))} className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all focus:bg-black/50 cursor-pointer">
                    <option value="true">Enabled (Required for all employees)</option>
                    <option value="false">Disabled (Trust-based working hours)</option>
                  </select>
                </div>
                <div className="group/input">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Payroll & Compensation Engine</label>
                  <select value={formState.payrollEnabled ? 'true' : 'false'} onChange={e => setFormState(s => ({ ...s, payrollEnabled: e.target.value === 'true' }))} className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all focus:bg-black/50 cursor-pointer">
                    <option value="false">Disabled (External Payroll)</option>
                    <option value="true">Enabled (Internal Ledger)</option>
                  </select>
                </div>
                <div className="group/input">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Target Productivity Factor</label>
                  <div className="flex items-center gap-4">
                    <input type="range" min="0.1" max="1.0" step="0.05" value={formState.productivityFactor} onChange={e => setFormState(s => ({ ...s, productivityFactor: parseFloat(e.target.value) }))} className="flex-1 accent-indigo-500" />
                    <span className="text-sm font-mono text-white w-12 text-right">{Math.round(formState.productivityFactor * 100)}%</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-2 leading-relaxed">
                    Expected percentage of working hours spent on billable/productive tasks vs. overhead.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
             <div className="premium-panel border border-[var(--border-soft)] rounded-2xl p-6 sm:p-8">
              <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-[var(--text-secondary)] mb-6 flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-emerald-400" />
                Global Finance Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="group/input">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Base Currency</label>
                  <select
                    value={formState.baseCurrency}
                    onChange={(e) => setFormState(s => ({ ...s, baseCurrency: e.target.value }))}
                    className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-emerald-500/50 transition-all focus:bg-black/50 cursor-pointer"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="INR">INR - Indian Rupee</option>
                    <option value="AED">AED - UAE Dirham</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="SGD">SGD - Singapore Dollar</option>
                  </select>
                </div>
              </div>
            </div>

             <div className="premium-panel border border-[var(--border-soft)] rounded-2xl p-6 sm:p-8">
              <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-[var(--text-secondary)] mb-6 flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-emerald-400" />
                Company Billing & Tax Profile
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="group/input">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Legal Name</label>
                  <input value={billingProfile.legal_name} onChange={e => setBillingProfile(s => ({...s, legal_name: e.target.value}))} className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all focus:bg-black/50" />
                </div>
                <div className="group/input">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Invoice Prefix</label>
                  <input value={billingProfile.invoice_prefix} onChange={e => setBillingProfile(s => ({...s, invoice_prefix: e.target.value}))} className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all focus:bg-black/50" />
                </div>
                <div className="group/input">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">GSTIN / Tax ID</label>
                  <input value={billingProfile.gstin} onChange={e => setBillingProfile(s => ({...s, gstin: e.target.value}))} className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all focus:bg-black/50" />
                </div>
                <div className="group/input">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">PAN / Registration</label>
                  <input value={billingProfile.pan} onChange={e => setBillingProfile(s => ({...s, pan: e.target.value}))} className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all focus:bg-black/50" />
                </div>
                <div className="group/input lg:col-span-2">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Billing Address</label>
                  <input value={billingProfile.billing_address} onChange={e => setBillingProfile(s => ({...s, billing_address: e.target.value}))} className="w-full bg-black/30 border border-[var(--border-soft)] rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all focus:bg-black/50" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'client_access' && (
          <div className="space-y-8">
            <div className="premium-panel border border-[var(--border-soft)] rounded-2xl p-6 sm:p-8">
              <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-[var(--text-secondary)] mb-6 flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-blue-400" />
                External Access & Clients
              </h3>
              <div className="group/input">
                <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Magic Link Expiry</label>
                <select value={formState.magicLinkExpiry} onChange={e => setFormState(s => ({ ...s, magicLinkExpiry: e.target.value }))} className="w-full md:w-1/2 bg-black/30 border border-[var(--border-soft)] rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all focus:bg-black/50 cursor-pointer">
                  <option value="12h">12 Hours</option>
                  <option value="24h">24 Hours</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-8">
            <div className="premium-panel border border-[var(--border-soft)] rounded-2xl p-6 sm:p-8">
              <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-[var(--text-secondary)] mb-6 flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-rose-400" />
                Security Rules
              </h3>
              <div className="group/input">
                <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">Password Policy Requirement</label>
                <select value={formState.passwordPolicy} onChange={e => setFormState(s => ({ ...s, passwordPolicy: e.target.value }))} className="w-full md:w-1/2 bg-black/30 border border-[var(--border-soft)] rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all focus:bg-black/50 cursor-pointer">
                  <option value="standard">Standard (8 chars, 1 number)</option>
                  <option value="strict">Strict (12 chars, upper/lower/number/symbol)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <ExportCenter />
        )}

        {activeTab === 'billing' && (
          <BillingSettings />
        )}
      </div>

      <div className="flex justify-end pt-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="relative overflow-hidden group bg-accent-primary hover:bg-accent-primary/90 text-white h-11 px-8 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(129,140,248,0.3)] active:scale-[0.98]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <Save className="w-4 h-4 relative z-10" />
          <span className="relative z-10">{saving ? 'Saving...' : 'Save All Settings'}</span>
        </button>
      </div>
      <div className="mt-16 space-y-4">
        <SandboxWorkspaceManager />
        <PilotReadinessPanel />
      </div>
    </div>
  );
}
