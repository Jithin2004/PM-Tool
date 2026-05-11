export interface Project {
  id: number;
  name: string;
  client: string;
  status: 'pending' | 'inprogress' | 'inreview' | 'done';
  priority: number;
  
  // v3: PERT Estimation
  bestCaseHours: number;
  expectedCaseHours: number;
  worstCaseHours: number;
  
  // v3: Delay Factors
  waitDays: number;
  
  // v3: Tracking
  actualHours?: number;
  
  // v3: Team Association
  teamId?: string;

  overhead: number;
  clientDeadline: string;
  startDate: string;
  overheadItems: OverheadItem[];
  addedOn: string;
  health: 'ok' | 'risk' | 'late' | 'done';
  predictedEnd: string;
  predictedStart: string;
  delayDays: number;
  completedOn?: string;
  description?: string;
}

export interface Developer {
  id: string;
  name: string;
  efficiency: number; // 0.5 to 1.5 (Senior vs Junior)
  level: 'junior' | 'mid' | 'senior';
}

export interface Team {
  id: string;
  name: string;
  developers: Developer[];
  capacityPerDay: number; 
}

export interface OverheadItem {
  label: string;
  hours: number;
}

export interface AppConfig {
  hoursPerDay: number; 
  defaultOverhead: number;
  bufferPercent: number;
  contextSwitchCost: number; 
  fatigueFactor: number; // v3: Efficiency decay after 6 hours (e.g. 0.85)
}
