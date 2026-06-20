import { supabase } from '../../lib/supabase';
import { financeLedgerService } from '../../services/financeLedgerService';

export const payrollForecastEngine = {
  /**
   * Evaluates upcoming payroll obligations.
   * Pulls compensation data and available cash to detect shortages.
   */
  async forecastPayroll(workspaceId: string, accountId: string) {
    // 1. Get Settings
    const { data: settingsRow } = await supabase
      .from('finance_settings')
      .select('settings')
      .eq('workspace_id', workspaceId)
      .single();
    
    const payrollDay = settingsRow?.settings?.payroll_day || 1;

    // 2. Get active salaries
    const { data: salaries } = await supabase
      .from('compensation_packages')
      .select('user_id, base_salary, currency')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active');

    let totalObligation = 0;
    (salaries || []).forEach(s => {
      totalObligation += Number(s.base_salary);
    });

    // 3. Get Cash Position
    const availableCash = 0 /* mocked balance */;

    // 4. Determine Date
    const now = new Date();
    let nextPayrollDate = new Date(now.getFullYear(), now.getMonth(), payrollDay);
    if (nextPayrollDate < now) {
      nextPayrollDate = new Date(now.getFullYear(), now.getMonth() + 1, payrollDay);
    }

    // 5. Risk Assessment
    const shortageRisk = totalObligation > availableCash ? totalObligation - availableCash : 0;

    return {
      totalObligation,
      availableCash,
      nextPayrollDate: nextPayrollDate.toISOString(),
      shortageRisk,
      isAtRisk: shortageRisk > 0
    };
  }
};
