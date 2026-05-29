export type HealthStatus = 'healthy' | 'degraded' | 'critical';
export type RealtimeStatus = 'healthy' | 'reconnecting' | 'degraded' | 'offline';
export type AuditStatus = 'verified' | 'warning' | 'compromised';
export type IncidentSeverity = 'info' | 'warning' | 'critical';

export interface PlatformHealthStatus {
  status: HealthStatus;
  reasons: string[];
  apiHealth: HealthStatus;
  databaseHealth: HealthStatus;
  realtimeHealth: HealthStatus;
  syncHealth: HealthStatus;
  backgroundProcessingHealth: HealthStatus;
  lastChecked: string;
}

export interface RealtimeHealthProfile {
  status: RealtimeStatus;
  reconnectFrequency: number;
  reconnectStorms: number;
  staleSubscriptions: number;
  activeChannels: number;
  lastDisconnect: string | null;
}

export interface AuditIntegrityStatus {
  status: AuditStatus;
  hashChainContinuity: boolean;
  missingEvents: number;
  replayConsistency: boolean;
  corruptionIndicators: string[];
  lastVerified: string;
}

export interface ReplayIntegrityProfile {
  successRate: number;
  failures: number;
  rejections: number;
  staleAttempts: number;
  queueSize: number;
  queueCorruptionIndicators: string[];
}

export interface OperationalReliabilityMetrics {
  platformAvailability: number; // Percentage
  operationalLatency: number; // ms
  realtimeLatency: number; // ms
  replaySuccessRate: number; // Percentage
  syncSuccessRate: number; // Percentage
  auditVerificationSuccess: number; // Percentage
}

export interface IncidentRecord {
  id: string;
  timestamp: string;
  severity: IncidentSeverity;
  category: 'api' | 'database' | 'realtime' | 'sync' | 'audit' | 'replay' | 'governance' | 'auth';
  message: string;
  causality: string;
  context: Record<string, any>;
  dedupCount: number;
  resolved: boolean;
}
