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
      // Keep the URL as /login?error=uninvited so it survives remounts
      // Sign out to prevent having a lingering unauthorized session
      supabase.auth.signOut().catch(console.error);
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
    <div className="min-h-screen  flex items-center justify-center p-6 relative overflow-hidden font-geist">
      {/* Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md premium-panel p-10 relative z-10 rounded-2xl"
      >
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 premium-panel flex items-center justify-center rounded-xl mb-6 p-2 shadow-sm">
            <img src="/logo.png" alt="Resolve PM" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2 text-white">RESOLVE PM</h1>
          <p className="text-xs uppercase tracking-widest text-indigo-400">Enterprise Workspace</p>
        </div>

        <div className="space-y-6">
          {error ? (
            <div className="flex flex-col gap-4 p-5 rounded-xl border border-[var(--signal-critical)] bg-[var(--signal-critical-bg)]/20 bg-red-500/5 text-center">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <h2 className="text-base font-semibold text-white">Access Denied</h2>
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
                You do not have an active invitation to this workspace.
              </p>
              
              <div className="flex flex-col gap-3">
                <a href="/activate" className="w-full btn-premium-primary h-10 flex items-center justify-center rounded-lg font-semibold uppercase tracking-wide text-xs transition-all shadow-sm">
                  Enter Product Key
                </a>
                <button onClick={() => window.location.href = 'mailto:admin@example.com?subject=Request Access'} className="w-full btn-premium-secondary text-white border border-[var(--border-soft)] h-10 flex items-center justify-center rounded-lg font-semibold uppercase tracking-wide text-xs transition-all">
                  Request Invitation
                </button>
                <a href="/" className="w-full bg-transparent hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] h-10 flex items-center justify-center rounded-lg font-semibold uppercase tracking-wide text-xs transition-all">
                  Return Home
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border p-6 text-center text-sm leading-relaxed bg-[var(--surface-glass)] border-[var(--border-soft)] text-[var(--text-secondary)]">
                <p className="mb-3 font-medium text-white">Welcome to Resolve PM</p>
                <p>Sign in to access your workspace, manage projects, and collaborate with your team.</p>
              </div>

              <button
                onClick={handleGoogleLogin}
                className="w-full rounded-xl h-12 flex items-center justify-center gap-3 font-semibold uppercase tracking-wide text-xs transition-all active:scale-[0.98] shadow-sm hover:shadow-md btn-premium-primary"
                id="google-login-btn"
              >
                <Zap className="w-4 h-4" />
                Sign In with Google
              </button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-secondary)] font-mono mt-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Secure workspace access
              </div>
            </>
          )}
        </div>

        {!error && (
          <a href="/" className="block text-center mt-8 text-xs transition-colors hover:underline text-[var(--text-secondary)] hover:text-white">
            Back to Landing
          </a>
        )}
      </motion.div>
    </div>
  );
}
