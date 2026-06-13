import { supabase } from '../lib/supabase';

export interface HealthCheckResult {
  type: 'warning' | 'error' | 'info';
  message: string;
}

export const workspaceHealthService = {
  async getHealthDiagnostics(workspaceId: string): Promise<HealthCheckResult[]> {
    if (!workspaceId) return [];

    const checks: HealthCheckResult[] = [];

    // 1. Fetch workspace settings
    const { data: wsData } = await supabase
      .from('workspace_settings')
      .select('settings_blob')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    const s = wsData?.settings_blob || {};

    if (!s.companyName) {
      checks.push({ type: 'warning', message: 'Company Name missing in Organization settings.' });
    }
    if (!s.country || !s.region) {
      checks.push({ type: 'warning', message: 'Company location missing. Required for holiday sync.' });
    }
    if (!s.baseCurrency) {
      checks.push({ type: 'warning', message: 'Base currency not configured.' });
    }
    if (!s.passwordPolicy) {
      checks.push({ type: 'info', message: 'Recommended: Configure a Password Policy in Security Settings.' });
    }

    // 2. Fetch calendar settings
    const { data: calData } = await supabase
      .from('workspace_calendar_settings')
      .select('working_days')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!calData || !calData.working_days || calData.working_days.length === 0) {
      checks.push({ type: 'warning', message: 'Working Calendar not configured. Please configure Company Calendar.' });
    }

    // 3. Fetch license status
    const { data: licenseData } = await supabase
      .from('workspace_license')
      .select('status')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!licenseData || licenseData.status !== 'active') {
      checks.push({ type: 'warning', message: 'Workspace License is unactivated or invalid.' });
    }

    return checks;
  }
};
