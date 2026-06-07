import React from 'react';
import { useTheme } from '../../context/ThemeContext';

/**
 * PremiumAppShell provides the global ambient background and layout shell
 * for the entire Resolve PM application.
 */
export function PremiumAppShell({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <div className={`app-shell app-premium-bg min-h-screen w-full flex flex-col text-[var(--pm-text)] transition-colors duration-300 ${theme === 'light' ? 'light' : ''}`}>
      {children}
    </div>
  );
}
