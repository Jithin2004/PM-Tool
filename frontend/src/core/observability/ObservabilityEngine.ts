import { PlatformHealthStatus, RealtimeHealthProfile, AuditIntegrityStatus, ReplayIntegrityProfile, OperationalReliabilityMetrics, IncidentRecord, IncidentSeverity } from './types';
import { persistSystemEvent } from './telemetry';

type Subscriber = () => void;

class ObservabilityEngineCore {
  private subscribers: Set<Subscriber> = new Set();
  
  // State
  private health: PlatformHealthStatus = {
    status: 'healthy',
    reasons: [],
    apiHealth: 'healthy',
    databaseHealth: 'healthy',
    realtimeHealth: 'healthy',
    syncHealth: 'healthy',
    backgroundProcessingHealth: 'healthy',
    lastChecked: new Date().toISOString()
  };

  private realtime: RealtimeHealthProfile = {
    status: 'offline',
    reconnectFrequency: 0,
    reconnectStorms: 0,
    staleSubscriptions: 0,
    activeChannels: 0,
    lastDisconnect: null
  };

  private audit: AuditIntegrityStatus = {
    status: 'warning',
    hashChainContinuity: false,
    missingEvents: 0,
    replayConsistency: false,
    corruptionIndicators: ['Initializing...'],
    lastVerified: new Date().toISOString()
  };

  private replay: ReplayIntegrityProfile = {
    successRate: 100,
    failures: 0,
    rejections: 0,
    staleAttempts: 0,
    queueSize: 0,
    queueCorruptionIndicators: []
  };

  private metrics: OperationalReliabilityMetrics = {
    platformAvailability: 100,
    operationalLatency: 0,
    realtimeLatency: 0,
    replaySuccessRate: 100,
    syncSuccessRate: 100,
    auditVerificationSuccess: 100
  };

  private incidents: IncidentRecord[] = [];

  // Subscriptions
  subscribe(callback: Subscriber) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify() {
    this.subscribers.forEach(cb => cb());
  }

  // Getters
  getHealth() { return this.health; }
  getRealtime() { return this.realtime; }
  getAudit() { return this.audit; }
  getReplay() { return this.replay; }
  getMetrics() { return this.metrics; }
  getIncidents() { return this.incidents; }

  // API Setters & Governance
  reportIncident(
    category: IncidentRecord['category'], 
    severity: IncidentSeverity, 
    message: string, 
    causality: string, 
    context: Record<string, any> = {}
  ) {
    const now = new Date().toISOString();
    
    // Alert deduplication logic (governance over alert fatigue)
    const recentDuplicate = this.incidents.find(i => 
      i.category === category && 
      i.message === message && 
      !i.resolved &&
      (new Date(now).getTime() - new Date(i.timestamp).getTime()) < 5 * 60 * 1000 // 5 min dedup window
    );

    if (recentDuplicate) {
      recentDuplicate.dedupCount += 1;
      recentDuplicate.timestamp = now; // bump time
      this.notify();
      return;
    }

    const newIncident: IncidentRecord = {
      id: `inc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: now,
      severity,
      category,
      message,
      causality,
      context,
      dedupCount: 0,
      resolved: false
    };

    // Keep last 50 incidents to prevent memory bloat
    this.incidents = [newIncident, ...this.incidents].slice(0, 50);
    this.recalculateHealth();
    this.notify();

    // Fire and forget persistence to system_events
    try {
      persistSystemEvent(
        'frontend_incident',
        severity,
        'frontend',
        message,
        { causality, context, category }
      );
    } catch (e) { /* ignore */ }
  }

  resolveIncident(id: string) {
    const inc = this.incidents.find(i => i.id === id);
    if (inc) {
      inc.resolved = true;
      this.recalculateHealth();
      this.notify();
    }
  }

  // Realtime Telemetry
  updateRealtimeHealth(updates: Partial<RealtimeHealthProfile>) {
    this.realtime = { ...this.realtime, ...updates };
    
    if (updates.status === 'offline' || updates.status === 'reconnecting') {
      this.health.realtimeHealth = 'degraded';
      if (this.realtime.reconnectStorms > 5) {
        this.reportIncident('realtime', 'warning', 'Realtime reconnect storm detected', 'Unstable websocket connection or network partitions');
      }
    } else if (updates.status === 'healthy') {
      this.health.realtimeHealth = 'healthy';
    }
    
    this.recalculateHealth();
    this.notify();
  }

  // Replay Integrity Telemetry
  reportReplayAttempt(success: boolean, rejected: boolean, isStale: boolean) {
    if (success) {
      // successful replay
    } else if (rejected) {
      this.replay.rejections += 1;
      this.reportIncident('replay', 'warning', 'Replay mutation rejected by server', 'Authorization failure or version conflict');
    } else {
      this.replay.failures += 1;
    }

    if (isStale) {
      this.replay.staleAttempts += 1;
      this.reportIncident('replay', 'info', 'Stale mutation evicted', 'Mutation exceeded 48 hour survival window');
    }

    const total = this.replay.failures + this.replay.rejections + 100; // baseline
    this.replay.successRate = Math.max(0, 100 - (this.replay.failures / total * 100));
    
    this.metrics.replaySuccessRate = this.replay.successRate;
    this.notify();
  }

  updateQueueSize(size: number) {
    this.replay.queueSize = size;
    if (size > 30) {
      this.reportIncident('replay', 'warning', 'Offline queue backing up', 'Client has been offline for an extended period or sync is failing');
    }
    this.notify();
  }

  // Audit Integrity Telemetry
  updateAuditStatus(status: Partial<AuditIntegrityStatus>) {
    this.audit = { ...this.audit, ...status, lastVerified: new Date().toISOString() };
    
    if (status.status === 'compromised') {
      this.health.databaseHealth = 'critical';
      this.reportIncident('audit', 'critical', 'Audit Ledger Integrity Compromised', 'Hash-chain broken or missing blocks detected', { indicators: status.corruptionIndicators });
    }

    this.recalculateHealth();
    this.notify();
  }

  async verifyAuditLedger(supabase: any, workspaceId: string) {
    if (!workspaceId) return;
    
    try {
      const { data, error } = await supabase
        .from('system_audit_ledger')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) {
        this.updateAuditStatus({ status: 'verified', hashChainContinuity: true, missingEvents: 0, replayConsistency: true, corruptionIndicators: [] });
        return;
      }

      let isCompromised = false;
      const indicators: string[] = [];
      let missingEvents = 0;

      for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1];
        const curr = data[i];

        if (curr.previous_hash !== prev.hash) {
          isCompromised = true;
          missingEvents++;
          indicators.push(`Hash chain break at block ${curr.id}. Expected previous hash ${prev.hash}, got ${curr.previous_hash}`);
        }
      }

      if (isCompromised) {
        this.updateAuditStatus({
          status: 'compromised',
          hashChainContinuity: false,
          missingEvents,
          replayConsistency: false,
          corruptionIndicators: indicators
        });
      } else {
        this.updateAuditStatus({
          status: 'verified',
          hashChainContinuity: true,
          missingEvents: 0,
          replayConsistency: true,
          corruptionIndicators: []
        });
      }
    } catch (err: any) {
      console.error('Audit verification failed:', err);
      this.reportIncident('audit', 'warning', 'Failed to verify audit ledger', err.message);
    }
  }

  updateAPIHealth(status: 'healthy' | 'degraded' | 'critical', latency: number) {
    this.health.apiHealth = status;
    this.metrics.operationalLatency = latency;
    this.recalculateHealth();
    this.notify();
  }

  private recalculateHealth() {
    const unresolvedCritical = this.incidents.some(i => !i.resolved && i.severity === 'critical');
    const unresolvedWarning = this.incidents.some(i => !i.resolved && i.severity === 'warning');

    const subs = [
      this.health.apiHealth,
      this.health.databaseHealth,
      this.health.realtimeHealth,
      this.health.syncHealth,
      this.health.backgroundProcessingHealth
    ];

    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
    
    if (subs.includes('critical') || unresolvedCritical) {
      overall = 'critical';
    } else if (subs.includes('degraded') || unresolvedWarning) {
      overall = 'degraded';
    }

    this.health.status = overall;
    this.health.lastChecked = new Date().toISOString();
  }
}

export const ObservabilityEngine = new ObservabilityEngineCore();
