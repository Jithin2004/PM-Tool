import React from 'react';
import { Database, ShieldAlert, WifiOff, RefreshCcw } from 'lucide-react';

interface DataErrorStateProps {
  error: any;
  onRetry?: () => void;
  context?: string;
}

export const DataErrorState: React.FC<DataErrorStateProps> = ({ error, onRetry, context = 'data' }) => {
  // Safe parsing of Supabase/PostgREST errors without leaking internals
  let errorType = 'unknown';
  let friendlyMessage = 'We encountered an unexpected issue while loading ' + context + '.';
  
  const errString = error?.toString() || '';
  const errCode = error?.code || '';

  if (errString.includes('Failed to fetch') || errString.includes('network')) {
    errorType = 'network';
    friendlyMessage = 'Unable to connect to the network. Please check your connection and try again.';
  } else if (errString.includes('JWT') || errString.includes('Auth') || errCode === '42501' || errString.includes('permission denied') || errString.includes('RLS')) {
    errorType = 'permission';
    friendlyMessage = 'You do not have permission to view this ' + context + '. Please contact your workspace administrator if you need access.';
  } else if (errString.includes('timeout') || errCode === '57014') {
    errorType = 'timeout';
    friendlyMessage = 'The request took too long to complete. Please try again.';
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-surface-2 rounded-xl border border-border m-4 text-center">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-surface-3">
        {errorType === 'permission' && <ShieldAlert className="w-6 h-6 text-amber-500" />}
        {errorType === 'network' && <WifiOff className="w-6 h-6 text-rose-500" />}
        {errorType === 'timeout' && <Database className="w-6 h-6 text-orange-500" />}
        {errorType === 'unknown' && <Database className="w-6 h-6 text-[var(--pm-text-secondary)]" />}
      </div>
      
      <h3 className="text-[var(--pm-text)] font-medium mb-2">
        {errorType === 'permission' ? 'Access Denied' : 
         errorType === 'network' ? 'Connection Offline' : 
         errorType === 'timeout' ? 'Request Timeout' : 
         'Data Unavailable'}
      </h3>
      
      <p className="text-[var(--pm-text-secondary)] text-sm mb-6 max-w-sm">
        {friendlyMessage}
      </p>

      {onRetry && errorType !== 'permission' && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-surface-highest hover:bg-surface-3 text-[var(--pm-text)] rounded-lg text-sm font-medium transition-colors border border-border shadow-sm"
        >
          <RefreshCcw className="w-4 h-4" />
          Retry Request
        </button>
      )}
    </div>
  );
};
