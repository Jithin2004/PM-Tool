import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock } from 'lucide-react';

export function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden sm:block">
      UPTIME: {time.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </div>
  );
}

