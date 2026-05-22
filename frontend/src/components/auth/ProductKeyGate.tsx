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
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-sm"
      >
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 border border-white/10 mb-4">
            <Shield className="w-5 h-5 text-white/70" />
          </div>
          <h1 className="text-lg font-medium tracking-tight text-white/90">Resolve PM</h1>
          <p className="text-[10px] font-mono uppercase tracking-widest text-white/30 mt-1">Product Activation</p>
        </div>

        {/* Gate Card */}
        <div className="bg-[#0c0c0c] border border-white/10 p-6">
          <AnimatePresence mode="wait">
            {state === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2.5 px-3 py-2 bg-white/[0.02] border border-white/[0.06]">
                  <KeyRound className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter your product key"
                    className="flex-1 bg-transparent text-[12px] font-mono text-white/80 outline-none placeholder:text-white/20"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {errorMsg && (
                  <div className="flex items-start gap-2 text-[11px] font-mono text-red-400/70">
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  onClick={handleVerify}
                  disabled={!key.trim()}
                  className={`w-full py-2.5 text-[11px] uppercase font-mono tracking-wider transition-all ${
                    key.trim()
                      ? 'bg-white/10 text-white/90 hover:bg-white/15 border border-white/10'
                      : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  Activate
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
                <Loader className="w-6 h-6 text-white/40 mx-auto mb-3 animate-spin" />
                <p className="text-[11px] font-mono text-white/40">Verifying product key...</p>
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
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                <p className="text-[12px] font-mono text-emerald-400/80">Activation successful</p>
                <p className="text-[10px] font-mono text-white/20 mt-2">Initializing workspace...</p>
              </motion.div>
            )}

            {state === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="text-center py-2">
                  <XCircle className="w-6 h-6 text-red-400/60 mx-auto mb-2" />
                  <p className="text-[11px] font-mono text-red-400/60">Verification failed</p>
                </div>
                <button
                  onClick={handleVerify}
                  className="w-full py-2.5 text-[11px] uppercase font-mono tracking-wider bg-white/10 text-white/90 hover:bg-white/15 border border-white/10 transition-all"
                >
                  Retry
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="text-[9px] font-mono uppercase tracking-wider text-white/15 text-center mt-6">
          Secure activation &middot; Keyserver connection required
        </p>
      </motion.div>
    </div>
  );
}
