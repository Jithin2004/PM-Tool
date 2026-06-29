import React, { useEffect, useState } from 'react';

interface ResolveBootScreenProps {
  fadeOut: boolean;
  onFadeComplete?: () => void;
}

const BOOT_MESSAGES = [
  'Initializing workspace',
  'Loading command engine',
  'Preparing environment'
];

export function ResolveBootScreen({ fadeOut, onFadeComplete }: ResolveBootScreenProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % BOOT_MESSAGES.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  // Failsafe for Playwright/Headless environments where transition events might drop
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (fadeOut && onFadeComplete) {
      timeout = setTimeout(() => {
        onFadeComplete();
      }, 1000); // slightly longer than the 700ms transition duration
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [fadeOut, onFadeComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050712] select-none overflow-hidden transition-all duration-700 ease-in-out ${
        fadeOut ? 'opacity-0 pointer-events-none scale-105' : 'opacity-100 scale-100'
      }`}
      onTransitionEnd={(e) => {
        // Ensure we only trigger on main container opacity transitions
        if (fadeOut && e.target === e.currentTarget && onFadeComplete) {
          onFadeComplete();
        }
      }}
    >
      {/* Animated glowing background */}
      <div className="absolute w-72 h-72 rounded-full bg-indigo-500/5 blur-3xl animate-pulse" />
      
      {/* Minimal Box Container */}
      <div className="flex flex-col items-center text-center space-y-6 max-w-sm w-full p-8 rounded-2xl border border-white/5 bg-slate-950/30 backdrop-blur-md shadow-2xl relative">
        {/* Shimmering Logo container */}
        <div className="w-16 h-16 rounded-2xl border border-white/10 bg-slate-900/40 p-2 flex items-center justify-center shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer" />
          <img src="/logo.png" alt="Resolve PM" className="w-12 h-12 object-contain" />
        </div>

        {/* Brand Title */}
        <div className="space-y-1">
          <h1 className="font-sans text-[15px] font-semibold tracking-wider text-white uppercase">
            Resolve <span className="text-indigo-400 font-medium">PM</span>
          </h1>
          <p className="font-mono text-[9px] text-white/40 tracking-widest uppercase">
            Enterprise Command
          </p>
        </div>

        {/* Loading Indicator */}
        <div className="w-36 h-[2px] bg-white/5 rounded-full overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-loading-bar" />
        </div>

        {/* Cycling System Status Messages */}
        <div className="h-4 flex items-center justify-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-indigo-300/70 transition-all duration-300 ease-in-out">
            {BOOT_MESSAGES[messageIndex]}...
          </p>
        </div>
      </div>
    </div>
  );
}
