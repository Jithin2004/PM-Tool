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
          {error ? (
            <div className="flex flex-col gap-4 p-5 rounded-xl border border-red-500/20 bg-signal-critical/5 text-center">
              <AlertTriangle className="w-8 h-8 text-signal-critical mx-auto mb-2" />
              <h2 className="text-base font-semibold text-text-primary">Access Denied</h2>
              <p className="text-[13px] text-text-secondary leading-relaxed mb-4">
                You do not have an active invitation to this workspace.
              </p>
              
              <div className="flex flex-col gap-3">
                <a href="/activate" className="w-full bg-accent-primary hover:bg-accent-primary/90 text-white h-10 flex items-center justify-center rounded-lg font-semibold uppercase tracking-wide text-xs transition-all shadow-sm">
                  Enter Product Key
                </a>
                <button onClick={() => window.location.href = 'mailto:admin@example.com?subject=Request Access'} className="w-full bg-surface-2 hover:bg-surface-3 text-text-primary border border-border/50 h-10 flex items-center justify-center rounded-lg font-semibold uppercase tracking-wide text-xs transition-all">
                  Request Invitation
                </button>
                <a href="/" className="w-full bg-transparent hover:bg-white/5 text-text-tertiary h-10 flex items-center justify-center rounded-lg font-semibold uppercase tracking-wide text-xs transition-all">
                  Return Home
                </a>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        {!error && (
          <a href="/" className="block text-center mt-10 text-xs transition-colors hover:underline" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Back to Landing
          </a>
        )}
      </motion.div>
    </div>
  );
}
