import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Zap, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

function getErrorParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('error');
}

export function Login() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const err = getErrorParam();
    if (err === 'uninvited') {
      setError('Your account is not invited. Ask your admin to invite you.');
      window.history.replaceState(null, '', '/login');
    }
  }, []);

  const handleGoogleLogin = async () => {
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/workspace'
      }
    });
    if (signInError) console.error("Auth error:", signInError);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-20"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }}>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#0c0c0c] border border-white/10 p-10 relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-white flex items-center justify-center rounded-sm mb-6">
            <Activity className="text-black w-8 h-8" />
          </div>
          <h1 className="text-4xl font-medium tracking-tight mb-2">RESOLVE PM</h1>
          <p className="text-[10px] font-mono text-white/85 uppercase tracking-[0.3em]">Precision Engineering Control</p>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="flex items-start gap-3 border border-red-500/25 bg-red-500/5 p-4">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[12px] font-mono text-red-300 leading-relaxed">{error}</p>
            </div>
          )}

          <div className="bg-white/5 border border-white/10 p-6 text-xs font-mono text-white/85 leading-relaxed">
            <p className="mb-4">SYSTEM_ACCESS_PROTOCOL: v6.0.1</p>
            <p>Authorized personnel only. By entering, you consent to predictive bias modeling and historical data aggregation.</p>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white text-black h-14 flex items-center justify-center gap-3 font-semibold uppercase tracking-widest text-xs hover:bg-neutral-200 transition-all active:scale-[0.98]"
            id="google-login-btn"
          >
            <Zap className="w-4 h-4" />
            Initialize Google Auth
          </button>
        </div>

        <div className="mt-12 pt-6 border-t border-white/5 flex justify-center gap-6">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/70">
            <div className="w-1 h-1 rounded-full bg-white/20"></div>
            AES_256
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/70">
            <div className="w-1 h-1 rounded-full bg-white/20"></div>
            ENCLAVE_ACTIVE
          </div>
        </div>

        <a href="/" className="block text-center mt-6 text-[10px] font-mono text-white/20 hover:text-white/40 transition-colors">
          Back to Landing
        </a>
      </motion.div>
    </div>
  );
}
