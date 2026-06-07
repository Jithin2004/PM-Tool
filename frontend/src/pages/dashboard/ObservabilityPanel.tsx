import React from 'react';
import { useObservability } from '../../core/observability/ObservabilityProvider';
import { Activity, Server, Database, Network, ShieldCheck, ShieldAlert, History, AlertTriangle, CheckCircle, RefreshCcw, Info, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';

export const ObservabilityPanel: React.FC = () => {
  const { profile } = useAuth();
  const { health, realtime, audit, replay, metrics, incidents, resolveIncident } = useObservability();

  if (profile?.role !== 'super_admin' && profile?.role !== 'pm') {
    return (
      <div className="flex h-full items-center justify-center bg-surface">
        <div className="text-center text-[var(--pm-text-secondary)]">
          <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>You do not have clearance to view operational telemetry.</p>
        </div>
      </div>
    );
  }

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'healthy':
      case 'verified':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'degraded':
      case 'warning':
      case 'reconnecting':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'critical':
      case 'compromised':
      case 'offline':
        return <XCircle className="w-5 h-5 text-rose-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const MetricCard = ({ title, value, subtitle, icon: Icon }: any) => (
    <div className="bg-surface-2 border border-border rounded-xl p-5 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <span className="text-[var(--pm-text-secondary)] dark:text-[var(--pm-text-secondary)] text-sm font-medium">{title}</span>
        <Icon className="w-4 h-4 text-[var(--pm-text-secondary)] dark:text-[var(--pm-text-secondary)]" />
      </div>
      <div className="text-2xl font-semibold text-[var(--pm-text)] text-[var(--text-primary)]">{value}</div>
      {subtitle && <div className="text-sm text-[var(--pm-text-secondary)] mt-1">{subtitle}</div>}
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--pm-text)] text-[var(--text-primary)] flex items-center gap-3">
            <Activity className="w-6 h-6 text-indigo-500" />
            Platform Observability
          </h1>
          <p className="text-[var(--pm-text-secondary)] dark:text-[var(--pm-text-secondary)] mt-1">
            Executive-grade operational telemetry and incident governance.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-surface-2 px-4 py-2 rounded-lg border border-border shadow-sm">
          <span className="text-sm font-medium text-[var(--pm-text-secondary)] dark:text-[var(--pm-text-secondary)]">System State</span>
          <div className="flex items-center gap-2">
            <StatusIcon status={health.status} />
            <span className="font-semibold capitalize text-[var(--pm-text)] text-[var(--text-primary)]">{health.status}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard 
          title="Availability" 
          value={`${metrics.platformAvailability}%`} 
          subtitle="Global platform uptime"
          icon={Server} 
        />
        <MetricCard 
          title="Replay Integrity" 
          value={`${Math.round(replay.successRate)}%`} 
          subtitle={`${replay.queueSize} items in queue`}
          icon={History} 
        />
        <MetricCard 
          title="Realtime Latency" 
          value={`${metrics.realtimeLatency || '< 50'}ms`} 
          subtitle={`${realtime.activeChannels} active channels`}
          icon={Network} 
        />
        <MetricCard 
          title="Audit Ledger" 
          value={audit.status === 'verified' ? 'Secure' : 'Alert'} 
          subtitle={audit.hashChainContinuity ? 'Hash chain intact' : 'Hash break detected'}
          icon={audit.status === 'verified' ? ShieldCheck : ShieldAlert} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Component Health */}
        <div className="col-span-1 space-y-6">
          <h2 className="text-lg font-medium text-[var(--pm-text)] text-[var(--text-primary)]">Component Health</h2>
          <div className="bg-surface-2 border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {[
                { label: 'API Services', status: health.apiHealth, icon: Server },
                { label: 'Database & Auth', status: health.databaseHealth, icon: Database },
                { label: 'Realtime Mesh', status: health.realtimeHealth, icon: Network },
                { label: 'State Sync', status: health.syncHealth, icon: RefreshCcw },
                { label: 'Audit Verification', status: audit.status, icon: ShieldCheck }
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 hover:bg-surface-3 transition-colors">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-[var(--pm-text-secondary)] dark:text-[var(--pm-text-secondary)]" />
                    <span className="font-medium text-[var(--pm-text-secondary)] dark:text-[var(--pm-text-secondary)]">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--pm-text-secondary)] capitalize">{item.status}</span>
                    <StatusIcon status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Incident Timeline */}
        <div className="col-span-2 space-y-6">
          <h2 className="text-lg font-medium text-[var(--pm-text)] text-[var(--text-primary)]">Incident Timeline</h2>
          <div className="bg-surface-2 border border-border rounded-xl p-6 shadow-sm min-h-[400px]">
            {incidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-[var(--pm-text-secondary)] dark:text-[var(--pm-text-secondary)] text-center">
                <CheckCircle className="w-12 h-12 mb-4 text-emerald-100 dark:text-emerald-900/50" />
                <p>No active incidents.</p>
                <p className="text-sm">Platform is operating normally.</p>
              </div>
            ) : (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 dark:before:via-gray-700 before:to-transparent">
                <AnimatePresence>
                  {incidents.map((incident) => (
                    <motion.div 
                      key={incident.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active`}
                    >
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-surface shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 ${
                        incident.severity === 'critical' ? 'bg-rose-500' :
                        incident.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                      }`}>
                        {incident.severity === 'critical' ? <XCircle className="w-4 h-4 text-[var(--pm-text)] text-[var(--text-primary)]" /> :
                         incident.severity === 'warning' ? <AlertTriangle className="w-4 h-4 text-[var(--pm-text)] text-[var(--text-primary)]" /> :
                         <Info className="w-4 h-4 text-[var(--pm-text)] text-[var(--text-primary)]" />}
                      </div>
                      
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-surface-2 border border-border p-4 rounded-xl shadow-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-xs font-semibold uppercase tracking-wider ${
                            incident.severity === 'critical' ? 'text-rose-600 dark:text-rose-400' :
                            incident.severity === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            {incident.category} {incident.dedupCount > 0 ? `(${incident.dedupCount + 1}x)` : ''}
                          </span>
                          <span className="text-xs text-[var(--pm-text-secondary)]">
                            {new Date(incident.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <h3 className="font-medium text-[var(--pm-text)] text-[var(--text-primary)] mb-1">{incident.message}</h3>
                        <p className="text-sm text-[var(--pm-text-secondary)] dark:text-[var(--pm-text-secondary)]">{incident.causality}</p>
                        
                        {!incident.resolved && (
                          <div className="mt-3 pt-3 border-t border-border flex justify-end">
                            <button 
                              onClick={() => resolveIncident(incident.id)}
                              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-md transition-colors"
                            >
                              Mark Resolved
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
