import { useEffect } from 'react';
import { isProductKeyVerified } from '../lib/productKey';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { navigateTo, resolveAuthenticatedDestination } from '../core/auth/postAuthRedirect';
import { LandingHero } from './LandingHero';
import { ProductShowcase } from './ProductShowcase';
import { OperationalNarrative } from './OperationalNarrative';
import { CommandPaletteDemo } from './CommandPaletteDemo';
import { RealtimePreview } from './RealtimePreview';
import { AIInsightsPreview } from './AIInsightsPreview';
import { AccessGateway } from './AccessGateway';

export function LandingPage() {
  const verified = isProductKeyVerified();
  const { user, profile, profileResolved, loading: authLoading } = useAuth();
  const { workspace, loading: workspaceLoading } = useWorkspace();

  const authReady = verified && profileResolved && !authLoading;
  const hasSession = authReady && !!user && !!profile && profile.role !== 'uninvited';

  useEffect(() => {
    if (!hasSession) return;

    const destination = resolveAuthenticatedDestination(profile!.role, !!workspace, null);

    if (workspaceLoading && profile!.role !== 'pending-workspace-setup' && !workspace) {
      return;
    }

    navigateTo(destination, true);
  }, [hasSession, profile, workspace, workspaceLoading]);

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
