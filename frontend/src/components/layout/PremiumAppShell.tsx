import React from 'react';
import { useTheme } from '../../context/ThemeContext';

/**
 * PremiumAppShell provides the global ambient background and layout shell
 * for the entire Resolve PM application.
 */
export function PremiumAppShell({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <div className={`app-shell bg-[var(--color-bg-base)] min-h-screen w-full flex flex-col text-[var(--color-text-primary)] transition-colors duration-[var(--dur-base)] ${theme === 'light' ? 'light' : ''}`}>
      {children}
    </div>
  );
}
