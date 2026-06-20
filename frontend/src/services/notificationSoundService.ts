import { supabase } from '../lib/supabase';

class NotificationSoundService {
  private audioCtx: AudioContext | null = null;
  private initialized = false;
  private settings: any = null;

  async loadPreferences(workspaceId: string, userId: string) {
    try {
      const { data } = await supabase
        .from('notification_preferences')
        .select('settings')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .maybeSingle();

      if (data?.settings) {
        this.settings = data.settings;
      }
    } catch (e) {
      console.error('Failed to load notification settings', e);
    }
  }

  async updatePreferences(workspaceId: string, userId: string, newSettings: any) {
    this.settings = newSettings;
    await supabase
      .from('notification_preferences')
      .upsert({
        workspace_id: workspaceId,
        user_id: userId,
        settings: newSettings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'workspace_id, user_id' });
  }

  initialize() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContext();
      this.initialized = true;
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  shouldPlaySound(priority: 'low' | 'normal' | 'high' | 'critical', category: string): boolean {
    if (!this.settings?.sound_enabled) return false;
    
    // Category check
    if (this.settings.category_sound && this.settings.category_sound[category] === false) return false;

    const now = new Date();
    
    // Focus Mode
    if (this.settings.focus_mode && priority !== 'critical') {
      return false;
    }

    // Quiet Hours
    if (this.settings.quiet_hours?.enabled && priority !== 'critical') {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [sH, sM] = this.settings.quiet_hours.start.split(':').map(Number);
      const [eH, eM] = this.settings.quiet_hours.end.split(':').map(Number);
      const startMin = sH * 60 + sM;
      const endMin = eH * 60 + eM;

      if (startMin < endMin) {
        if (currentMinutes >= startMin && currentMinutes <= endMin) return false;
      } else {
        // spans midnight
        if (currentMinutes >= startMin || currentMinutes <= endMin) return false;
      }
    }

    // Priority filter (Level = important means only high/critical)
    const level = this.settings.sound_level || 'important';
    if (level === 'important' && (priority === 'low' || priority === 'normal')) return false;
    if (level === 'critical' && priority !== 'critical') return false;

    return true;
  }

  async playNotificationSound(priority: 'low' | 'normal' | 'high' | 'critical', category: string) {
    if (!this.initialized || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
    
    if (!this.shouldPlaySound(priority, category)) return;

    if (priority === 'normal') this.playNormal();
    else if (priority === 'high') this.playHigh();
    else if (priority === 'critical') this.playCritical();
  }

  private playTone(freq: number, type: OscillatorType, duration: number, startTime: number) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + startTime);
    
    gain.gain.setValueAtTime(0, this.audioCtx.currentTime + startTime);
    gain.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + startTime + duration);
    
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    
    osc.start(this.audioCtx.currentTime + startTime);
    osc.stop(this.audioCtx.currentTime + startTime + duration);
  }

  private playNormal() {
    // Single soft chime
    this.playTone(880, 'sine', 0.5, 0); // A5
  }

  private playHigh() {
    // Two-tone attention
    this.playTone(880, 'sine', 0.2, 0);
    this.playTone(1046.50, 'sine', 0.4, 0.15); // C6
  }

  private playCritical() {
    // Stronger alert, triple tone
    this.playTone(440, 'triangle', 0.2, 0);
    this.playTone(440, 'triangle', 0.2, 0.15);
    this.playTone(659.25, 'triangle', 0.5, 0.3); // E5
  }
}

export const notificationSoundService = new NotificationSoundService();
