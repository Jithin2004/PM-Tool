import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, CheckCircle, XCircle, Loader, AlertCircle, KeyRound } from 'lucide-react';
import { verifyProductKey } from '../../lib/productKey';

interface ProductKeyGateProps {
  onVerified: () => void;
}

type GateState = 'input' | 'verifying' | 'success' | 'error';

export function ProductKeyGate({ onVerified }: ProductKeyGateProps) {
  const [key, setKey] = useState('');
  const [state, setState] = useState<GateState>('input');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (state === 'error' && key) {
      setState('input');
      setErrorMsg('');
    }
  }, [key, state]);

  const handleVerify = useCallback(async () => {
    if (!key.trim()) return;
    setState('verifying');
    setErrorMsg('');

    const result = await verifyProductKey(key.trim());

    if (result.success) {
      setState('success');
      setTimeout(() => onVerified(), 800);
    } else {
      setErrorMsg(result.error || 'Verification failed.');
      setState('error');
    }
  }, [key, onVerified]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleVerify();
  }, [handleVerify]);

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
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-white/5 border flex items-center justify-center rounded-xl mb-6 shadow-sm"
               style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
            <Shield className="w-8 h-8" style={{ color: 'var(--pm-primary)' }} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: 'var(--pm-on-surface)' }}>RESOLVE PM</h1>
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--pm-on-surface-variant)' }}>Product Activation</p>
        </div>

        {/* Gate Card */}
        <div>
          <AnimatePresence mode="wait">
            {state === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
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
                  onClick={handleVerify}
                  disabled={!key.trim()}
                  className={`w-full rounded-xl h-12 flex items-center justify-center gap-3 font-semibold uppercase tracking-wide text-xs transition-all active:scale-[0.98] shadow-sm hover:shadow-md ${
                    key.trim()
                      ? 'opacity-100'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                  style={{ background: 'var(--pm-primary)', color: 'white' }}
                >
                  Activate License
                </button>
              </motion.div>
            )}

            {state === 'verifying' && (
              <motion.div
                key="verifying"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-6"
              >
                <Loader className="w-8 h-8 mx-auto mb-4 animate-spin" style={{ color: 'var(--pm-primary)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--pm-on-surface-variant)' }}>Verifying product key...</p>
              </motion.div>
            )}

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
                <p className="text-lg font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Activation successful</p>
                <p className="text-sm mt-2" style={{ color: 'var(--pm-on-surface-variant)' }}>Initializing workspace...</p>
              </motion.div>
            )}

            {state === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
                <div className="text-center py-4">
                  <XCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--pm-error)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--pm-error)' }}>Verification failed</p>
                </div>
                <button
                  onClick={handleVerify}
                  className="w-full rounded-xl h-12 flex items-center justify-center gap-3 font-semibold uppercase tracking-wide text-xs transition-all active:scale-[0.98]"
                  style={{ background: 'var(--pm-surface-high)', color: 'var(--pm-on-surface)', border: '1px solid rgba(70,69,84,0.3)' }}
                >
                  Retry
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-4 mt-10">
          <p className="text-[10px] uppercase tracking-wider text-center" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Secure activation &middot; Keyserver connection required
          </p>
          <a href="/" className="text-xs transition-colors hover:underline" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Return to Landing
          </a>
        </div>
      </motion.div>
    </div>
  );
}
