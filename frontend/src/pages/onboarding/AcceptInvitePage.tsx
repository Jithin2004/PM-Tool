import React, { useState, useEffect } from 'react';
import { ResolveLayout } from '../../app/layouts/ResolveLayout';
import { supabase } from '../../lib/supabase';
import { Check, X, Shield, Lock, Briefcase, Building } from 'lucide-react';

export function AcceptInvitePage() {
  const token = window.location.pathname.split('/accept-invite/')[1];
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [inviteDetails, setInviteDetails] = useState<{
    email: string;
    full_name: string;
    role: string;
    department: string | null;
    workspace_name?: string;
  } | null>(null);

  const [validatingToken, setValidatingToken] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('No invitation token provided.');
        setValidatingToken(false);
        return;
      }

      try {
        const { data: invRow, error: fetchError } = await supabase
          .rpc('get_invitation_by_token', { p_token: token });

        if (fetchError || !invRow) {
          setError('Invalid invitation link. Please request a new invite from your administrator.');
          return;
        }

        if (invRow.status !== 'pending') {
          setError('This invitation has already been processed or deactivated.');
          return;
        }

        if (new Date(invRow.expires_at) < new Date()) {
          setError('This invitation has expired. Please request a new one.');
          return;
        }

        setInviteDetails({
          email: invRow.email,
          full_name: invRow.email.split('@')[0], 
          role: invRow.role,
          department: null,
          workspace_name: invRow.workspace_name || 'Your Company'
        });

      } catch (err: any) {
        setError(err.message || 'Failed to validate invitation.');
      } finally {
        setValidatingToken(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      // 1. Mark the token as accepted in the database first
      // so it's consumed before creating the user to avoid race conditions.
      const { error: updateError } = await supabase
        .from('invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('token', token)
        .eq('status', 'pending');

      if (updateError) {
        throw new Error('Could not accept the invitation at this time.');
      }

      // 2. Create the user in Supabase Auth
      // The reconcileInvitationMembership core will automatically pick up the 'accepted' invitation
      // when it sees the email, and assign the proper workspace and role!
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: inviteDetails!.email,
        password: password,
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          // If they already exist, try to sign them in.
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: inviteDetails!.email,
            password: password
          });
          if (signInError) throw new Error('Account exists but password was incorrect. Please login normally.');
        } else {
          throw signUpError;
        }
      }

      setSuccess(true);

      setTimeout(() => {
        window.location.href = '/overview';
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (validatingToken) {
    return (
      <ResolveLayout eyebrow="Setup">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
        </div>
      </ResolveLayout>
    );
  }

  if (error && !success && !inviteDetails) {
    return (
      <ResolveLayout eyebrow="Setup">
        <div className="max-w-md mx-auto mt-20 p-8 premium-panel rounded-2xl text-center shadow-2xl border border-red-500/20 bg-dark-eval/50 backdrop-blur-xl">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-4">Invitation Invalid</h2>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
        </div>
      </ResolveLayout>
    );
  }

  return (
    <ResolveLayout eyebrow="Onboarding">
      <div className="max-w-md mx-auto mt-20">
        <section className="premium-panel rounded-2xl p-8 shadow-2xl border border-white/5 bg-dark-eval/50 backdrop-blur-xl font-geist relative overflow-hidden">
          
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl -z-10 transform -translate-x-1/2 translate-y-1/2" />

          <div className="text-center mb-8 relative z-10">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 mb-6 shadow-inner">
              <Shield className="h-6 w-6 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white tracking-tight">Welcome, {inviteDetails?.full_name}!</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              You've been invited to join <span className="text-white font-medium">{inviteDetails?.workspace_name}</span>. Please set your secure password to continue.
            </p>
          </div>

          {/* Context Cards */}
          <div className="grid grid-cols-2 gap-3 mb-8 relative z-10">
             <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center gap-3">
                <Briefcase className="w-4 h-4 text-indigo-400" />
                <div className="text-left">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Role</p>
                  <p className="text-sm text-white capitalize">{inviteDetails?.role?.replace('_', ' ')}</p>
                </div>
             </div>
             <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center gap-3">
                <Building className="w-4 h-4 text-purple-400" />
                <div className="text-left">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Department</p>
                  <p className="text-sm text-white">{inviteDetails?.department || 'Unassigned'}</p>
                </div>
             </div>
          </div>

          {success ? (
            <div className="text-center animate-in fade-in zoom-in-95 duration-300 relative z-10">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Access Granted</h3>
              <p className="text-sm text-gray-400 mt-2">Connecting to workspace...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg animate-in slide-in-from-top-2">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-gray-400 mb-1 ml-1 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> NEW PASSWORD
                </label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-eval border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-gray-600" 
                  placeholder="At least 8 characters"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-gray-400 mb-1 ml-1">CONFIRM PASSWORD</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-eval border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-gray-600" 
                  placeholder="Repeat password"
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={loading || !password || !confirmPassword}
                className="w-full py-3 px-4 bg-white text-black hover:bg-gray-100 rounded-xl font-medium shadow-lg shadow-white/5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-6 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Securely Provisioning...
                  </>
                ) : 'Complete Provisioning'}
              </button>
            </form>
          )}
        </section>
      </div>
    </ResolveLayout>
  );
}
