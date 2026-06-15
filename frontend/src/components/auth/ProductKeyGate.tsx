import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, CheckCircle, XCircle, Loader, AlertCircle, KeyRound, Upload, FileCheck } from 'lucide-react';
import { verifyProductKey, verifyLicenseFile } from '../../lib/productKey';
import { showAlert } from '../../components/common/Dialogs';

interface ProductKeyGateProps {
  onVerified: () => void;
}

type GateState = 'input' | 'verifying' | 'success' | 'signup' | 'error';
type GateMode = 'key' | 'file';

export function ProductKeyGate({ onVerified }: ProductKeyGateProps) {
  const [mode, setMode] = useState<GateMode>('key');
  const [key, setKey] = useState('');
  const [state, setState] = useState<GateState>('input');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

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
    const pendingStr = localStorage.getItem('pendingLicenseActivation');
    if (pendingStr && state === 'input') {
      try {
        const parsed = JSON.parse(pendingStr);
        if (parsed.validated) {
          setState('signup');
        }
      } catch (e) {}
    }
  }, [state]);

  useEffect(() => {
    if (state === 'error' && (key || uploadedFile)) {
      setState('input');
      setErrorMsg('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, uploadedFile]);

  // ── Product key verification ──────────────────────────────
  const handleVerifyKey = useCallback(async () => {
    if (!key.trim()) return;
    setState('verifying');
    setErrorMsg('');

    const result = await verifyProductKey(key.trim());

    if (result.success) {
      localStorage.setItem('pendingLicenseActivation', JSON.stringify({
        licenseId: key.trim(),
        validated: true,
        licenseData: result.licenseData
      }));
      setState('signup');
    } else {
      setErrorMsg(result.error || 'Verification failed.');
      setState('error');
    }
  }, [key, onVerified]);

  // ── License file verification ─────────────────────────────
  const handleVerifyFile = useCallback(async (file: File) => {
    if (!file) return;
    setState('verifying');
    setErrorMsg('');

    const result = await verifyLicenseFile(file);

    if (result.success) {
      localStorage.setItem('pendingLicenseActivation', JSON.stringify({
        licenseId: 'offline',
        validated: true,
        licenseData: result.licenseData
      }));
      setState('signup');
    } else {
      setErrorMsg(result.error || 'License file verification failed.');
      setState('error');
    }
  }, [onVerified]);

  const handleFileSelected = useCallback((file: File) => {
    if (!file.name.endsWith('.json')) {
      setErrorMsg('Please select a valid license.json file.');
      setState('error');
      return;
    }
    setUploadedFile(file);
    handleVerifyFile(file);
  }, [handleVerifyFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  }, [handleFileSelected]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleVerifyKey();
  }, [handleVerifyKey]);

  const switchMode = (next: GateMode) => {
    setMode(next);
    setState('input');
    setErrorMsg('');
    setUploadedFile(null);
    setKey('');
    if (next === 'key') setTimeout(() => inputRef.current?.focus(), 100);
  };

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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (error) throw error;

      sessionStorage.setItem('pending_workspace_name', workspaceName);
      
      const pendingStr = localStorage.getItem('pendingLicenseActivation');
      if (pendingStr) {
        try {
          const parsed = JSON.parse(pendingStr);
          if (parsed.licenseData) {
            localStorage.setItem('resolve-product-license', JSON.stringify(parsed.licenseData));
          }
        } catch (e) {}
      }
      
      setState('success');
      setTimeout(() => onVerified(), 1200);
    } catch (err: any) {
      setSignupError(err.message || 'Failed to create owner account');
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

        {/* Mode Switcher Tabs */}
        <div className="flex rounded-xl overflow-hidden border mb-6" style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
          {(['key', 'file'] as GateMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className="flex-1 h-9 text-xs font-semibold uppercase tracking-wide transition-all"
              style={{
                background: mode === m ? 'var(--pm-primary)' : 'transparent',
                color: mode === m ? 'white' : 'var(--pm-on-surface-variant)',
              }}
            >
              {m === 'key' ? '🔑 Product Key' : '📄 License File'}
            </button>
          ))}
        </div>

        {/* Gate Content */}
        <div>
          <AnimatePresence mode="wait">

            {/* ── Product Key Input ── */}
            {mode === 'key' && state === 'input' && (
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

            {/* ── License File Drop Zone ── */}
            {mode === 'file' && state === 'input' && (
              <motion.div key="file-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                <div
                  className="rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer"
                  style={{
                    borderColor: dragOver ? 'var(--pm-primary)' : 'rgba(70,69,84,0.4)',
                    background: dragOver ? 'var(--pm-primary-container)/10' : 'var(--pm-surface-lowest)',
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); }}
                  />
                  <Upload className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--pm-on-surface-variant)' }} />
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--pm-on-surface)' }}>
                    Drop your <span className="font-mono text-xs">license.json</span> here
                  </p>
                  <p className="text-xs" style={{ color: 'var(--pm-on-surface-variant)' }}>
                    or click to browse files
                  </p>
                </div>

                {errorMsg && (
                  <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--pm-error)' }}>
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <p className="text-xs text-center" style={{ color: 'var(--pm-on-surface-variant)' }}>
                  Offline activation — no internet required
                </p>
              </motion.div>
            )}

            {/* ── Verifying ── */}
            {state === 'verifying' && (
              <motion.div key="verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-6">
                <Loader className="w-8 h-8 mx-auto mb-4 animate-spin" style={{ color: 'var(--pm-primary)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--pm-on-surface-variant)' }}>
                  {mode === 'file' ? 'Verifying license file signature...' : 'Verifying product key...'}
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
                {mode === 'file'
                  ? <FileCheck className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
                  : <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
                }
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
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Owner full name"
                      className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all"
                      style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                    />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Work email"
                      className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all"
                      style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                    />
                    <input
                      type="text"
                      required
                      value={workspaceName}
                      onChange={e => setWorkspaceName(e.target.value)}
                      placeholder="Workspace/company name"
                      className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all"
                      style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                    />
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all"
                        style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3 text-xs font-semibold" style={{ color: 'var(--pm-primary)' }}>
                        {showPassword ? 'HIDE' : 'SHOW'}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all"
                        style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-3 text-xs font-semibold" style={{ color: 'var(--pm-primary)' }}>
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
                      localStorage.removeItem('pendingLicenseActivation');
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
                  onClick={() => { setState('input'); setErrorMsg(''); setUploadedFile(null); }}
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
            <button
              onClick={() => showAlert('Contacting workspace admin... (Demo)')}
              className="w-full rounded-lg h-10 flex items-center justify-center gap-2 text-xs font-medium transition-colors hover:bg-[var(--pm-surface)]/5"
              style={{ color: 'var(--pm-secondary)', border: '1px solid rgba(70,69,84,0.3)' }}
            >
              Contact Workspace Admin
            </button>
            <a
              href="/"
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
