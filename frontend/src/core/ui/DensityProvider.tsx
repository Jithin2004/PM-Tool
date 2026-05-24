import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { DensityMode } from './densityCalibration';
import { resolveDensity, getDensityConfig } from './densityCalibration';
import { getDensityTokens } from '../../design/operationalDensity';
import type { DensityTokens } from '../../design/operationalDensity';

interface DensityContextValue {
  mode: DensityMode;
  tokens: DensityTokens;
}

const DensityContext = createContext<DensityContextValue | null>(null);

export function DensityProvider({
  surface,
  children,
}: {
  surface: 'mission-control' | 'board' | 'dashboard' | 'timeline';
  children: ReactNode;
}) {
  const mode = resolveDensity(surface);
  const value = useMemo(() => ({ mode, tokens: getDensityTokens(mode) }), [mode]);
  return (
    <DensityContext.Provider value={value}>
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity(): DensityContextValue {
  const ctx = useContext(DensityContext);
  if (!ctx) return { mode: 'standard', tokens: getDensityTokens('standard') };
  return ctx;
}
