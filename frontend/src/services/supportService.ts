import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import packageJson from '../../package.json';

export interface SupportPackage {
  systemVersion: string;
  schemaVersion: string;
  generatedAt: string;
  workspaceId: string;
  diagnostics: {
    systemEvents: any[];
    failedJobs: any[];
    recentMigrations: any[];
  };
  healthCheck: {
    missingIndexes: boolean;
    slowQueries: boolean;
    orphanRecords: boolean;
  };
}

export const supportService = {
  async generateSupportPackage(workspaceId: string): Promise<SupportPackage | null> {
    if (!isSupabaseConfigured || !workspaceId) return null;

    // Fetch safe telemetry and system events (No PII)
    const [eventsReq, migrationsReq] = await Promise.all([
      supabase.from('system_events').select('id, event_type, severity, message, created_at, source').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(200),
      supabase.from('system_migrations').select('*').order('applied_at', { ascending: false }).limit(20)
    ]);

    const pkg: SupportPackage = {
      systemVersion: packageJson.version,
      schemaVersion: 'PostgreSQL 15.x',
      generatedAt: new Date().toISOString(),
      workspaceId,
      diagnostics: {
        systemEvents: eventsReq.data || [],
        failedJobs: (eventsReq.data || []).filter(e => e.severity === 'error' || e.severity === 'critical'),
        recentMigrations: migrationsReq.data || []
      },
      healthCheck: {
        missingIndexes: false,
        slowQueries: false,
        orphanRecords: false
      }
    };

    // Log the generation
    await activityLogService.appendLog({
      workspace_id: workspaceId,
      action: 'support_package_generated',
      metadata: { generated_at: pkg.generatedAt, events_count: pkg.diagnostics.systemEvents.length }
    });

    return pkg;
  },

  downloadPackage(pkg: SupportPackage) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pkg, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `resolve-pm-support-${new Date().getTime()}.json`);
    dlAnchorElem.click();
  }
};
