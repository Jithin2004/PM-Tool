import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Zap, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { buildOAuthRedirectUrl, setRedirectToAfterAuth } from '../../core/auth/postAuthRedirect';

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
    const returnPath = window.location.pathname === '/login' ? '/overview' : window.location.pathname;
    setRedirectToAfterAuth(returnPath);

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: buildOAuthRedirectUrl(),
      },
    });
    if (signInError) console.error('Auth error:', signInError);
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
        className="w-full max-w-md pm-card p-10 relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-white/5 border border-border flex items-center justify-center rounded-xl mb-6 p-2 shadow-sm">
            <img src="/logo.png" alt="Resolve PM" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: 'var(--pm-on-surface)' }}>RESOLVE PM</h1>
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--pm-primary)' }}>Enterprise Workspace</p>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="flex flex-col gap-3 border border-red-500/25 bg-signal-critical-bg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-signal-critical shrink-0 mt-0.5" />
                <p className="text-[12px] font-mono text-red-300 leading-relaxed">{error}</p>
              </div>
              {error.includes('uninvited') && (
                <a href="/activate" className="mt-2 w-full bg-white text-black h-10 flex items-center justify-center gap-2 font-semibold uppercase tracking-wide text-xs hover:bg-neutral-200 transition-all active:scale-[0.98]">
                  Activate Product Key
                </a>
              )}
            </div>
          )}

          <div className="rounded-xl border p-6 text-center text-sm leading-relaxed" style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface-variant)' }}>
            <p className="mb-3 font-medium" style={{ color: 'var(--pm-on-surface)' }}>Welcome to Resolve PM</p>
            <p>Sign in to access your workspace, manage projects, and collaborate with your team.</p>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full rounded-xl h-12 flex items-center justify-center gap-3 font-semibold uppercase tracking-wide text-xs transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
            style={{ background: 'var(--pm-primary)', color: 'white' }}
            id="google-login-btn"
          >
            <Zap className="w-4 h-4" />
            Sign In with Google
          </button>
        </div>

        <a href="/" className="block text-center mt-10 text-xs transition-colors hover:underline" style={{ color: 'var(--pm-on-surface-variant)' }}>
          Back to Landing
        </a>
      </motion.div>
    </div>
  );
}
