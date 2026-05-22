import { useEffect } from 'react';
import { isProductKeyVerified } from '../lib/productKey';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { LandingHero } from './LandingHero';
import { ProductShowcase } from './ProductShowcase';
import { OperationalNarrative } from './OperationalNarrative';
import { CommandPaletteDemo } from './CommandPaletteDemo';
import { RealtimePreview } from './RealtimePreview';
import { AIInsightsPreview } from './AIInsightsPreview';
import { AccessGateway } from './AccessGateway';

export function LandingPage() {
  const verified = isProductKeyVerified();
  const { user, profile } = useAuth();
  const { workspace } = useWorkspace();

  useEffect(() => {
    // Verified user with valid access → skip landing entirely
    if (verified && user && profile && profile.role !== 'uninvited' && workspace) {
      window.history.replaceState(null, '', '/workspace');
      window.dispatchEvent(new Event('popstate'));
      return;
    }

    // Verified but not authenticated yet → brief delay then redirect to auth flow
    if (verified && !user) {
      const timer = setTimeout(() => {
        window.history.pushState(null, '', '/workspace');
        window.dispatchEvent(new Event('popstate'));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [verified, user, profile, workspace]);

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
