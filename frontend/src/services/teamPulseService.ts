import { reportingEngine } from '../core/engines/reportingEngine';
import { supabase } from '../lib/supabase';

export const teamPulseService = {
  /**
   * Generates a daily "pulse" view for managers.
   * No manual standup required.
   */
  async getDailyTeamPulse(workspaceId: string, teamId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch team members
    const { data: teamMembers } = await supabase
      .from('users') // Mock relation for team_members
      .select('*'); 
      // In reality: .from('team_members').eq('team_id', teamId)

    const members = teamMembers || [];
    
    // Fetch individual reports dynamically
    const memberPulses = await Promise.all(members.map(async (m) => {
      try {
        const report = await reportingEngine.generateUserReport({
          workspaceId,
          userId: m.id,
          startDate: startOfDay,
          endDate: endOfDay
        });

        // Pull active blocked tasks assigned to this user
        const { data: blocked } = await supabase
          .from('tasks')
          .select('id, name')
          .eq('assignee_id', m.id)
          .eq('status', 'blocked');

        return {
          userId: m.id,
          userName: m.full_name || m.email,
          completedCount: report.productivity.tasksCompleted,
          progressedCount: report.productivity.tasksProgressed,
          blockedTasks: blocked || [],
          needsHelp: blocked && blocked.length > 0 // Heuristic
        };
      } catch (err) {
        return null;
      }
    }));

    return {
      date: date.toISOString(),
      teamId,
      pulses: memberPulses.filter(Boolean)
    };
  }
};
