export interface TraceContext {
  correlationId: string;
  runId: string;
  startedAt: string;
  observabilityLevel: 'OFF' | 'ERROR' | 'INFO' | 'TRACE';
  context: {
    workspace?: { id?: string; name?: string };
    user?: { id?: string; email?: string; role?: string };
    license?: { productKey?: string; plan?: string; seats?: number };
  };
}

export interface TimelineEvent {
  stage: string;
  status: 'STARTED' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  elapsedMs: number;
  message?: string;
}

const BUILD_METADATA = {
  version: '1.3.2',
  gitRevision: '8d42af',
  environment: import.meta.env?.MODE || 'production',
  buildTimestamp: new Date().toISOString()
};

const SECRET_KEYS = ['password', 'jwt', 'token', 'authorization', 'secret', 'service_role_key'];

function sanitize(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const copy: any = {};
  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    if (SECRET_KEYS.some(secret => lowerKey.includes(secret))) {
      if (lowerKey === 'productkey' && typeof obj[key] === 'string') {
        copy[key] = obj[key] === 'OFFLINE-LICENSE' ? 'OFFLINE-****' : `****-${obj[key].slice(-4)}`;
      } else {
        copy[key] = '[REDACTED]';
      }
    } else if (typeof obj[key] === 'object') {
      copy[key] = sanitize(obj[key]);
    } else {
      copy[key] = obj[key];
    }
  }
  return copy;
}

class FrontendLogger {
  private timeline: TimelineEvent[] = [];
  private timelineStart = 0;
  private currentContext: TraceContext | null = null;

  startTimeline(context: TraceContext) {
    this.timeline = [];
    this.timelineStart = Date.now();
    this.currentContext = context;
    this.logCheckpoint('HTTP-101', 'STARTED', 'Request Timeline started');
  }

  logCheckpoint(stage: string, status: 'STARTED' | 'SUCCESS' | 'FAILED' | 'SKIPPED', message?: string) {
    if (!this.timelineStart) {
      this.timelineStart = Date.now();
    }
    const elapsedMs = Date.now() - this.timelineStart;
    this.timeline.push({ stage, status, elapsedMs, message });

    // Output formatted log immediately to console (the only permitted stdout)
    const logPayload = {
      timestamp: new Date().toISOString(),
      level: status === 'FAILED' ? 'ERROR' : 'INFO',
      category: stage.split('-')[0] || 'SYSTEM',
      stage,
      status,
      correlationId: this.currentContext?.correlationId,
      runId: this.currentContext?.runId,
      durationMs: elapsedMs,
      build: BUILD_METADATA,
      context: sanitize(this.currentContext?.context),
      message
    };

    // Auto-elevate log levels for latency alarms
    if (elapsedMs > 2000) {
      logPayload.level = 'ERROR';
    } else if (elapsedMs > 500) {
      logPayload.level = 'WARN';
    }

    const consoleMethod = logPayload.level === 'ERROR' ? 'error' : logPayload.level === 'WARN' ? 'warn' : 'log';
    console[consoleMethod](JSON.stringify(logPayload));
  }

  dumpTimeline(): string {
    if (!this.currentContext) return 'No active trace context';
    
    let out = `Correlation ID: ${this.currentContext.correlationId}\nRun ID: ${this.currentContext.runId}\n\n`;
    out += `Timeline\n`;
    
    let warnings = 0;
    let errors = 0;
    
    this.timeline.forEach(evt => {
      let flag = '';
      if (evt.elapsedMs > 2000 || evt.status === 'FAILED') {
        flag = ' [ERROR]';
        errors++;
      } else if (evt.elapsedMs > 500) {
        flag = ' [WARN]';
        warnings++;
      }
      out += `${evt.elapsedMs.toString().padStart(5, '0')}ms ${evt.stage.padEnd(10, ' ')} ${evt.status.padEnd(9, ' ')} ${evt.message || ''}${flag}\n`;
    });

    const isSuccess = this.timeline.length > 0 && this.timeline[this.timeline.length - 1].status === 'SUCCESS';
    const totalDuration = this.timeline.length > 0 ? this.timeline[this.timeline.length - 1].elapsedMs : 0;

    out += `\nFinal Summary: ${isSuccess ? 'SUCCESS' : 'FAILED'}\n`;
    out += `Duration: ${totalDuration} ms\n`;
    out += `Stages: ${this.timeline.length}\n`;
    out += `Warnings: ${warnings}\n`;
    out += `Errors: ${errors}\n`;

    console.log(out);
    return out;
  }

  logDecision(stage: string, decision: string, reason: string, contextMetadata?: any) {
    const logPayload = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      category: 'BOOTSTRAP',
      stage,
      status: 'SUCCESS',
      correlationId: this.currentContext?.correlationId || sessionStorage.getItem('resolve_pm_correlation_id') || undefined,
      runId: this.currentContext?.runId || sessionStorage.getItem('resolve_pm_run_id') || undefined,
      build: BUILD_METADATA,
      context: {
        ...sanitize(this.currentContext?.context),
        ...contextMetadata
      },
      message: `[Decision] ${decision}: ${reason}`
    };
    console.log(JSON.stringify(logPayload));
  }

  createContext(correlationId: string, runId: string, user: any = null, workspace: any = null, license: any = null): TraceContext {
    return {
      correlationId,
      runId,
      startedAt: new Date().toISOString(),
      observabilityLevel: 'INFO',
      context: {
        user: user ? { id: user.id, email: user.email, role: user.role } : undefined,
        workspace: workspace ? { id: workspace.id, name: workspace.name } : undefined,
        license: license ? { productKey: license.productKey, plan: license.plan, seats: license.seats } : undefined
      }
    };
  }
}

export const logger = new FrontendLogger();
