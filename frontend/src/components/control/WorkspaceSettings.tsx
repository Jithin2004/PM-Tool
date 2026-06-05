import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { Settings, Globe, Bell, Shield, ToggleLeft, Save, Database, RefreshCw, ChevronDown, Building2, Download, Briefcase, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { upsertCompanyBillingProfile } from '../../services/financeService';
import { DemoWorkspaceManager } from '../workspace/DemoWorkspaceManager';
import { PilotReadinessPanel } from '../workspace/PilotReadinessPanel';
import { WorkspaceHealth } from './WorkspaceHealth';
import { ExportCenter } from './ExportCenter';

const TABS = [
  { id: 'organization', label: 'Organization' },
  { id: 'working_rules', label: 'Working Rules' },
  { id: 'people_rules', label: 'People Rules' },
  { id: 'finance', label: 'Finance Settings' },
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
  const [activeTab, setActiveTab] = useState('organization');

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
    departments: '',
    passwordPolicy: 'standard',
    magicLinkExpiry: '24h',
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
        mode: workspace.settings.default_mode || 'KANBAN',
        autoArchive: workspace.settings.auto_archive ?? true,
        notifications: workspace.settings.notifications ?? true,
        workingTimeFrom: workspace.settings.workingTimeFrom || '09:00',
        workingTimeTo: workspace.settings.workingTimeTo || '17:00',
        departments: (workspace.settings.departments || []).join(', '),
        passwordPolicy: workspace.settings.passwordPolicy || 'standard',
        magicLinkExpiry: workspace.settings.magicLinkExpiry || '24h',
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
        default_mode: formState.mode,
        auto_archive: formState.autoArchive,
        notifications: formState.notifications,
        workingTimeFrom: formState.workingTimeFrom,
        workingTimeTo: formState.workingTimeTo,
        departments: formState.departments.split(',').map(s => s.trim()).filter(Boolean),
        passwordPolicy: formState.passwordPolicy,
        magicLinkExpiry: formState.magicLinkExpiry,
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
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8 animate-fade-in pb-32">
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-accent-primary/20 via-accent-secondary/20 to-transparent blur-2xl opacity-50 -z-10" />
        <h2 className="text-4xl font-semibold tracking-tight text-text-primary mb-2">Company Control Center</h2>
        <p className="text-sm text-text-tertiary tracking-wide max-w-2xl">Unified settings and operational rules for your organization.</p>
      </div>

      <WorkspaceHealth />
      
      <div className="flex gap-2 border-b border-border/50 pb-px overflow-x-auto no-scrollbar scroll-smooth">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 ${
              activeTab === tab.id 
                ? 'text-accent-primary border-accent-primary' 
                : 'text-text-tertiary border-transparent hover:text-text-secondary hover:border-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {activeTab === 'organization' && (
          <div className="space-y-8">
            <div className="bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xs font-bold tracking-widest uppercase text-text-secondary mb-6 flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-signal-info" />
                Organization Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group/input">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">Company Name</label>
                  <input value={formState.companyName} onChange={e => setFormState(s => ({ ...s, companyName: e.target.value }))} className="w-full bg-surface/50 border border-border/50 focus:border-accent-primary/50 rounded-xl h-11 px-4 text-sm text-text-secondary outline-none" />
                </div>
                <div className="group/input">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">Timezone</label>
                  <select value={formState.timezone} onChange={e => setFormState(s => ({ ...s, timezone: e.target.value }))} className="w-full bg-surface/50 border border-border/50 focus:border-accent-primary/50 rounded-xl h-11 px-4 text-sm text-text-secondary outline-none">
                    <option value="UTC">UTC (Universal Coordinated Time)</option>
                    <option value="America/New_York">Eastern Time (US & Canada)</option>
                    <option value="Europe/London">London</option>
                    <option value="Asia/Kolkata">India Standard Time</option>
                  </select>
                </div>
                <div className="group/input">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">Country</label>
                  <input value={formState.country} onChange={e => setFormState(s => ({ ...s, country: e.target.value }))} className="w-full bg-surface/50 border border-border/50 rounded-xl h-11 px-4 text-sm text-text-secondary outline-none" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'working_rules' && (
          <div className="space-y-8">
            <div className="bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xs font-bold tracking-widest uppercase text-text-secondary mb-6 flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-cyan-400" />
                Working Hours & Execution
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group/input">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">Day Start Time</label>
                  <input type="time" value={formState.workingTimeFrom} onChange={e => setFormState(s => ({ ...s, workingTimeFrom: e.target.value }))} className="w-full bg-surface/50 border border-border/50 rounded-xl h-11 px-4 text-sm text-text-secondary outline-none" />
                </div>
                <div className="group/input">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">Day End Time</label>
                  <input type="time" value={formState.workingTimeTo} onChange={e => setFormState(s => ({ ...s, workingTimeTo: e.target.value }))} className="w-full bg-surface/50 border border-border/50 rounded-xl h-11 px-4 text-sm text-text-secondary outline-none" />
                </div>
                <div className="group/input md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">Default View Mode</label>
                  <select value={formState.mode} onChange={e => setFormState(s => ({ ...s, mode: e.target.value }))} className="w-full bg-surface/50 border border-border/50 rounded-xl h-11 px-4 text-sm text-text-secondary outline-none">
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
          <div className="space-y-8">
            <div className="bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xs font-bold tracking-widest uppercase text-text-secondary mb-6 flex items-center gap-2.5">
                <Briefcase className="w-4 h-4 text-purple-400" />
                Departments & Organization
              </h3>
              <div className="group/input">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">Departments (comma separated)</label>
                <input value={formState.departments} onChange={e => setFormState(s => ({ ...s, departments: e.target.value }))} className="w-full bg-surface/50 border border-border/50 rounded-xl h-11 px-4 text-sm text-text-secondary outline-none" placeholder="e.g. Engineering, Marketing, Design" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="space-y-8">
             <div className="bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xs font-bold tracking-widest uppercase text-text-secondary mb-6 flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-emerald-500" />
                Company Billing & Tax Profile
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="group/input">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">Legal Name</label>
                  <input value={billingProfile.legal_name} onChange={e => setBillingProfile(s => ({...s, legal_name: e.target.value}))} className="w-full bg-surface/50 border border-border/50 rounded-xl h-11 px-4 text-sm text-text-secondary outline-none" />
                </div>
                <div className="group/input">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">Invoice Prefix</label>
                  <input value={billingProfile.invoice_prefix} onChange={e => setBillingProfile(s => ({...s, invoice_prefix: e.target.value}))} className="w-full bg-surface/50 border border-border/50 rounded-xl h-11 px-4 text-sm text-text-secondary outline-none" />
                </div>
                <div className="group/input">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">GSTIN / Tax ID</label>
                  <input value={billingProfile.gstin} onChange={e => setBillingProfile(s => ({...s, gstin: e.target.value}))} className="w-full bg-surface/50 border border-border/50 rounded-xl h-11 px-4 text-sm text-text-secondary outline-none" />
                </div>
                <div className="group/input">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">PAN / Registration</label>
                  <input value={billingProfile.pan} onChange={e => setBillingProfile(s => ({...s, pan: e.target.value}))} className="w-full bg-surface/50 border border-border/50 rounded-xl h-11 px-4 text-sm text-text-secondary outline-none" />
                </div>
                <div className="group/input lg:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">Billing Address</label>
                  <input value={billingProfile.billing_address} onChange={e => setBillingProfile(s => ({...s, billing_address: e.target.value}))} className="w-full bg-surface/50 border border-border/50 rounded-xl h-11 px-4 text-sm text-text-secondary outline-none" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'client_access' && (
          <div className="space-y-8">
            <div className="bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xs font-bold tracking-widest uppercase text-text-secondary mb-6 flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-blue-400" />
                External Access & Clients
              </h3>
              <div className="group/input">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">Magic Link Expiry</label>
                <select value={formState.magicLinkExpiry} onChange={e => setFormState(s => ({ ...s, magicLinkExpiry: e.target.value }))} className="w-full md:w-1/2 bg-surface/50 border border-border/50 rounded-xl h-11 px-4 text-sm text-text-secondary outline-none">
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
            <div className="bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xs font-bold tracking-widest uppercase text-text-secondary mb-6 flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-red-400" />
                Security Rules
              </h3>
              <div className="group/input">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">Password Policy Requirement</label>
                <select value={formState.passwordPolicy} onChange={e => setFormState(s => ({ ...s, passwordPolicy: e.target.value }))} className="w-full md:w-1/2 bg-surface/50 border border-border/50 rounded-xl h-11 px-4 text-sm text-text-secondary outline-none">
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
      </div>

      <div className="flex justify-end pt-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="relative overflow-hidden group bg-accent-primary hover:bg-accent-primary/90 text-[var(--pm-text)] dark:text-white h-11 px-8 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(var(--accent-primary-rgb),0.3)] hover:shadow-[0_0_30px_rgba(var(--accent-primary-rgb),0.5)] active:scale-[0.98]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <Save className="w-4 h-4 relative z-10" />
          <span className="relative z-10">{saving ? 'Saving...' : 'Save All Settings'}</span>
        </button>
      </div>
      
      <div className="mt-16 space-y-4">
        <DemoWorkspaceManager />
        <PilotReadinessPanel />
      </div>
    </div>
  );
}
