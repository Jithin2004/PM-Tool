import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { loginWithPassword } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

function getErrorParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('error');
}

export function Login() {
  const { user } = useAuth();
  
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Deliberately removed aggressive auto-redirect.
    // The router.tsx will automatically redirect the user to the appropriate page
    // once the profile is fully loaded and resolved.
  }, [user]);

  useEffect(() => {
    const err = getErrorParam();
    if (err === 'uninvited') {
      setError('Your account is not invited. Ask your admin to invite you.');
      supabase.auth.signOut().catch(console.error);
    } else if (err === 'access_denied') {
      setError('Your account has been deactivated. Please contact HR.');
      supabase.auth.signOut().catch(console.error);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await loginWithPassword(email, password);
      if (signInError) {
        setError(signInError.message);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login.');
    } finally {
      setLoading(false);
    }
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
              <h2 className="text-base font-semibold text-white">Access Denied / Error</h2>
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
                {error === 'Your account is not invited. Ask your admin to invite you.'
                  ? 'You do not have an active invitation to this workspace.'
                  : error}
              </p>
              
              <div className="flex flex-col gap-3">
                <button onClick={() => setError(null)} className="w-full btn-premium-primary h-10 flex items-center justify-center rounded-lg font-semibold uppercase tracking-wide text-xs transition-all shadow-sm">
                  Try Again
                </button>
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
                <p className="mb-3 font-medium text-white">Your company workspace, organized.</p>
                <p>Continue to your workspace.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded-xl px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="Enter your email"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Password *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded-xl px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="Enter your password"
                    required
                  />
                  <div className="flex justify-end mt-1">
                    <a href="/reset-password" className="text-xs text-indigo-400 hover:text-indigo-300">Forgot Password?</a>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl h-12 flex items-center justify-center gap-3 font-semibold uppercase tracking-wide text-xs transition-all active:scale-[0.98] shadow-sm hover:shadow-md btn-premium-primary disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
                </button>
              </form>

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
