import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, Clock, Globe, Puzzle, Users, ChevronRight, ChevronLeft,
  CheckCircle, Loader, Settings
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { navigate } from '../../lib/navigation';
import { logger } from '../../lib/logger';
import { COUNTRIES } from '../../data/countries';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'company' | 'schedule' | 'modules' | 'complete';

interface CompanyInfo {
  companyName: string;
  logoUrl: string;
  industry: string;
  companySize: string;
}

interface ScheduleInfo {
  timezone: string;
  workStart: string;
  workEnd: string;
  workingDays: number[];
  country: string;
}

interface ModuleInfo {
  sprints: boolean;
  finance: boolean;
  hr: boolean;
  approvals: boolean;
  clientPortal: boolean;
}

const STEPS: Step[] = ['company', 'schedule', 'modules', 'complete'];
const STEP_LABELS: Record<Step, string> = {
  company: 'Company',
  schedule: 'Schedule',
  modules: 'Modules',
  complete: 'Ready',
};

const INDUSTRIES = [
  'Software & Technology', 'Consulting & Services', 'Marketing & Creative',
  'Finance & Accounting', 'Healthcare', 'Education', 'Manufacturing',
  'Real Estate', 'Legal', 'Other',
];

const COMPANY_SIZES = ['1–10', '11–50', '51–200', '201–500', '500+'];

const WORKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const DEFAULT_SCHEDULE: ScheduleInfo = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  workStart: '09:00',
  workEnd: '17:00',
  workingDays: [1, 2, 3, 4, 5],
  country: '',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function WorkspaceInitPage() {
  const { workspace, refreshWorkspace } = useWorkspace();
  const { profile } = useAuth();

  useEffect(() => {
    const correlationId = sessionStorage.getItem('resolve_pm_correlation_id') || 'bootstrap';
    const runId = sessionStorage.getItem('resolve_pm_run_id') || 'bootstrap';
    const ctx = logger.createContext(correlationId, runId, profile, { id: workspace?.id, name: workspace?.name });
    logger.startTimeline(ctx);
    logger.logCheckpoint('BOOT-502', 'STARTED', 'WorkspaceInitPage setup wizard mounted (WORKSPACE_INIT_REQUIRED)');
  }, [workspace?.id, profile?.id]);

  const [step, setStep] = useState<Step>('company');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [company, setCompany] = useState<CompanyInfo>({
    companyName: workspace?.name || '',
    logoUrl: workspace?.settings?.logoUrl || '',
    industry: '',
    companySize: '',
  });

  const [schedule, setSchedule] = useState<ScheduleInfo>({
    ...DEFAULT_SCHEDULE,
    timezone: workspace?.settings?.timezone || DEFAULT_SCHEDULE.timezone,
    workStart: workspace?.settings?.workStart || DEFAULT_SCHEDULE.workStart,
    workEnd: workspace?.settings?.workEnd || DEFAULT_SCHEDULE.workEnd,
    workingDays: workspace?.settings?.workingDays || DEFAULT_SCHEDULE.workingDays,
    country: workspace?.settings?.country || '',
  });

  const [modules, setModules] = useState<ModuleInfo>({
    sprints: true,
    finance: false,
    hr: false,
    approvals: false,
    clientPortal: false,
  });

  // Guard: only super_admin should be here
  useEffect(() => {
    if (profile && profile.role !== 'super_admin') {
      navigate('/overview');
    }
  }, [profile]);

  const stepIndex = STEPS.indexOf(step);

  const toggleWorkday = (day: number) => {
    setSchedule(prev => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter(d => d !== day)
        : [...prev.workingDays, day],
    }));
  };

  const toggleModule = (key: keyof ModuleInfo) => {
    setModules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNext = () => {
    const nextStep = STEPS[stepIndex + 1];
    if (nextStep) setStep(nextStep);
  };

  const handleBack = () => {
    const prevStep = STEPS[stepIndex - 1];
    if (prevStep) setStep(prevStep);
  };

  const handleComplete = async () => {
    if (!workspace?.id) return;
    setSaving(true);
    setError('');

    logger.logCheckpoint('WSP-303', 'STARTED', 'Workspace setup configuration saving...');

    try {
      // Build serialized business_type JSON (matches existing rowToWorkspace parser)
      const businessTypeSerialized = JSON.stringify({
        businessType: company.industry || 'Software',
        saturdayRule: schedule.workingDays.includes(6) ? 'all' : 'off',
        country: schedule.country,
        region: '',
        city: '',
        companyName: company.companyName,
        logoUrl: company.logoUrl,
        shutdowns: [],
      });

      // Build metadata for modules
      const metadata = {
        modules: {
          sprints: modules.sprints,
          finance: modules.finance,
          hr: modules.hr,
          approvals: modules.approvals,
          clientPortal: modules.clientPortal,
        },
        companySize: company.companySize,
      };

      const { error: updateError } = await supabase
        .from('workspaces')
        .update({
          name: company.companyName || workspace.name,
          business_type: businessTypeSerialized,
          work_start: schedule.workStart,
          work_end: schedule.workEnd,
          workdays: schedule.workingDays,
          timezone: schedule.timezone,
          initialized: true,
          status: 'active',
          metadata,
        })
        .eq('id', workspace.id);

      if (updateError) throw updateError;

      // Refresh workspace in React context
      await refreshWorkspace(workspace.id);

      logger.logCheckpoint('WSP-303', 'SUCCESS', 'Workspace setup completed successfully');
      logger.dumpTimeline();

      setStep('complete');

      // Route to user-init after short pause
      setTimeout(() => navigate('/user-init'), 1800);
    } catch (err: any) {
      logger.logCheckpoint('WSP-303', 'FAILED', `Workspace setup configuration failed: ${err.message}`);
      logger.dumpTimeline();
      setError(err?.message || 'Failed to save workspace configuration.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 font-geist">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl mb-6"
      >
        <div className="flex items-center gap-3 mb-1">
          <Settings className="w-5 h-5" style={{ color: 'var(--pm-primary)' }} />
          <span className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Workspace Setup
          </span>
        </div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--pm-on-surface)' }}>
          Configure your workspace
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
          This takes about 2 minutes. You can change everything later in Settings.
        </p>
      </motion.div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 w-full max-w-xl mb-6">
        {STEPS.filter(s => s !== 'complete').map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: stepIndex > i ? 'var(--pm-primary)' : stepIndex === i ? 'var(--pm-primary)' : 'var(--pm-surface-elevated)',
                  color: stepIndex >= i ? 'white' : 'var(--pm-on-surface-variant)',
                  opacity: stepIndex < i ? 0.4 : 1,
                }}
              >
                {stepIndex > i ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className="text-xs font-medium hidden sm:block" style={{ color: stepIndex >= i ? 'var(--pm-on-surface)' : 'var(--pm-on-surface-variant)', opacity: stepIndex < i ? 0.4 : 1 }}>
                {STEP_LABELS[s]}
              </span>
            </div>
            {i < STEPS.filter(s => s !== 'complete').length - 1 && (
              <div className="flex-1 h-px mx-1" style={{ background: 'var(--pm-outline-variant)', opacity: 0.4 }} />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-xl pm-card p-8"
      >
        <AnimatePresence mode="wait">
          {/* ── Company ── */}
          {step === 'company' && (
            <motion.div key="company" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5" style={{ color: 'var(--pm-primary)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Company identity</h2>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Company Name</label>
                <input
                  type="text"
                  value={company.companyName}
                  onChange={e => setCompany(p => ({ ...p, companyName: e.target.value }))}
                  placeholder={workspace?.name || 'Acme Corp'}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Industry</label>
                <select
                  value={company.industry}
                  onChange={e => setCompany(p => ({ ...p, industry: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                >
                  <option value="">Select industry…</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Team Size</label>
                <div className="flex gap-2 flex-wrap">
                  {COMPANY_SIZES.map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setCompany(p => ({ ...p, companySize: size }))}
                      className="px-4 py-1.5 rounded-lg border text-xs font-medium transition-all"
                      style={{
                        background: company.companySize === size ? 'var(--pm-primary)' : 'var(--pm-surface-lowest)',
                        borderColor: company.companySize === size ? 'var(--pm-primary)' : 'rgba(70,69,84,0.3)',
                        color: company.companySize === size ? 'white' : 'var(--pm-on-surface-variant)',
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Logo URL <span className="opacity-50">(optional)</span></label>
                <input
                  type="url"
                  value={company.logoUrl}
                  onChange={e => setCompany(p => ({ ...p, logoUrl: e.target.value }))}
                  placeholder="https://company.com/logo.png"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                />
              </div>

              <button onClick={handleNext} className="w-full rounded-xl h-11 flex items-center justify-center gap-2 font-semibold uppercase tracking-wide text-xs transition-all active:scale-[0.98]"
                style={{ background: 'var(--pm-primary)', color: 'white' }}>
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* ── Schedule ── */}
          {step === 'schedule' && (
            <motion.div key="schedule" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5" style={{ color: 'var(--pm-primary)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Working hours</h2>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--pm-on-surface-variant)' }}>Working Days</label>
                <div className="flex gap-2">
                  {WORKDAYS.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleWorkday(d.value)}
                      className="flex-1 py-2 rounded-lg border text-xs font-medium transition-all"
                      style={{
                        background: schedule.workingDays.includes(d.value) ? 'var(--pm-primary)' : 'var(--pm-surface-lowest)',
                        borderColor: schedule.workingDays.includes(d.value) ? 'var(--pm-primary)' : 'rgba(70,69,84,0.3)',
                        color: schedule.workingDays.includes(d.value) ? 'white' : 'var(--pm-on-surface-variant)',
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Work Start</label>
                  <input type="time" value={schedule.workStart} onChange={e => setSchedule(p => ({ ...p, workStart: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                    style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Work End</label>
                  <input type="time" value={schedule.workEnd} onChange={e => setSchedule(p => ({ ...p, workEnd: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                    style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Timezone</label>
                <select value={schedule.timezone} onChange={e => setSchedule(p => ({ ...p, timezone: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}>
                  {Intl.supportedValuesOf('timeZone').map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Country <span className="opacity-50">(for holiday calendar)</span></label>
                <select value={schedule.country} onChange={e => setSchedule(p => ({ ...p, country: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}>
                  <option value="">Select country…</option>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>

              <div className="flex gap-3">
                <button onClick={handleBack} className="flex-1 rounded-xl h-11 flex items-center justify-center gap-2 border text-xs font-semibold uppercase tracking-wide transition-all"
                  style={{ borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface-variant)' }}>
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={handleNext} className="flex-1 rounded-xl h-11 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide transition-all active:scale-[0.98]"
                  style={{ background: 'var(--pm-primary)', color: 'white' }}>
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Modules ── */}
          {step === 'modules' && (
            <motion.div key="modules" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Puzzle className="w-5 h-5" style={{ color: 'var(--pm-primary)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Enable modules</h2>
              </div>
              <p className="text-xs -mt-2" style={{ color: 'var(--pm-on-surface-variant)' }}>
                Enable only what your team needs now. More can be activated later in Settings.
              </p>

              {([
                { key: 'sprints', label: 'Sprint Planning', desc: 'Agile sprints, velocity tracking' },
                { key: 'finance', label: 'Finance', desc: 'Budgets, invoices, payroll' },
                { key: 'hr', label: 'HR & Attendance', desc: 'Leave, contracts, onboarding' },
                { key: 'approvals', label: 'Approval Workflows', desc: 'Multi-step approval chains' },
                { key: 'clientPortal', label: 'Client Portal', desc: 'External client view access' },
              ] as { key: keyof ModuleInfo; label: string; desc: string }[]).map(({ key, label, desc }) => (
                <div
                  key={key}
                  onClick={() => toggleModule(key)}
                  className="flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all"
                  style={{
                    background: modules[key] ? 'rgba(var(--pm-primary-rgb, 99,102,241), 0.08)' : 'var(--pm-surface-lowest)',
                    borderColor: modules[key] ? 'var(--pm-primary)' : 'rgba(70,69,84,0.3)',
                  }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--pm-on-surface)' }}>{label}</p>
                    <p className="text-xs" style={{ color: 'var(--pm-on-surface-variant)' }}>{desc}</p>
                  </div>
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                    style={{
                      borderColor: modules[key] ? 'var(--pm-primary)' : 'rgba(70,69,84,0.5)',
                      background: modules[key] ? 'var(--pm-primary)' : 'transparent',
                    }}
                  >
                    {modules[key] && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                </div>
              ))}

              {error && (
                <p className="text-xs text-center" style={{ color: 'var(--pm-error)' }}>{error}</p>
              )}

              <div className="flex gap-3">
                <button onClick={handleBack} className="flex-1 rounded-xl h-11 flex items-center justify-center gap-2 border text-xs font-semibold uppercase tracking-wide transition-all"
                  style={{ borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface-variant)' }}>
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="flex-1 rounded-xl h-11 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{ background: 'var(--pm-primary)', color: 'white' }}>
                  {saving ? <><Loader className="w-4 h-4 animate-spin" /> Saving…</> : 'Complete Setup'}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Complete ── */}
          {step === 'complete' && (
            <motion.div key="complete" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-10 space-y-4">
              <CheckCircle className="w-14 h-14 mx-auto text-emerald-400" />
              <h2 className="text-xl font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Workspace Ready</h2>
              <p className="text-sm" style={{ color: 'var(--pm-on-surface-variant)' }}>
                Taking you to profile setup…
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <p className="text-xs mt-6 text-center" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.5 }}>
        Resolve PM — Enterprise Project Management
      </p>
    </div>
  );
}
