import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Notification, NotificationCategory } from '../types';

/**
 * Dispatches a new notification to a workspace (or user specifically)
 */
export const sendNotification = async (
  workspaceId: string,
  category: NotificationCategory,
  title: string,
  body?: string,
  userId?: string,
  metadata?: Record<string, any>
): Promise<Notification | null> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        workspace_id: workspaceId,
        user_id: userId || null,
        category,
        title,
        body,
        metadata: metadata || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to send Supabase notification:", error);
      return null;
    }
    return data as Notification;
  } else {
    // Offline caching fallback
    const newNotif: Notification = {
      id: `local-notif-${Date.now()}`,
      workspace_id: workspaceId,
      user_id: userId,
      category,
      title,
      body,
      metadata: metadata || {},
      created_at: new Date().toISOString()
    };
    
    try {
      const cacheKey = `notifications_${workspaceId}`;
      const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      cached.unshift(newNotif);
      localStorage.setItem(cacheKey, JSON.stringify(cached));
    } catch (e) {
    }
    return newNotif;
  }
};

/**
 * Queries all notifications for a given workspace/user
 */
export const fetchNotifications = async (
  workspaceId: string,
  userId?: string
): Promise<Notification[]> => {
  if (isSupabaseConfigured) {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to fetch Supabase notifications:", error);
      return [];
    }
    return data as Notification[];
  } else {
    try {
      const cacheKey = `notifications_${workspaceId}`;
      return JSON.parse(localStorage.getItem(cacheKey) || '[]');
    } catch (e) {
      return [];
    }
  }
};

/**
 * Marks a notification as read
 */
export const markAsRead = async (
  notificationId: string,
  workspaceId: string
): Promise<boolean> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) {
      console.error("Failed to mark notification as read:", error);
      return false;
    }
    return true;
  } else {
    try {
      const cacheKey = `notifications_${workspaceId}`;
      const cached: Notification[] = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      const updated = cached.map(n => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n);
      localStorage.setItem(cacheKey, JSON.stringify(updated));
      return true;
    } catch (e) {
      return false;
    }
  }
};
