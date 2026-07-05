export class BootLogger {
  private static enabled = import.meta.env.DEV;
  private static startTime = Date.now();
  
  static log(stage: string, message: string) {
    if (!this.enabled) return;
    const elapsed = Date.now() - this.startTime;
    console.info(`[BOOTSTRAP][${stage}] +${elapsed}ms | ${message}`);
  }

  static warn(message: string, context?: any) {
    if (!this.enabled) return;
    const elapsed = Date.now() - this.startTime;
    console.warn(`[BOOTSTRAP][WARN] +${elapsed}ms | ${message}`, context || '');
  }

  static reset() {
    this.startTime = Date.now();
  }
}
