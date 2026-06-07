import { supabase } from '../lib/supabase';

export interface LifecycleAlert {
  employeeId: string;
  name: string;
  role: string;
  type: 'internship_ending' | 'contract_ending' | 'probation_ending';
  daysRemaining: number;
  message: string;
}

export const employeeLifecycleService = {
  async getUpcomingExpirations(workspaceId: string): Promise<LifecycleAlert[]> {
    const { data: records, error } = await supabase
      .from('employment_records')
      .select('id, employee_id, contract_end, probation_end, employment_type, users(id, name, email)')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active');

    if (error || !records) return [];

    const alerts: LifecycleAlert[] = [];
    const now = new Date();

    records.forEach((record: any) => {
      const user = record.users;
      if (!user) return;

      if (record.contract_end) {
        const endDate = new Date(record.contract_end);
        const days = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        
        if (days >= 0 && days <= 30) {
          const isIntern = record.employment_type === 'intern';
          alerts.push({
            employeeId: user.id,
            name: user.name || user.email,
            role: record.employment_type,
            type: isIntern ? 'internship_ending' : 'contract_ending',
            daysRemaining: days,
            message: `${user.name || user.email}'s ${isIntern ? 'internship' : 'contract'} ends in ${days} days.`
          });
        }
      }

      if (record.probation_end) {
        const probDate = new Date(record.probation_end);
        const probDays = Math.ceil((probDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        
        if (probDays >= 0 && probDays <= 15) {
          alerts.push({
            employeeId: user.id,
            name: user.name || user.email,
            role: record.employment_type,
            type: 'probation_ending',
            daysRemaining: probDays,
            message: `${user.name || user.email}'s probation ends in ${probDays} days.`
          });
        }
      }
    });

    return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }
};
