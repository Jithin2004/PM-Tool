import { supabase } from '../lib/supabase';

export interface HealthCheckResult {
  type: 'warning' | 'error' | 'info';
  message: string;
  actionRoute?: string;
}

export const workspaceHealthService = {
  async getHealthDiagnostics(workspaceId: string): Promise<HealthCheckResult[]> {
    if (!workspaceId) return [];

    const checks: HealthCheckResult[] = [];

    // 1. Fetch workspace settings
    const { data: wsData } = await supabase
      .from('workspaces')
      .select('business_type, metadata')
      .eq('id', workspaceId)
      .maybeSingle();

    let companyName = '';
    let country = '';
    let region = '';
    let baseCurrency = '';
    let passwordPolicy = '';

    if (wsData) {
      if (wsData.metadata && typeof wsData.metadata === 'object') {
        baseCurrency = wsData.metadata.baseCurrency || '';
        passwordPolicy = wsData.metadata.passwordPolicy || '';
      }
      try {
        if (wsData.business_type && typeof wsData.business_type === 'string' && wsData.business_type.startsWith('{')) {
          const parsed = JSON.parse(wsData.business_type);
          companyName = parsed.companyName || '';
          country = parsed.country || '';
          region = parsed.region || '';
        }
      } catch (e) {
        // Fallback
      }
    }

    if (!companyName) {
      checks.push({ type: 'warning', message: 'Company Name missing in Organization settings.', actionRoute: '/control/settings?tab=organization' });
    }
    if (!country) {
      checks.push({ type: 'warning', message: 'Company location missing. Required for holiday sync.', actionRoute: '/control/settings?tab=organization' });
    }
    if (!baseCurrency) {
      checks.push({ type: 'warning', message: 'Base currency not configured.', actionRoute: '/control/settings?tab=finance' });
    }
    if (!passwordPolicy) {
      checks.push({ type: 'info', message: 'Recommended: Configure a Password Policy in Security Settings.', actionRoute: '/control/settings?tab=security' });
    }

    // 2. Fetch calendar settings
    const { data: calData } = await supabase
      .from('workspace_calendar_settings')
      .select('working_days')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!calData || !calData.working_days || calData.working_days.length === 0) {
      checks.push({ type: 'warning', message: 'Working Calendar not configured. Please configure Company Calendar.', actionRoute: '/control?tab=calendar' });
    }

    // 3. Fetch license status
    const { data: licenseData } = await supabase
      .from('workspace_license')
      .select('id')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!licenseData) {
      checks.push({ type: 'warning', message: 'Workspace License is unactivated or invalid.', actionRoute: '/control/settings?tab=billing' });
    }

    return checks;
  }
};
