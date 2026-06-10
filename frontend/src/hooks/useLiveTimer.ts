import { useState, useEffect } from 'react';

export function useLiveTimer(startedAt: string | null) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const startTimestamp = new Date(startedAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diffInSeconds = Math.floor((now - startTimestamp) / 1000);
      setElapsedSeconds(diffInSeconds > 0 ? diffInSeconds : 0);
    };

    // Initial update
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return {
    elapsedSeconds,
    formattedTime: formatTime(elapsedSeconds)
  };
}
