
import { IntelligenceApp } from '../application/IntelligenceContainer';
import { supabase as supabaseClient } from '../../../lib/supabase';

export class ForecastRefreshPipeline {
    public static initializeGlobalListeners(workspaceId: string) {
        supabaseClient.channel('workspace_' + workspaceId + '_events')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
                IntelligenceApp.commands.triggerForecastRefresh((payload.new as any).project_id).catch(console.error);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sprints' }, payload => {
                IntelligenceApp.commands.invalidateCache('project', (payload.new as any).project_id).catch(console.error);
            })
            .subscribe();
    }
}
