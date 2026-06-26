export class IntelligenceCache {
  private cache = new Map<string, { payload: any, timestamp: number }>();
  private readonly TTL_MS = 1000 * 60 * 15; // 15 minutes default

  public get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    return entry.payload;
  }

  public set(key: string, payload: any): void {
    this.cache.set(key, { payload, timestamp: Date.now() });
  }

  public invalidateProject(projectId: string): void {
    // Selectively clear cache only for affected projects
    for (const key of this.cache.keys()) {
      if (key.includes(projectId)) {
        this.cache.delete(key);
      }
    }
  }
}
