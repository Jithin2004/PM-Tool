import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Sprint } from '../types';

export const sprintService = {
  async createSprint(sprint: Omit<Sprint, 'id' | 'created_at' | 'updated_at'>): Promise<Sprint | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.from('sprints').insert(sprint).select().single();
    if (error) { console.error('sprintService.createSprint:', error); return null; }
    return data as Sprint;
  },

  async updateSprint(id: string, updates: Partial<Sprint>): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const { error } = await supabase.from('sprints').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    return !error;
  },

  async deleteSprint(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const { error } = await supabase.from('sprints').delete().eq('id', id);
    return !error;
  },

  async getSprints(workspaceId: string, projectId?: string): Promise<Sprint[]> {
    if (!isSupabaseConfigured) return [];
    let query = supabase.from('sprints').select('*').eq('workspace_id', workspaceId).order('start_date', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) { console.error('sprintService.getSprints:', error); return []; }
    return (data || []) as Sprint[];
  },

  async getActiveSprint(workspaceId: string, projectId: string): Promise<Sprint | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from('sprints')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('project_id', projectId)
      .eq('status', 'active')
      .maybeSingle();
    if (error || !data) return null;
    return data as Sprint;
  },

  async calculateVelocity(sprintId: string): Promise<{ committed: number; completed: number }> {
    if (!isSupabaseConfigured) return { committed: 0, completed: 0 };
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('story_points, status')
      .eq('sprint_id', sprintId);
    if (error || !tasks) return { committed: 0, completed: 0 };
    const committed = tasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
    const completed = tasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (t.story_points || 0), 0);
    return { committed, completed };
  },

  async getBurndownData(sprintId: string, startDate: string, endDate: string): Promise<{ date: string; ideal: number; actual: number }[]> {
    if (!isSupabaseConfigured) return [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const { data: tasks } = await supabase.from('tasks').select('story_points, status, updated_at').eq('sprint_id', sprintId);
    if (!tasks) return [];
    const totalPoints = tasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
    const dailyIdeal = totalPoints / Math.max(1, totalDays);
    const points = [];
    for (let i = 0; i <= totalDays; i++) {
      const date = new Date(start.getTime() + i * 86400000);
      const dateStr = date.toISOString().split('T')[0];
      const ideal = Math.max(0, totalPoints - dailyIdeal * i);
      const actual = tasks
        .filter(t => t.status === 'done' && t.updated_at && new Date(t.updated_at) <= date)
        .reduce((sum, t) => sum + (t.story_points || 0), 0);
      points.push({ date: dateStr, ideal: Math.round(ideal * 10) / 10, actual: totalPoints - actual });
    }
    return points;
  }
};
