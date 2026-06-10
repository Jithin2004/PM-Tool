import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { activityLogService } from '../../services/activityLogService';

export function PasswordSetup() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { profile } = useAuth();

  const isLengthValid = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const isValid = isLengthValid && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;

  const handleUpdate = async () => {
    if (!isValid) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
         setErrorMsg(error.message);
         setLoading(false);
         return;
      }
      
      await supabase.from('users').update({ force_password_change: false }).eq('id', profile?.id);
      
      await activityLogService.appendLog({
        workspace_id: profile?.workspace_id || '',
        action: 'password_setup_completed',
        metadata: { user_id: profile?.id }
      });
      
      window.location.href = '/overview';
    } catch (e: any) {
      setErrorMsg(e.message || 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  const CheckItem = ({ checked, label }: { checked: boolean, label: string }) => (
    <div className={`flex items-center gap-2 text-xs font-mono mb-1 transition-colors ${checked ? 'text-emerald-400' : 'text-[var(--text-secondary)]'}`}>
      <span className="w-4 text-center">{checked ? '✓' : '○'}</span>
      <span>{label}</span>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen  text-white p-4 font-geist">
      <div className="max-w-md w-full premium-panel p-8 rounded-2xl">
        <h2 className="text-2xl font-bold mb-2 text-white">Set Your Password</h2>
        <p className="text-[var(--text-secondary)] text-sm mb-6">Your account was created by HR. Please set a secure password to continue.</p>
        
        <input 
          type="password" 
          placeholder="New Password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full input-premium px-4 py-3 text-white mb-4"
        />

        <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <CheckItem checked={isLengthValid} label="At least 8 characters" />
          <CheckItem checked={hasUpperCase} label="One uppercase letter" />
          <CheckItem checked={hasLowerCase} label="One lowercase letter" />
          <CheckItem checked={hasNumber} label="One number" />
          <CheckItem checked={hasSpecialChar} label="One special character" />
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 rounded-lg text-xs font-mono" style={{ background: 'rgba(239,68,68,0.1)', color: 'rgb(248,113,113)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {errorMsg}
          </div>
        )}
        
        <button 
          onClick={handleUpdate}
          disabled={loading || !isValid}
          className="w-full py-3 btn-premium-primary rounded-lg font-semibold uppercase tracking-wider text-xs disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Set Password'}
        </button>

        <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-secondary)] font-mono mt-4">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Secure workspace access
        </div>
      </div>
    </div>
  );
}
