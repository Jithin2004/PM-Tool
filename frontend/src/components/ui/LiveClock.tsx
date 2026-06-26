import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock } from 'lucide-react';

export function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="hidden sm:flex items-center gap-2 bg-surface-2 border border-border px-3 py-1.5 rounded-md shadow-sm">
      <Clock className="w-3.5 h-3.5 text-text-tertiary" />
      <span className="text-[11px] font-mono font-medium tracking-wide text-text-secondary">
        {dateStr}
      </span>
      <span className="w-1 h-1 rounded-full bg-border" />
      <span className="text-[11px] font-mono font-bold tracking-widest text-[var(--pm-primary)]">
        {timeStr}
      </span>
    </div>
  );
}
