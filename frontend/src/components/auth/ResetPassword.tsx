import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, KeyRound, ArrowLeft } from 'lucide-react';
import { sendPasswordReset } from '../../services/authService';

export function ResetPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error: resetError } = await sendPasswordReset(email);
      if (resetError) {
        setError(resetError.message);
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden font-geist">
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md premium-panel p-10 relative z-10 rounded-2xl"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 premium-panel flex items-center justify-center rounded-xl mb-6 p-2 shadow-sm">
            <KeyRound className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2 text-white">Reset Password</h1>
          <p className="text-sm text-[var(--text-secondary)]">Enter your email to receive recovery instructions</p>
        </div>

        {success ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center">
              <h2 className="text-base font-semibold text-emerald-400">Check your email</h2>
              <p className="text-[13px] text-emerald-200/70 leading-relaxed mb-4">
                We've sent a password reset link to <strong>{email}</strong>. Please check your inbox and spam folder.
              </p>
              
              <button onClick={() => window.location.href = '/login'} className="w-full btn-premium-primary h-10 flex items-center justify-center rounded-lg font-semibold uppercase tracking-wide text-xs transition-all shadow-sm">
                Return to Login
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-5">
            {error && (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--signal-critical)] bg-[var(--signal-critical-bg)]/20 text-red-400 text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 bg-[var(--surface-sunken)] border border-[var(--border-soft)] rounded-lg px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="name@company.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-premium-primary h-11 flex items-center justify-center rounded-lg font-semibold uppercase tracking-wide text-xs transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Send Recovery Link'
              )}
            </button>
            
            <div className="mt-6 text-center">
              <a href="/login" className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </a>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
