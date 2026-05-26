import type { Team } from '../../types';
import type { AttendanceRow, SalaryRow } from './types';

export function buildLogisticsSystemData(input: {
  teams: Team[];
  attendanceRows: AttendanceRow[];
  salaryRows: SalaryRow[];
  workspaceSettingsBlob: Record<string, unknown>;
}): Record<string, unknown> {
  const systemSettings = input.teams.find(t => t.name === 'SYSTEM_SETTINGS');
  const rawSystemData = (systemSettings?.data as Record<string, unknown>) || {};
  const data: Record<string, unknown> = { ...rawSystemData, ...input.workspaceSettingsBlob };

  if (input.attendanceRows.length > 0) {
    const records: Record<string, Record<string, unknown>> = {};
    input.attendanceRows.forEach(row => {
      if (!records[row.date]) records[row.date] = {};
      records[row.date][row.user_id] = {
        status: row.status,
        leaveType: row.leave_type || undefined,
        isPaidHalfDay:
          row.is_paid_half_day !== undefined
            ? row.is_paid_half_day
            : row.availability_factor === 0.5,
      };
    });
    data.attendance = records;
  }

  if (input.salaryRows.length > 0) {
    const salaries: Record<string, number> = {};
    input.salaryRows.forEach(row => {
      salaries[row.user_id] = Number(row.base_salary);
    });
    data.salaries = salaries;
  }

  return data;
}
