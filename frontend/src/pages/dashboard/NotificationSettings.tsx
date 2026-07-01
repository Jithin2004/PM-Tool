import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

export default function NotificationSettings() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported' | 'private_error'>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    } else {
      setPermission('unsupported');
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
    } catch (err) {
      console.error('Failed to request notification permission', err);
      setPermission('private_error');
    }
  };

  const testNotification = () => {
    if (permission === 'granted') {
      new Notification('Resolve PM: Test Notification', {
        body: 'Your notification system is working correctly.',
        icon: '/favicon.ico' // Or any suitable icon if exists
      });
    } else if (permission === 'default') {
      requestPermission().then(() => {
        if (Notification.permission === 'granted') {
          new Notification('Resolve PM: Test Notification', {
            body: 'Your notification system is working correctly.',
            icon: '/favicon.ico'
          });
        }
      });
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[10px] font-mono uppercase tracking-wide text-text-quaternary">CONTROL</span>
        <span className="text-text-quaternary">/</span>
        <span className="text-xs font-mono text-text-secondary">Settings</span>
        <span className="text-text-quaternary">/</span>
        <span className="text-[10px] font-mono text-text-tertiary">Notifications</span>
      </div>

      <div className="max-w-3xl">
        <h2 className="text-xl font-semibold tracking-tight text-text-primary mb-6">Notification System Verification</h2>
        
        <div className="bg-surface-2 border border-[var(--border-soft)] rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-400" />
                Browser Notifications
              </h3>
              <p className="text-xs text-text-tertiary leading-relaxed max-w-md">
                Verify that your browser and operating system are configured to receive desktop notifications from Resolve PM.
              </p>
            </div>
            
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-highest)] border border-[var(--border-soft)]">
                {permission === 'granted' && (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">✓ Notifications Enabled</span>
                  </>
                )}
                {permission === 'default' && (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-medium text-amber-400">⚠ Permission Required</span>
                  </>
                )}
                {permission === 'denied' && (
                  <>
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-medium text-rose-400">✕ Notifications Blocked</span>
                  </>
                )}
                {permission === 'unsupported' && (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-medium text-rose-400">✕ Unsupported Browser</span>
                  </>
                )}
                {permission === 'private_error' && (
                  <>
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-medium text-rose-400">✕ Blocked by Privacy Settings</span>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {permission === 'default' && (
                  <button 
                    onClick={requestPermission}
                    className="px-4 py-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 border border-indigo-500/20 rounded-lg text-xs font-medium transition-colors"
                  >
                    Enable Notifications
                  </button>
                )}
                <button 
                  onClick={testNotification}
                  className="px-4 py-2 bg-[var(--surface-highest)] border border-[var(--border-soft)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary transition-all shadow-sm"
                >
                  Test Notifications
                </button>
              </div>
            </div>
          </div>
          
          {permission === 'denied' && (
            <div className="mt-6 p-4 rounded-lg bg-rose-500/5 border border-rose-500/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-rose-400 mb-1">Action Required: Unblock in Browser</h4>
                <p className="text-xs text-rose-400/80 leading-relaxed">
                  You have blocked notifications for this site. To receive alerts, please click the site information icon (🔒 or ⓘ) in your browser's address bar, find the Notifications permission, and change it to "Allow". Then click "Test Notifications" again.
                </p>
              </div>
            </div>
          )}
          {permission === 'unsupported' && (
            <div className="mt-6 p-4 rounded-lg bg-rose-500/5 border border-rose-500/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-rose-400 mb-1">Unsupported Browser</h4>
                <p className="text-xs text-rose-400/80 leading-relaxed">
                  Your current browser does not support desktop notifications. Please use a modern browser like Chrome, Firefox, Safari, or Edge to receive alerts.
                </p>
              </div>
            </div>
          )}
          {permission === 'private_error' && (
            <div className="mt-6 p-4 rounded-lg bg-rose-500/5 border border-rose-500/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-rose-400 mb-1">Blocked by Privacy Settings</h4>
                <p className="text-xs text-rose-400/80 leading-relaxed">
                  We could not request notification permissions. This typically happens if you are in Private Browsing / Incognito mode, or if your browser's strict privacy settings block notification requests globally.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
