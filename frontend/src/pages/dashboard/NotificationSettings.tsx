import React from 'react';

export default function NotificationSettings() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[10px] font-mono uppercase tracking-wide text-text-quaternary">CONTROL</span>
        <span className="text-text-quaternary">/</span>
        <span className="text-xs font-mono text-text-secondary">Settings</span>
        <span className="text-text-quaternary">/</span>
        <span className="text-[10px] font-mono text-text-tertiary">Notifications</span>
      </div>
      <div className="border border-border bg-surface-3 p-12 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] font-mono text-text-quaternary uppercase tracking-wider">Notification Channels</span>
        <span className="text-[9px] font-mono text-text-quaternary mt-2">Email, Push, Mentions, Escalations — coming soon</span>
      </div>
    </div>
  );
}
