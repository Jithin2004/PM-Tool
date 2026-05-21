import React, { useEffect, useState } from 'react';
import { fetchIntegrationHealth, IntegrationHealth, getHealthDisplay } from '../../services/integrationService';

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ConnectionsPanel() {
  const [health, setHealth] = useState<IntegrationHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchIntegrationHealth('');
      if (!cancelled) setHealth(data);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">CONTROL</span>
        <span className="text-white/20">/</span>
        <span className="text-xs font-mono text-white/80">Connections</span>
      </div>
      {loading ? (
        <div className="text-[11px] font-mono text-white/30">Loading...</div>
      ) : health.length === 0 ? (
        <div className="border border-white/10 bg-white/[0.02] p-12 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-mono text-white/30 uppercase tracking-wider">
            No Connected Services
          </span>
          <span className="text-[9px] font-mono text-white/20 mt-2">
            OAuth connections and integration health appear here
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {health.map((h) => {
            const display = getHealthDisplay(h.status);
            return (
              <div key={h.id} className="border border-white/10 bg-white/[0.02] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono text-white/70">{h.service}</span>
                  <span className={`text-[10px] font-mono ${display.color}`}>{display.label}</span>
                </div>
                <div className="flex items-center gap-6 text-[10px] font-mono text-white/30">
                  <span>Sync: {timeAgo(h.last_sync)}</span>
                  <span>Checked: {timeAgo(h.integration_last_checked)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
