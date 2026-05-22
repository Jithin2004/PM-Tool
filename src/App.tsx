import { useEffect, useState, useCallback } from 'react';
import { AppProviders } from './app/providers';
import { ResolveRouter } from './app/router';
import { ProductKeyGate } from './components/auth/ProductKeyGate';
import { isProductKeyVerified } from './lib/productKey';
import { registerDebugTools } from './debug/registerDebugTools';

export default function App() {
  const [gateOpen, setGateOpen] = useState(!isProductKeyVerified());

  const handleVerified = useCallback(() => {
    setGateOpen(false);
  }, []);

  useEffect(() => {
    registerDebugTools().then(() => {
      import('./services/syntheticStressTest').then(m => {
        m.recoverAbandonedStressRuns().then(r => {
          if (r.recovered) {
            console.log('[Stress Recovery] Abandoned synthetic runs cleaned up:', r.details);
          }
        });
      });
    });
  }, []);

  if (gateOpen) {
    return <ProductKeyGate onVerified={handleVerified} />;
  }

  return (
    <AppProviders>
      <ResolveRouter />
    </AppProviders>
  );
}
