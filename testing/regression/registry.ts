export interface RegressionMetadata {
  id: string; // Regression ID
  ticketId: string;
  description: string;
  category: RegressionCategories;
  dateAdded: string;
  
  // New Phase 2.1 Fields
  component?: string;
  feature?: string;
  capability?: string;
  workspace?: string;
  browser?: string;
  videoPath?: string;
  screenshotPath?: string;
  tracePath?: string;
  dbSnapshot?: any;
  stackTrace?: string;
  reproductionSteps?: string[];
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  owner?: string;
}

export enum RegressionCategories {
  UI_UX = 'UI_UX',
  API = 'API',
  DATABASE = 'DATABASE',
  PERFORMANCE = 'PERFORMANCE',
  SECURITY = 'SECURITY',
}

export class RegressionRegistry {
  private static regressions: Map<string, RegressionMetadata> = new Map();

  static register(metadata: RegressionMetadata) {
    this.regressions.set(metadata.id, metadata);
  }

  static getRegressions() {
    return Array.from(this.regressions.values());
  }
}
