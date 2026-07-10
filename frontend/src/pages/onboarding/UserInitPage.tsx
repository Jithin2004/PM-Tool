import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Phone, Camera, Palette, Bell, ChevronRight, ChevronLeft, CheckCircle, Loader } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { navigate } from '../../lib/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'personal' | 'preferences' | 'complete';

interface PersonalInfo {
  fullName: string;
  phone: string;
  avatarUrl: string;
}

interface PreferenceInfo {
  timezone: string;
  theme: 'dark' | 'light' | 'system';
  defaultView: 'kanban' | 'list' | 'timeline' | 'calendar';
  emailNotifications: boolean;
}

const STEPS: Step[] = ['personal', 'preferences', 'complete'];

const THEMES: { value: PreferenceInfo['theme']; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
];

const VIEWS: { value: PreferenceInfo['defaultView']; label: string; desc: string }[] = [
  { value: 'kanban', label: 'Kanban', desc: 'Cards in swim lanes' },
  { value: 'list', label: 'List', desc: 'Spreadsheet-style rows' },
  { value: 'timeline', label: 'Timeline', desc: 'Gantt-style timeline' },
  { value: 'calendar', label: 'Calendar', desc: 'Calendar view' },
];

// ── Avatar initials helper ─────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map(p => p[0]?.toUpperCase() || '')
    .slice(0, 2)
    .join('');
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UserInitPage() {
  const { profile, setProfile } = useAuth();
  const [step, setStep] = useState<Step>('personal');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [personal, setPersonal] = useState<PersonalInfo>({
    fullName: profile?.full_name || '',
    phone: (profile as any)?.phone || '',
    avatarUrl: profile?.avatar_url || '',
  });

  const [prefs, setPrefs] = useState<PreferenceInfo>({
    timezone: (profile as any)?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    theme: (profile as any)?.theme || 'dark',
    defaultView: (profile as any)?.default_view || 'kanban',
    emailNotifications: true,
  });

  const stepIndex = STEPS.indexOf(step);

  const handleNext = () => {
    if (!personal.fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    setError('');
    const nextStep = STEPS[stepIndex + 1];
    if (nextStep) setStep(nextStep);
  };

  const handleBack = () => {
    setError('');
    const prevStep = STEPS[stepIndex - 1];
    if (prevStep) setStep(prevStep);
  };

  const handleComplete = async () => {
    if (!profile?.id) return;
    setSaving(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: personal.fullName.trim(),
          phone: personal.phone.trim() || null,
          avatar_url: personal.avatarUrl.trim() || null,
          // Store preferences in metadata column
          metadata: {
            ...(profile as any)?.metadata,
            preferences: {
              timezone: prefs.timezone,
              theme: prefs.theme,
              defaultView: prefs.defaultView,
              emailNotifications: prefs.emailNotifications,
            },
          },
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // Optimistically update auth context so the profile gate is cleared
      if (setProfile) {
        setProfile({
          ...(profile as any),
          full_name: personal.fullName.trim(),
          avatar_url: personal.avatarUrl.trim() || null,
          metadata: {
            ...(profile as any)?.metadata,
            preferences: {
              timezone: prefs.timezone,
              theme: prefs.theme,
              defaultView: prefs.defaultView,
              emailNotifications: prefs.emailNotifications,
            },
          },
        } as any);
      }

      setStep('complete');
      setTimeout(() => navigate('/overview'), 1600);
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const initials = getInitials(personal.fullName || profile?.full_name || profile?.email || 'U');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 font-geist">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mb-6"
      >
        <div className="flex items-center gap-3 mb-1">
          <User className="w-5 h-5" style={{ color: 'var(--pm-primary)' }} />
          <span className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Profile Setup
          </span>
        </div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--pm-on-surface)' }}>
          Welcome, {personal.fullName.split(' ')[0] || 'there'}!
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
          Set up your profile to get started. Takes less than a minute.
        </p>
      </motion.div>

      {/* Step pills */}
      <div className="flex items-center gap-3 w-full max-w-md mb-5">
        {(['personal', 'preferences'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all"
              style={{
                background: stepIndex > i ? 'var(--pm-primary)' : stepIndex === i ? 'var(--pm-primary)' : 'var(--pm-surface-elevated)',
                color: stepIndex >= i ? 'white' : 'var(--pm-on-surface-variant)',
                opacity: stepIndex < i ? 0.4 : 1,
              }}
            >
              {stepIndex > i ? <CheckCircle className="w-3 h-3" /> : i + 1}
            </div>
            <span className="text-xs font-medium capitalize" style={{ color: stepIndex >= i ? 'var(--pm-on-surface)' : 'var(--pm-on-surface-variant)', opacity: stepIndex < i ? 0.4 : 1 }}>
              {s === 'personal' ? 'Identity' : 'Preferences'}
            </span>
            {i === 0 && <div className="w-12 h-px mx-1" style={{ background: 'var(--pm-outline-variant)', opacity: 0.4 }} />}
          </div>
        ))}
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-md pm-card p-8"
      >
        <AnimatePresence mode="wait">
          {/* ── Personal ── */}
          {step === 'personal' && (
            <motion.div key="personal" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5" style={{ color: 'var(--pm-primary)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Your identity</h2>
              </div>

              {/* Avatar preview */}
              <div className="flex justify-center mb-2">
                {personal.avatarUrl ? (
                  <img src={personal.avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2" style={{ borderColor: 'var(--pm-primary)' }} />
                ) : (
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-2"
                    style={{ background: 'var(--pm-surface-elevated)', borderColor: 'var(--pm-outline-variant)', color: 'var(--pm-on-surface)' }}
                  >
                    {initials || <Camera className="w-8 h-8 opacity-30" />}
                  </div>
                )}
              </div>

              {error && (
                <p className="text-xs text-center" style={{ color: 'var(--pm-error)' }}>{error}</p>
              )}

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={personal.fullName}
                  onChange={e => setPersonal(p => ({ ...p, fullName: e.target.value }))}
                  placeholder="Jane Smith"
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Phone <span className="opacity-50">(optional)</span></label>
                <input
                  type="tel"
                  value={personal.phone}
                  onChange={e => setPersonal(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+1 555 000 0000"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Avatar URL <span className="opacity-50">(optional)</span></label>
                <input
                  type="url"
                  value={personal.avatarUrl}
                  onChange={e => setPersonal(p => ({ ...p, avatarUrl: e.target.value }))}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                />
              </div>

              <button
                onClick={handleNext}
                className="w-full rounded-xl h-11 flex items-center justify-center gap-2 font-semibold uppercase tracking-wide text-xs transition-all active:scale-[0.98]"
                style={{ background: 'var(--pm-primary)', color: 'white' }}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* ── Preferences ── */}
          {step === 'preferences' && (
            <motion.div key="preferences" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Palette className="w-5 h-5" style={{ color: 'var(--pm-primary)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Your preferences</h2>
              </div>

              {/* Theme */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--pm-on-surface-variant)' }}>Theme</label>
                <div className="flex gap-2">
                  {THEMES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPrefs(p => ({ ...p, theme: value }))}
                      className="flex-1 py-2 rounded-lg border text-xs font-medium transition-all"
                      style={{
                        background: prefs.theme === value ? 'var(--pm-primary)' : 'var(--pm-surface-lowest)',
                        borderColor: prefs.theme === value ? 'var(--pm-primary)' : 'rgba(70,69,84,0.3)',
                        color: prefs.theme === value ? 'white' : 'var(--pm-on-surface-variant)',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default view */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--pm-on-surface-variant)' }}>Default board view</label>
                <div className="grid grid-cols-2 gap-2">
                  {VIEWS.map(({ value, label, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPrefs(p => ({ ...p, defaultView: value }))}
                      className="p-3 rounded-xl border text-left transition-all"
                      style={{
                        background: prefs.defaultView === value ? 'rgba(var(--pm-primary-rgb, 99,102,241), 0.1)' : 'var(--pm-surface-lowest)',
                        borderColor: prefs.defaultView === value ? 'var(--pm-primary)' : 'rgba(70,69,84,0.3)',
                      }}
                    >
                      <p className="text-xs font-semibold" style={{ color: prefs.defaultView === value ? 'var(--pm-primary)' : 'var(--pm-on-surface)' }}>{label}</p>
                      <p className="text-xs opacity-60 mt-0.5" style={{ color: 'var(--pm-on-surface-variant)' }}>{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Timezone</label>
                <select
                  value={prefs.timezone}
                  onChange={e => setPrefs(p => ({ ...p, timezone: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                >
                  {Intl.supportedValuesOf('timeZone').map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>

              {/* Email notifications */}
              <div
                className="flex items-center justify-between p-4 rounded-xl border cursor-pointer"
                onClick={() => setPrefs(p => ({ ...p, emailNotifications: !p.emailNotifications }))}
                style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)' }}
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4" style={{ color: 'var(--pm-on-surface-variant)' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--pm-on-surface)' }}>Email notifications</p>
                    <p className="text-xs" style={{ color: 'var(--pm-on-surface-variant)' }}>Task updates, mentions, and deadlines</p>
                  </div>
                </div>
                <div
                  className="w-9 h-5 rounded-full relative transition-all"
                  style={{ background: prefs.emailNotifications ? 'var(--pm-primary)' : 'rgba(70,69,84,0.4)' }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                    style={{ left: prefs.emailNotifications ? 'calc(100% - 18px)' : '2px' }}
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-center" style={{ color: 'var(--pm-error)' }}>{error}</p>
              )}

              <div className="flex gap-3">
                <button onClick={handleBack}
                  className="flex-1 rounded-xl h-11 flex items-center justify-center gap-2 border text-xs font-semibold uppercase tracking-wide transition-all"
                  style={{ borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface-variant)' }}>
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="flex-1 rounded-xl h-11 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{ background: 'var(--pm-primary)', color: 'white' }}>
                  {saving ? <><Loader className="w-4 h-4 animate-spin" /> Saving…</> : 'Enter Workspace'}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Complete ── */}
          {step === 'complete' && (
            <motion.div key="complete" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-10 space-y-4">
              <CheckCircle className="w-14 h-14 mx-auto text-emerald-400" />
              <h2 className="text-xl font-semibold" style={{ color: 'var(--pm-on-surface)' }}>You're all set!</h2>
              <p className="text-sm" style={{ color: 'var(--pm-on-surface-variant)' }}>Loading your dashboard…</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <p className="text-xs mt-6 text-center" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.5 }}>
        You can update these settings anytime from your profile menu.
      </p>
    </div>
  );
}
