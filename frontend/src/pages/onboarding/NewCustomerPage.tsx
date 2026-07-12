import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, KeyRound, CheckCircle, XCircle, Loader, AlertCircle, Eye, EyeOff
} from 'lucide-react';
import { validateNewActivationKey, onboardWorkspaceTransaction } from '../../lib/productKey';
import { supabase } from '../../lib/supabase';
import { navigate } from '../../lib/navigation';
import { logger } from '../../lib/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

type PageState =
  | 'key_input'     // enter product key
  | 'key_verifying' // POST /verify in flight
  | 'account_form'  // key verified; fill account + workspace
  | 'submitting'    // POST /onboard in flight
  | 'signing_in'    // supabase.auth.signInWithPassword
  | 'done'          // bootstrap will route to /workspace-init
  | 'error';

interface FormData {
  fullName: string;
  email: string;
  workspaceName: string;
  password: string;
  confirmPassword: string;
}

// ── Utility ───────────────────────────────────────────────────────────────────

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NewCustomerPage() {
  const [pageState, setPageState] = useState<PageState>('key_input');
  const [productKey, setProductKey] = useState('');
  const [verifiedKey, setVerifiedKey] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState<FormData>({
    fullName: '',
    email: '',
    workspaceName: '',
    password: '',
    confirmPassword: '',
  });
  const workspaceIdRef = useRef<string>(generateUUID());

  // Dev shortcut — pre-fills test key
  useEffect(() => {
    if (import.meta.env.DEV) {
      setProductKey('X7K-9M2-V4P-8LQ');
    }
  }, []);

  const updateForm = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  // ── Step 1: Verify product key ─────────────────────────────────────────────

  const handleVerifyKey = useCallback(async () => {
    if (!productKey.trim()) return;
    setError('');
    setPageState('key_verifying');

    const result = await validateNewActivationKey(productKey.trim());
    if (result.success) {
      setVerifiedKey(productKey.trim());
      setPageState('account_form');
    } else {
      setError(result.error || 'Key verification failed.');
      setPageState('error');
    }
  }, [productKey]);

  // ── Step 2: Create account + workspace (single atomic submit) ──────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setPageState('submitting');

    const correlationId = self.crypto.randomUUID();
    const runId = self.crypto.randomUUID();
    sessionStorage.setItem('resolve_pm_correlation_id', correlationId);
    sessionStorage.setItem('resolve_pm_run_id', runId);

    const ctx = logger.createContext(
      correlationId,
      runId,
      { email: form.email.trim() },
      { id: workspaceIdRef.current, name: form.workspaceName.trim() },
      { productKey: verifiedKey }
    );
    logger.startTimeline(ctx);

    try {
      // 1. Create Supabase auth user
      let accessToken: string | null = null;

      logger.logCheckpoint('AUTH-101', 'STARTED', 'Supabase Auth signUp request started');

      const signUpResult = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.fullName.trim() } },
      });

      if (signUpResult.error) {
        const msg = signUpResult.error.message?.toLowerCase() ?? '';
        if (msg.includes('already registered') || msg.includes('already exists')) {
          logger.logCheckpoint('AUTH-101', 'SKIPPED', 'Email registered: attempting password sign-in recovery path');
          
          logger.logCheckpoint('AUTH-103', 'STARTED', 'Supabase Auth signInWithPassword started');
          const signInResult = await supabase.auth.signInWithPassword({
            email: form.email.trim(),
            password: form.password,
          });
          if (signInResult.error) {
            logger.logCheckpoint('AUTH-103', 'FAILED', `Recovery password sign-in failed: ${signInResult.error.message}`);
            throw new Error(
              `This email is already registered. Please log in at /login instead.`
            );
          }
          logger.logCheckpoint('AUTH-103', 'SUCCESS', 'Supabase Auth signInWithPassword verified');
          accessToken = signInResult.data.session?.access_token ?? null;
        } else {
          logger.logCheckpoint('AUTH-101', 'FAILED', `Supabase Auth signUp failed: ${signUpResult.error.message}`);
          throw signUpResult.error;
        }
      } else {
        logger.logCheckpoint('AUTH-101', 'SUCCESS', 'Supabase Auth signUp completed');
        accessToken = signUpResult.data.session?.access_token ?? null;
      }

      if (!accessToken) {
        throw new Error('Failed to obtain access token after sign-up. Please try again.');
      }

      // 2. Single atomic backend call — MongoDB activation + PG workspace + user + license
      logger.logCheckpoint('WSP-301', 'STARTED', 'Provisioning request initiated via HTTP');
      await onboardWorkspaceTransaction(
        {
          workspaceId: workspaceIdRef.current,
          workspaceName: form.workspaceName.trim(),
          productKey: verifiedKey,
        },
        accessToken
      );

      // 3. Ensure fresh authenticated session
      setPageState('signing_in');
      const finalSignIn = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      if (finalSignIn.error) {
        setError('Workspace created successfully. Please log in to continue.');
        logger.logCheckpoint('WSP-302', 'FAILED', `Session establishment failed: ${finalSignIn.error.message}`);
        logger.dumpTimeline();
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      logger.logCheckpoint('WSP-302', 'SUCCESS', 'Onboarding completed successfully');
      logger.dumpTimeline();
      setPageState('done');
      setTimeout(() => navigate('/workspace-init'), 2000);
    } catch (err: any) {
      logger.logCheckpoint('WSP-302', 'FAILED', `Onboarding workflow failed: ${err?.message}`);
      logger.dumpTimeline();
      setError(err?.message || 'Setup failed. Please try again.');
      setPageState('error');
    }
  };

  const resetToKeyInput = () => {
    setPageState('key_input');
    setError('');
    setVerifiedKey('');
    workspaceIdRef.current = generateUUID(); // fresh workspace ID for any retry
  };

  const resetToAccountForm = () => {
    setPageState('account_form');
    setError('');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden font-geist">
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-md pm-card p-10 relative z-10"
      >
        {/* Branding header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div
            className="w-16 h-16 flex items-center justify-center rounded-xl mb-6 shadow-sm"
            style={{
              background: 'var(--pm-surface-elevated, rgba(255,255,255,0.04))',
              border: '1px solid rgba(70,69,84,0.3)',
            }}
          >
            <Shield className="w-8 h-8" style={{ color: 'var(--pm-primary)' }} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: 'var(--pm-on-surface)' }}>
            RESOLVE PM
          </h1>
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Product Activation
          </p>
        </div>

        <AnimatePresence mode="wait">
          {/* ── Key Input ── */}
          {pageState === 'key_input' && (
            <motion.div key="key_input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--pm-on-surface-variant)' }}>
                  Product Key
                </label>
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                  style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)' }}
                >
                  <KeyRound className="w-4 h-4 shrink-0" style={{ color: 'var(--pm-on-surface-variant)' }} />
                  <input
                    type="text"
                    value={productKey}
                    onChange={e => setProductKey(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleVerifyKey()}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    className="flex-1 bg-transparent text-sm font-mono outline-none placeholder:opacity-40"
                    style={{ color: 'var(--pm-on-surface)' }}
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus
                  />
                </div>
              </div>
              <button
                onClick={handleVerifyKey}
                disabled={!productKey.trim()}
                className="w-full rounded-xl h-12 flex items-center justify-center gap-2 font-semibold uppercase tracking-wide text-xs transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--pm-primary)', color: 'white' }}
              >
                Verify License Key
              </button>
              <p className="text-xs text-center" style={{ color: 'var(--pm-on-surface-variant)' }}>
                Already have an account?{' '}
                <a href="/login" className="underline hover:opacity-80 transition-opacity">Sign in</a>
              </p>
            </motion.div>
          )}

          {/* ── Verifying key ── */}
          {pageState === 'key_verifying' && (
            <motion.div key="key_verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
              <Loader className="w-8 h-8 mx-auto mb-4 animate-spin" style={{ color: 'var(--pm-primary)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--pm-on-surface-variant)' }}>
                Verifying product key…
              </p>
            </motion.div>
          )}

          {/* ── Account + Workspace Form ── */}
          {pageState === 'account_form' && (
            <motion.div key="account_form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Key confirmed badge */}
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-medium text-emerald-400">License verified</span>
                <code className="text-xs font-mono text-emerald-300/70 ml-auto truncate max-w-[140px]">{verifiedKey}</code>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg text-sm" style={{ background: 'var(--pm-error-container)', color: 'var(--pm-on-error-container)' }}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Owner Full Name *</label>
                  <input type="text" required value={form.fullName} onChange={updateForm('fullName')} placeholder="Jane Smith"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                    style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Work Email *</label>
                  <input type="email" required value={form.email} onChange={updateForm('email')} placeholder="jane@company.com"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                    style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Workspace Name *</label>
                  <input type="text" required value={form.workspaceName} onChange={updateForm('workspaceName')} placeholder="Acme Corp"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                    style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }} />
                </div>
                <div className="relative">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Password *</label>
                  <input type={showPassword ? 'text' : 'password'} required value={form.password} onChange={updateForm('password')} placeholder="At least 8 characters"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl border text-sm focus:outline-none"
                    style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-7 opacity-40 hover:opacity-80 transition-opacity">
                    {showPassword ? <EyeOff className="w-4 h-4" style={{ color: 'var(--pm-on-surface)' }} /> : <Eye className="w-4 h-4" style={{ color: 'var(--pm-on-surface)' }} />}
                  </button>
                </div>
                <div className="relative">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Confirm Password *</label>
                  <input type={showConfirmPassword ? 'text' : 'password'} required value={form.confirmPassword} onChange={updateForm('confirmPassword')} placeholder="Repeat password"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl border text-sm focus:outline-none"
                    style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }} />
                  <button type="button" onClick={() => setShowConfirmPassword(v => !v)} className="absolute right-3 top-7 opacity-40 hover:opacity-80 transition-opacity">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" style={{ color: 'var(--pm-on-surface)' }} /> : <Eye className="w-4 h-4" style={{ color: 'var(--pm-on-surface)' }} />}
                  </button>
                </div>

                <button type="submit"
                  className="w-full rounded-xl h-12 flex items-center justify-center gap-2 font-semibold uppercase tracking-wide text-xs transition-all active:scale-[0.98] mt-2"
                  style={{ background: 'var(--pm-primary)', color: 'white' }}>
                  Create Account &amp; Workspace
                </button>
                <button type="button" onClick={resetToKeyInput}
                  className="w-full text-xs text-center hover:underline transition-colors"
                  style={{ color: 'var(--pm-on-surface-variant)' }}>
                  Use a different product key
                </button>
              </form>
            </motion.div>
          )}

          {/* ── Submitting / Signing In ── */}
          {(pageState === 'submitting' || pageState === 'signing_in') && (
            <motion.div key="submitting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-10 space-y-3">
              <Loader className="w-8 h-8 mx-auto animate-spin" style={{ color: 'var(--pm-primary)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--pm-on-surface-variant)' }}>
                {pageState === 'submitting' ? 'Creating your workspace…' : 'Signing you in…'}
              </p>
              <p className="text-xs opacity-50" style={{ color: 'var(--pm-on-surface-variant)' }}>This takes just a moment</p>
            </motion.div>
          )}

          {/* ── Done ── */}
          {pageState === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-10 space-y-3">
              <CheckCircle className="w-12 h-12 mx-auto text-emerald-400" />
              <p className="text-lg font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Workspace Created</p>
              <p className="text-sm opacity-60" style={{ color: 'var(--pm-on-surface-variant)' }}>Loading your workspace…</p>
            </motion.div>
          )}

          {/* ── Error ── */}
          {pageState === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
              <div className="text-center py-4">
                <XCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--pm-error)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--pm-error)' }}>Setup failed</p>
                {error && <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--pm-on-surface-variant)' }}>{error}</p>}
              </div>
              <button
                onClick={verifiedKey ? resetToAccountForm : resetToKeyInput}
                className="w-full rounded-xl h-11 flex items-center justify-center gap-2 font-semibold uppercase tracking-wide text-xs transition-all"
                style={{ background: 'var(--pm-primary)', color: 'white' }}>
                Try Again
              </button>
              <a href="/" className="block text-xs text-center hover:underline transition-colors" style={{ color: 'var(--pm-on-surface-variant)' }}>
                Return Home
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
