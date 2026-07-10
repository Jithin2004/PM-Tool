import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ProvisioningState } from '../../core/lifecycle/types';
import { useBootstrap } from '../../core/lifecycle/BootstrapOrchestrator';
import { ProductKeyGate } from './ProductKeyGate';
import { AlertCircle, UserMinus, Building, Ban, KeyRound, RefreshCw, Mail, Settings, Clock } from 'lucide-react';
import { ResolveLayout } from '../../app/layouts/ResolveLayout';
import { replace } from '../../lib/navigation';

interface ProvisioningGateProps {
  state: ProvisioningState;
}

export function ProvisioningGate({ state }: ProvisioningGateProps) {
  const { logout, profile } = useAuth();
  const { retryProvisioning } = useBootstrap();
  const [showProductKeyGate, setShowProductKeyGate] = useState(false);

  // ── v2 early returns: redirect rather than gate ─────────────────────────────

  // WORKSPACE_UNINIT: super_admin must complete /workspace-init before anyone logs in
  if (state === ProvisioningState.WORKSPACE_UNINIT) {
    if (profile?.role === 'super_admin') {
      replace('/workspace-init');
      return null;
    }
    // Non-owners see a holding screen until the owner completes setup
    return (
      <ResolveLayout eyebrow="Setup in Progress">
        <div className="flex flex-col items-center justify-center min-h-[80vh] w-full p-4 font-geist text-center">
          <div className="bg-surface-2 p-8 rounded-xl border border-border/50 max-w-lg w-full shadow-2xl">
            <div className="w-16 h-16 bg-surface-3 rounded-full flex items-center justify-center mx-auto mb-6 border border-border/50">
              <Clock className="w-8 h-8 text-[var(--pm-primary)] animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--pm-on-surface)] mb-4 tracking-tight">Workspace Setup In Progress</h2>
            <p className="text-sm text-[var(--pm-on-surface-variant)] mb-8 leading-relaxed">
              Your workspace owner is completing the initial configuration.<br/>
              You'll be able to log in once setup is complete.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={retryProvisioning}
                className="w-full px-4 py-3 bg-[var(--pm-primary)]/10 hover:bg-[var(--pm-primary)]/20 text-[var(--pm-primary)] rounded-lg transition-colors border border-[var(--pm-primary)]/20 flex items-center justify-center gap-3 font-semibold text-sm">
                <RefreshCw className="w-4 h-4" /> Check Again
              </button>
              <button onClick={logout}
                className="w-full px-4 py-3 bg-transparent hover:bg-surface-3 text-[var(--pm-on-surface-variant)] rounded-lg transition-colors flex items-center justify-center gap-3 font-semibold text-sm">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </ResolveLayout>
    );
  }

  // PROFILE_INCOMPLETE: redirect to /user-init
  if (state === ProvisioningState.PROFILE_INCOMPLETE) {
    replace('/user-init');
    return null;
  }

  if (showProductKeyGate) {
    return (
      <ProductKeyGate 
        onVerified={() => retryProvisioning()} 
      />
    );
  }

  let title = 'Account Provisioning Issue';
  let message = 'Your account requires further action to access the system.';
  let Icon = AlertCircle;
  let showProductKeyBtn = false;
  let showInviteBtn = false;
  let showRefreshBtn = false;
  let showContactAdminBtn = false;

  switch (state) {
    case ProvisioningState.WORKSPACE_MISSING:
      title = 'Workspace Unavailable';
      message = "Your Resolve PM account was found, but the workspace you're assigned to is no longer available.\n\nPossible reasons:\n• The workspace was deleted.\n• You were removed from the workspace.\n• The workspace is no longer active.";
      Icon = Building;
      showProductKeyBtn = true;
      showInviteBtn = true;
      break;

    case ProvisioningState.WORKSPACE_INACTIVE:
      title = 'Workspace Suspended';
      message = "The workspace associated with your account has been suspended or archived. This usually happens when the workspace license expires or the workspace is disabled by an administrator.";
      Icon = Ban;
      showContactAdminBtn = true;
      showRefreshBtn = true;
      break;

    case ProvisioningState.PROFILE_MISSING:
      title = 'Account Not Provisioned';
      message = "Your account exists, but it hasn't been provisioned inside Resolve PM.";
      Icon = UserMinus;
      showProductKeyBtn = true;
      showInviteBtn = true;
      break;

    case ProvisioningState.PENDING_INVITE:
      title = 'Invitation Pending';
      message = "Your account requires an active invitation to join a workspace. Once you've been invited or your invitation has been approved, please refresh your status.";
      Icon = UserMinus;
      showRefreshBtn = true;
      break;

    case ProvisioningState.LICENSE_REQUIRED:
      title = 'License Required';
      message = "Your workspace license has expired or is invalid. A valid Product Key must be applied to continue using Resolve PM.";
      Icon = KeyRound;
      showProductKeyBtn = true;
      break;
      
    default:
      break;
  }

  return (
    <ResolveLayout eyebrow="Access Restricted">
      <div className="flex flex-col items-center justify-center min-h-[80vh] w-full p-4 font-geist">
        <div className="bg-surface-2 p-8 rounded-xl border border-border/50 max-w-lg w-full shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-[var(--pm-primary)]" />
          
          <div className="w-16 h-16 bg-surface-3 rounded-full flex items-center justify-center mb-6 border border-border/50">
            <Icon className="w-8 h-8 text-[var(--pm-primary)]" />
          </div>
          
          <h2 className="text-2xl font-bold text-[var(--pm-on-surface)] mb-4 tracking-tight">
            {title}
          </h2>
          
          <div className="text-sm text-[var(--pm-on-surface-variant)] mb-8 space-y-4 whitespace-pre-line leading-relaxed">
            {message}
          </div>

          <div className="flex flex-col gap-3 border-t border-border/50 pt-6 mt-2">
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--pm-on-surface-variant)] mb-1">
              Recovery Actions
            </p>
            
            {showContactAdminBtn && (
              <button 
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('notify-toast', { 
                    detail: { message: 'Please contact your workspace administrator for assistance.', type: 'info' } 
                  }));
                }}
                className="w-full text-left px-4 py-3 bg-[var(--pm-primary)]/10 hover:bg-[var(--pm-primary)]/20 text-[var(--pm-primary)] rounded-lg transition-colors border border-[var(--pm-primary)]/20 flex items-center gap-3 font-semibold text-sm"
              >
                <Mail className="w-4 h-4" />
                Contact Administrator
              </button>
            )}

            {showProductKeyBtn && (
              <button 
                onClick={() => replace('/provisioning/product-key')}
                className="w-full text-left px-4 py-3 bg-[var(--pm-primary)]/10 hover:bg-[var(--pm-primary)]/20 text-[var(--pm-primary)] rounded-lg transition-colors border border-[var(--pm-primary)]/20 flex items-center gap-3 font-semibold text-sm"
              >
                <KeyRound className="w-4 h-4" />
                Register a new workspace using a Product Key
              </button>
            )}

            {showInviteBtn && (
              <button 
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('notify-toast', { 
                    detail: { message: 'Ask your administrator to send you an invitation link.', type: 'info' } 
                  }));
                }}
                className="w-full text-left px-4 py-3 bg-surface-3 hover:bg-surface-4 text-[var(--pm-on-surface)] rounded-lg transition-colors border border-border/50 flex items-center gap-3 font-semibold text-sm"
              >
                <Building className="w-4 h-4" />
                Join another workspace using an invitation
              </button>
            )}

            {showRefreshBtn && (
              <button 
                onClick={retryProvisioning}
                className="w-full text-left px-4 py-3 bg-surface-3 hover:bg-surface-4 text-[var(--pm-on-surface)] rounded-lg transition-colors border border-border/50 flex items-center gap-3 font-semibold text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Status
              </button>
            )}

            <button 
              onClick={logout}
              className="w-full text-left px-4 py-3 mt-4 bg-transparent hover:bg-surface-3 text-[var(--pm-on-surface-variant)] rounded-lg transition-colors flex items-center gap-3 font-semibold text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </ResolveLayout>
  );
}
