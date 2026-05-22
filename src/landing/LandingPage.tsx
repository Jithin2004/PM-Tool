import { useEffect } from 'react';
import { isProductKeyVerified } from '../lib/productKey';
import { LandingHero } from './LandingHero';
import { ProductShowcase } from './ProductShowcase';
import { OperationalNarrative } from './OperationalNarrative';
import { CommandPaletteDemo } from './CommandPaletteDemo';
import { RealtimePreview } from './RealtimePreview';
import { AIInsightsPreview } from './AIInsightsPreview';
import { AccessGateway } from './AccessGateway';

export function LandingPage() {
  const verified = isProductKeyVerified();

  useEffect(() => {
    if (verified) {
      const timer = setTimeout(() => {
        window.history.pushState(null, '', '/workspace');
        window.dispatchEvent(new Event('popstate'));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [verified]);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <LandingHero verified={verified} />
      <ProductShowcase />
      <OperationalNarrative />
      <CommandPaletteDemo />
      <RealtimePreview />
      <AIInsightsPreview />
      <AccessGateway verified={verified} />
    </div>
  );
}
