export interface OperationalSnapshot {
  id: string;
  timestamp: string;
  execution_snapshot_id: string;
  knowledge_snapshot_id: string;
  finance_snapshot_id: string;
  calendar_snapshot_id: string;
  commercial_snapshot_id: string;
}

export interface ExecutionSnapshot {
  id: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface KnowledgeSnapshot {
  id: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface FinanceSnapshot {
  id: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface CalendarSnapshot {
  id: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface CommercialSnapshot {
  id: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface MathematicalSnapshot {
    id: string;
    projectId: string;
    timestamp: Date;
    data: any;
    engine_outputs?: any;
}
