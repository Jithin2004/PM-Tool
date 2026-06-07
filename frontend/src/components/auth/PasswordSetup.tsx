import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { activityLogService } from '../../services/activityLogService';

export function PasswordSetup() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await supabase.auth.updateUser({ password });
      await supabase.from('users').update({ force_password_change: false }).eq('id', profile?.id);
      
      await activityLogService.appendLog({
        workspace_id: profile?.workspace_id || '',
        action: 'password_setup_completed',
        metadata: { user_id: profile?.id }
      });
      
      window.location.href = '/overview';
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
          className="w-full input-premium px-4 py-3 text-white mb-6"
        />
        
        <button 
          onClick={handleUpdate}
          disabled={loading || password.length < 8}
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
