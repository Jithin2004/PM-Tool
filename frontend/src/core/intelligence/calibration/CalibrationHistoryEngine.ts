export class CalibrationHistoryEngine {
  private historyStore: Map<string, any[]> = new Map();

  public appendHistory(entityId: string, recordType: 'validation' | 'replay' | 'calibration', payload: any): void {
    if (!this.historyStore.has(entityId)) {
      this.historyStore.set(entityId, []);
    }
    
    this.historyStore.get(entityId)!.push({
      timestamp: new Date().toISOString(),
      type: recordType,
      data: payload
    });
  }

  public getHistory(entityId: string): any[] {
    return this.historyStore.get(entityId) || [];
  }
}
