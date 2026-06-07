import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Meeting, MeetingAttendee } from '../types';

export const meetingService = {
  async createMeeting(meeting: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>): Promise<Meeting | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from('meetings')
      .insert(meeting)
      .select()
      .single();
    if (error) { console.error('meetingService.createMeeting:', error); return null; }
    return data as Meeting;
  },

  async updateMeeting(id: string, updates: Partial<Meeting>): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const { error } = await supabase.from('meetings').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    return !error;
  },

  async deleteMeeting(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const { error } = await supabase.from('meetings').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null);
    return !error;
  },

  async getMeetings(workspaceId: string, projectId?: string): Promise<Meeting[]> {
    if (!isSupabaseConfigured) return [];
    let query = supabase.from('meetings').select('*').limit(50).eq('workspace_id', workspaceId).is('deleted_at', null).order('start_time', { ascending: true });
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) { console.error('meetingService.getMeetings:', error); return []; }
    return (data || []) as Meeting[];
  },

  async addAttendee(meetingId: string, userId: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const { error } = await supabase.from('meeting_attendees').insert({ meeting_id: meetingId, user_id: userId, attended: false });
    return !error;
  },

  async markAttended(meetingId: string, userId: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const { error } = await supabase.from('meeting_attendees').update({ attended: true }).eq('meeting_id', meetingId).eq('user_id', userId);
    return !error;
  },

  async getAttendees(meetingId: string): Promise<MeetingAttendee[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('meeting_attendees').select('*').limit(50).eq('meeting_id', meetingId);
    if (error) { console.error('meetingService.getAttendees:', error); return []; }
    return (data || []) as MeetingAttendee[];
  },
};
