import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { playNotificationSound } from '../utils/soundAlert';

export interface NotificationPreferences {
  desktopEnabled: boolean;
  soundEnabled: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string;   // HH:mm format
  };
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  desktopEnabled: false,
  soundEnabled: true,
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00'
  }
};

export const getNotificationPreferences = async (userId: string): Promise<NotificationPreferences> => {
  if (!isSupabaseConfigured) return DEFAULT_PREFERENCES;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('notification_preferences')
      .eq('id', userId)
      .single();
    
    if (error || !data?.notification_preferences) return DEFAULT_PREFERENCES;
    
    return { ...DEFAULT_PREFERENCES, ...(data.notification_preferences as any) };
  } catch (err) {
    return DEFAULT_PREFERENCES;
  }
};

export const updateNotificationPreferences = async (userId: string, prefs: Partial<NotificationPreferences>): Promise<boolean> => {
  if (!isSupabaseConfigured) return false;
  try {
    const current = await getNotificationPreferences(userId);
    const updated = { ...current, ...prefs };
    const { error } = await supabase
      .from('users')
      .update({ notification_preferences: updated })
      .eq('id', userId);
    
    return !error;
  } catch (err) {
    return false;
  }
};

export const requestDesktopPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

const isQuietHours = (prefs: NotificationPreferences): boolean => {
  if (!prefs.quietHours.enabled) return false;
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour + currentMinute / 60;
  
  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };
  
  const start = parseTime(prefs.quietHours.start);
  const end = parseTime(prefs.quietHours.end);
  
  if (start < end) {
    return currentTime >= start && currentTime <= end;
  } else {
    // Crosses midnight
    return currentTime >= start || currentTime <= end;
  }
};

export const handleIncomingNotification = async (userId: string, title: string, body?: string) => {
  const prefs = await getNotificationPreferences(userId);
  
  if (isQuietHours(prefs)) return;
  
  if (prefs.soundEnabled) {
    playNotificationSound();
  }
  
  if (prefs.desktopEnabled && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
};
