import React, { useState } from 'react';
import { Power, Settings, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

interface IntegrationCardProps {
  provider: string;
  status: string;
  lastSyncAt: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onReconnect?: () => void;
  canManage: boolean;
}

export function IntegrationCard({ provider, status, lastSyncAt, onConnect, onDisconnect, onReconnect, canManage }: IntegrationCardProps) {
  const [loading, setLoading] = useState(false);

  const getStatusDisplay = () => {
    switch (status) {
      case 'connected': return <span className="flex items-center text-emerald-400 text-sm"><CheckCircle2 className="w-4 h-4 mr-1" /> Connected</span>;
      case 'expired': return <span className="flex items-center text-amber-400 text-sm"><AlertCircle className="w-4 h-4 mr-1" /> Expired</span>;
      case 'disabled': return <span className="flex items-center text-red-400 text-sm"><Power className="w-4 h-4 mr-1" /> Disabled</span>;
      default: return <span className="flex items-center text-[var(--text-secondary)] text-sm">Not Connected</span>;
    }
  };

  const handleAction = async () => {
    setLoading(true);
    if (status === 'connected' || status === 'expired') {
      await onDisconnect();
    } else {
      await onConnect();
    }
    setLoading(false);
  };

  return (
    <div className="bg-bg border border-[var(--pm-border)] rounded-lg p-5 flex flex-col hover:border-[var(--pm-border-hover)] transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-medium text-white capitalize">{provider.replace('_', ' ')}</h3>
          <div className="mt-1">
            {getStatusDisplay()}
          </div>
        </div>
        <div className="p-2 bg-[var(--pm-border)] rounded-md">
          {provider === 'github' ? <span className="font-bold">GH</span> : 
           provider === 'slack' ? <span className="font-bold text-amber-500">S</span> :
           <Settings className="w-5 h-5" />}
        </div>
      </div>
      
      <div className="text-sm text-[var(--text-secondary)] flex-grow mb-4">
        {lastSyncAt ? (
          <span className="flex items-center">
            <RefreshCw className="w-3 h-3 mr-1" /> Last sync: {new Date(lastSyncAt).toLocaleString()}
          </span>
        ) : (
          <span>No sync history available.</span>
        )}
      </div>

      {canManage && (
        <div className="flex gap-2">
          {status === 'expired' || status === 'error' ? (
            <>
              {onReconnect && (
                <button
                  onClick={async () => {
                    setLoading(true);
                    await onReconnect();
                    setLoading(false);
                  }}
                  disabled={loading}
                  className="flex-1 py-2 rounded-md font-medium transition-colors bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-sm"
                >
                  {loading ? 'Processing...' : 'Reconnect'}
                </button>
              )}
              <button
                onClick={handleAction}
                disabled={loading}
                className="flex-1 py-2 rounded-md font-medium transition-colors bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleAction}
              disabled={loading}
              className={`w-full py-2 rounded-md font-medium transition-colors text-sm ${
                status === 'connected' 
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' 
                : 'bg-primary text-white hover:bg-primary-hover'
              }`}
            >
              {loading ? 'Processing...' : status === 'connected' ? 'Disconnect' : 'Connect'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
