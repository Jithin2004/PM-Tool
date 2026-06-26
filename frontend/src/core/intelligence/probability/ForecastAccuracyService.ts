export class ForecastAccuracyService {
  private accuracyStore = new Map<string, any[]>();

  public trackAccuracy(domain: string, metrics: any): void {
    if (!this.accuracyStore.has(domain)) {
      this.accuracyStore.set(domain, []);
    }
    this.accuracyStore.get(domain)!.push({
      timestamp: new Date().toISOString(),
      metrics
    });
  }

  public getHistoricalAccuracy(): Record<string, any[]> {
    const result: Record<string, any[]> = {};
    for (const [key, val] of this.accuracyStore.entries()) {
      result[key] = val;
    }
    return result;
  }
}
