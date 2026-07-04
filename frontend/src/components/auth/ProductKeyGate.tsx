import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, CheckCircle, XCircle, Loader, AlertCircle, KeyRound } from 'lucide-react';
import { validateNewActivationKey } from '../../lib/productKey';
import { showAlert } from '../../components/common/Dialogs';
import { useAuth } from '../../context/AuthContext';

interface ProductKeyGateProps {
  onVerified: () => void;
}

type GateState = 'input' | 'verifying' | 'success' | 'signup' | 'error';

export function ProductKeyGate({ onVerified }: ProductKeyGateProps) {
  const [key, setKey] = useState('');
  const [state, setState] = useState<GateState>('input');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);
  const { user, logout } = useAuth() || {};

  const handleReturnHome = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (user && logout) {
      await logout();
    }
    window.location.href = '/';
  };

  // Signup Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState('');

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (import.meta.env.DEV) {
        setKey('X7K-9M2-V4P-8LQ');
      }
    }
  }, []);

  useEffect(() => {
    // Restore session if user refreshes during signup
    const pendingStr = sessionStorage.getItem('pendingLicenseActivation');
    if (pendingStr && state === 'input') {
      try {
        const parsed = JSON.parse(pendingStr);
        if (parsed.validated) {
          setState('signup');
        }
      } catch (e) { }
    }
  }, [state]);

  useEffect(() => {
    if (state === 'error' && key) {
      setState('input');
      setErrorMsg('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // ── Product key verification ──────────────────────────────
  const handleVerifyKey = useCallback(async () => {
    if (!key.trim()) return;
    setState('verifying');
    setErrorMsg('');

    const result = await validateNewActivationKey(key.trim());

    if (result.success) {
      const seats = 9999;
      sessionStorage.setItem('pendingLicenseActivation', JSON.stringify({
        productKey: key.trim(),
        licenseId: result.token || key.trim(),
        plan: result.plan || 'standard',
        seats: seats,
        validatedAt: new Date().toISOString(),
        validated: true
      }));
      setState('signup');
    } else {
      setErrorMsg(result.error || 'Verification failed.');
      setState('error');
    }
  }, [key, onVerified]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleVerifyKey();
  }, [handleVerifyKey]);

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');

    if (password !== confirmPassword) {
      setSignupError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setSignupError('Password must be at least 8 characters');
      return;
    }

    setSignupLoading(true);
    try {
      const { supabase } = await import('../../lib/supabase');

      let authUser: any = null;
      const signUpResult = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (signUpResult.error) {
        const errMsg = signUpResult.error.message?.toLowerCase() || '';
        const errCode = signUpResult.error.code || '';
        if (
          errMsg.includes('already registered') ||
          errMsg.includes('already exists') ||
          errCode === 'user_already_exists'
        ) {
          // Recovery Flow: Attempt login with the password provided
          const loginResult = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (loginResult.error) {
            throw new Error(`This email is already registered. Recovery login attempt failed: ${loginResult.error.message}`);
          }

          authUser = loginResult.data?.user;
        } else {
          throw signUpResult.error;
        }
      } else {
        authUser = signUpResult.data?.user;
      }

      if (!authUser) {
        throw new Error('User authentication succeeded but user credentials could not be loaded.');
      }

      // Verify if public profile already exists
      const profileCheck = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileCheck.error) {
        throw new Error(`Profile check failed: ${profileCheck.error.message}`);
      }

      // If profile is missing, create/repair it immediately
      if (!profileCheck.data) {
        const profileInsert = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email || email,
            full_name: fullName,
            role: 'pending-workspace-setup',
            availability_factor: 1,
            status: 'active'
          });

        if (profileInsert.error) {
          throw new Error(`Failed to create user profile: ${profileInsert.error.message}`);
        }
      }

      sessionStorage.setItem('pending_workspace_name', workspaceName);

      setState('success');
      setTimeout(() => onVerified(), 1200);
    } catch (err: any) {
      setSignupError(err.message || 'Failed to create or verify owner account');
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6 relative overflow-hidden font-geist">
      {/* Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-md pm-card p-10 relative z-10"
      >
        {/* Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-[var(--pm-surface-elevated)]/5 border flex items-center justify-center rounded-xl mb-6 shadow-sm"
            style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
            <Shield className="w-8 h-8" style={{ color: 'var(--pm-primary)' }} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: 'var(--pm-on-surface)' }}>RESOLVE PM</h1>
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--pm-on-surface-variant)' }}>Product Activation</p>
        </div>

        {/* Gate Content */}
        <div className="mt-6">
          <AnimatePresence mode="wait">

            {/* ── Product Key Input ── */}
            {state === 'input' && (
              <motion.div key="key-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                  style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)' }}>
                  <KeyRound className="w-4 h-4 shrink-0" style={{ color: 'var(--pm-on-surface-variant)' }} />
                  <input
                    ref={inputRef}
                    type="text"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter your product key"
                    className="flex-1 bg-transparent text-sm font-mono-pm outline-none placeholder:opacity-50"
                    style={{ color: 'var(--pm-on-surface)' }}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {errorMsg && (
                  <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--pm-error)' }}>
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  onClick={handleVerifyKey}
                  disabled={!key.trim()}
                  className={`w-full rounded-xl h-12 flex items-center justify-center gap-3 font-semibold uppercase tracking-wide text-xs transition-all active:scale-[0.98] shadow-sm hover:shadow-md ${key.trim() ? 'opacity-100' : 'opacity-50 cursor-not-allowed'}`}
                  style={{ background: 'var(--pm-primary)', color: 'white' }}
                >
                  Activate License
                </button>
              </motion.div>
            )}

            {/* ── Verifying ── */}
            {state === 'verifying' && (
              <motion.div key="verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-6">
                <Loader className="w-8 h-8 mx-auto mb-4 animate-spin" style={{ color: 'var(--pm-primary)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--pm-on-surface-variant)' }}>
                  Verifying product key...
                </p>
              </motion.div>
            )}

            {/* ── Success ── */}
            {state === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-center py-6"
              >
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
                <p className="text-lg font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Account Created</p>
                <p className="text-sm mt-2" style={{ color: 'var(--pm-on-surface-variant)' }}>Initializing workspace...</p>
              </motion.div>
            )}

            {/* ── Signup ── */}
            {state === 'signup' && (
              <motion.div key="signup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold" style={{ color: 'var(--pm-on-surface)' }}>Owner Account Creation</h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>License verified. Create your administrative account.</p>
                </div>

                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  {signupError && (
                    <div className="p-3 rounded-lg text-sm flex items-start gap-2" style={{ background: 'var(--pm-error-container)', color: 'var(--pm-on-error-container)' }}>
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{signupError}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--pm-on-surface-variant)] mb-1">Owner Full Name *</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        placeholder="Enter full name"
                        className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all"
                        style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--pm-on-surface-variant)] mb-1">Work Email *</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Enter work email"
                        className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all"
                        style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--pm-on-surface-variant)] mb-1">Workspace Name *</label>
                      <input
                        type="text"
                        required
                        value={workspaceName}
                        onChange={e => setWorkspaceName(e.target.value)}
                        placeholder="Enter workspace name"
                        className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all"
                        style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                      />
                    </div>
                    <div className="relative">
                      <label className="block text-xs font-medium text-[var(--pm-on-surface-variant)] mb-1">Password *</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Create password"
                        className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all"
                        style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-9 text-xs font-semibold" style={{ color: 'var(--pm-primary)' }}>
                        {showPassword ? 'HIDE' : 'SHOW'}
                      </button>
                    </div>
                    <div className="relative">
                      <label className="block text-xs font-medium text-[var(--pm-on-surface-variant)] mb-1">Confirm Password *</label>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all"
                        style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-9 text-xs font-semibold" style={{ color: 'var(--pm-primary)' }}>
                        {showConfirmPassword ? 'HIDE' : 'SHOW'}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={signupLoading || password !== confirmPassword || !password}
                    className={`w-full rounded-xl h-12 flex items-center justify-center gap-2 font-semibold uppercase tracking-wide text-xs transition-all shadow-sm ${signupLoading ? 'opacity-70' : 'hover:shadow-md'}`}
                    style={{ background: 'var(--pm-primary)', color: 'white' }}
                  >
                    {signupLoading ? <Loader className="w-4 h-4 animate-spin" /> : 'Create Account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.removeItem('pendingLicenseActivation');
                      setState('input');
                    }}
                    className="w-full text-xs font-medium text-center hover:underline mt-2 transition-colors"
                    style={{ color: 'var(--pm-on-surface-variant)' }}
                  >
                    Cancel and use a different key
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── Error (with retry) ── */}
            {state === 'error' && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                <div className="text-center py-4">
                  <XCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--pm-error)' }} />
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--pm-error)' }}>Verification failed</p>
                  {errorMsg && (
                    <p className="text-xs mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>{errorMsg}</p>
                  )}
                </div>
                <button
                  onClick={() => { setState('input'); setErrorMsg(''); }}
                  className="w-full rounded-xl h-12 flex items-center justify-center gap-3 font-semibold uppercase tracking-wide text-xs transition-all active:scale-[0.98]"
                  style={{ background: 'var(--pm-surface-high)', color: 'var(--pm-on-surface)', border: '1px solid rgba(70,69,84,0.3)' }}
                >
                  Try Again
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Bottom Options */}
        <div className="mt-8 pt-6 border-t" style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
          <p className="text-xs text-center font-medium mb-4" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Don't have a license?
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => showAlert('Access request workflow initiated (Demo)')}
              className="w-full rounded-lg h-10 flex items-center justify-center gap-2 text-xs font-medium transition-colors hover:bg-[var(--pm-surface)]/5"
              style={{ color: 'var(--pm-primary)', border: '1px solid rgba(70,69,84,0.3)' }}
            >
              Request Access
            </button>
            <a
              href="/"
              onClick={handleReturnHome}
              className="w-full rounded-lg h-10 flex items-center justify-center gap-2 text-xs font-medium transition-colors hover:bg-[var(--pm-surface)]/5 mt-2"
              style={{ color: 'var(--pm-on-surface-variant)' }}
            >
              Return Home
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
