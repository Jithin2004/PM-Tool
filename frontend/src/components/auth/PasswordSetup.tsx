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
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <div className="max-w-md w-full bg-[#1c1d1f] p-8 rounded-xl shadow-2xl border border-white/10">
        <h2 className="text-2xl font-bold mb-2">Set Your Password</h2>
        <p className="text-white/60 text-sm mb-6">Your account was created by HR. Please set a secure password to continue.</p>
        
        <input 
          type="password" 
          placeholder="New Password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white mb-6 focus:outline-none focus:border-indigo-500"
        />
        
        <button 
          onClick={handleUpdate}
          disabled={loading || password.length < 8}
          className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Set Password'}
        </button>
      </div>
    </div>
  );
}
