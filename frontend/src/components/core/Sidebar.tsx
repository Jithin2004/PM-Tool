import React from 'react';
import { ChevronLeft, ChevronRight, HelpCircle, Users, LogOut } from 'lucide-react';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { getWorkspaceDisplayName } from '../../lib/workspaceDisplayName';
import { renderRouteIcon } from '../../app/routeRegistry';

/* ================================================================
   RESOLVE PM — Core Sidebar Component
   Source of truth: Design Bible Phase 10-11, 12-13, 17, 18
   
   Rules:
     - Fixed 220px width (collapsible to 60px).
     - Active state: indigo left border (border-l-[3px] var(--color-primary))
       plus subtle indigo background tint.
     - Section groups separated by 4px gap.
     - User identity strip at bottom.
   ================================================================ */

interface SidebarProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  visibleDomains: any[];
  activeDomain: any;
  handleDomainClick: (domainId: string) => void;
  profile: any;
  workspace: any;
  disclosure: any;
  setIsProfileOpen: (open: boolean) => void;
  onLogout: () => void;
  onStartTour?: () => void;
}

export function Sidebar({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  visibleDomains,
  activeDomain,
  handleDomainClick,
  profile,
  workspace,
  disclosure,
  setIsProfileOpen,
  onLogout,
  onStartTour,
}: SidebarProps) {
  return (
    <aside
      id="tour-sidebar"
      className={[
        'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 z-30 select-none',
        'bg-[var(--color-surface-0)] border-r border-[var(--color-border)]',
        'transition-[width] duration-[var(--dur-base)] ease-[var(--ease-standard)]',
        isSidebarCollapsed ? 'w-[var(--layout-sidebar-collapsed)]' : 'w-[var(--layout-sidebar-width)]',
      ].join(' ')}
    >
      {/* Brand Header */}
      <div
        className={[
          'flex items-center h-[var(--layout-header-height)] px-[var(--space-4)] border-b border-[var(--color-border)] shrink-0',
          isSidebarCollapsed ? 'justify-center' : 'justify-between',
        ].join(' ')}
      >
        <div className="flex items-center gap-[var(--space-3)] overflow-hidden">
          <div className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 overflow-hidden bg-[var(--color-surface-2)]">
            <img src="/logo.png" alt="Resolve PM" className="w-full h-full object-contain" />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-[13px] text-[var(--color-primary)] truncate">
                Resolve PM {workspace?.settings?.companyName ? `| ${getWorkspaceDisplayName(workspace.settings.companyName, false)}` : ''}
              </h1>
              <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)] truncate">
                Enterprise Workspace
              </p>
            </div>
          )}
        </div>
        {!isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(true)}
            className="p-[var(--space-1)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {isSidebarCollapsed && (
        <button
          onClick={() => setIsSidebarCollapsed(false)}
          className="mx-auto mt-[var(--space-2)] p-[var(--space-1)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none"
          aria-label="Expand sidebar"
        >
          <ChevronRight size={14} strokeWidth={1.5} />
        </button>
      )}

      {/* Navigation Domains */}
      <div className="flex-1 overflow-y-auto px-[var(--space-3)] py-[var(--space-4)] space-y-[var(--space-1)]">
        {visibleDomains.map((domain) => {
          const isActive = activeDomain?.id === domain.id;

          return (
            <button
              key={domain.id}
              title={isSidebarCollapsed ? domain.label : undefined}
              onClick={() => handleDomainClick(domain.id)}
              className={[
                'flex items-center rounded-[var(--radius-md)] text-[13px] font-medium transition-all duration-[var(--dur-fast)] w-full focus:outline-none border-l-2',
                isSidebarCollapsed
                  ? 'justify-center px-0 h-10 w-10 mx-auto border-transparent'
                  : 'gap-2 px-3 py-2.5',
                isActive
                  ? 'bg-[var(--color-primary-subtle)] text-[var(--color-text-primary)] border-[var(--color-primary)] pl-2.5'
                  : 'bg-transparent text-[var(--color-text-secondary)] border-transparent hover:bg-white/[0.02] hover:text-[var(--color-text-primary)] pl-2.5',
              ].join(' ')}
            >
              <div className="flex-shrink-0 text-current">
                {renderRouteIcon(domain.iconName, 'w-4 h-4 shrink-0')}
              </div>
              {!isSidebarCollapsed && (
                <div className="flex flex-col text-left truncate">
                  <span className="truncate">{domain.label}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Help & Utility Section */}
      <div className="shrink-0 border-t border-[var(--color-border)]">
        {onStartTour && (
          <button
            onClick={onStartTour}
            className={[
              'flex items-center text-[var(--text-xs)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors w-full focus:outline-none',
              isSidebarCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-[var(--space-2)] px-[var(--space-5)] py-[var(--space-2)]',
            ].join(' ')}
            title={isSidebarCollapsed ? 'Help & Onboarding' : undefined}
          >
            <HelpCircle size={14} strokeWidth={1.5} />
            {!isSidebarCollapsed && <span>Help & Onboarding</span>}
          </button>
        )}

        {/* User Identity and Logout */}
        <div
          className={[
            'flex items-center border-t border-[var(--color-border)] py-[var(--space-3)]',
            isSidebarCollapsed ? 'justify-center flex-col gap-[var(--space-2)] px-[var(--space-2)]' : 'justify-between px-[var(--space-4)]',
          ].join(' ')}
        >
          <div
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-[var(--space-2)] cursor-pointer truncate"
            title="View Profile"
          >
            <Avatar src={profile?.avatar_url} name={profile?.full_name || profile?.email} size="sm" />
            {!isSidebarCollapsed && (
              <div className="flex flex-col text-left truncate min-w-0">
                <span className="text-[var(--text-base)] font-medium text-[var(--color-text-primary)] truncate">
                  {profile?.full_name || 'User Profile'}
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)] truncate capitalize">
                  {profile?.role || 'Member'}
                </span>
              </div>
            )}
          </div>
          
          {!isSidebarCollapsed && (
            <button
              onClick={onLogout}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors focus:outline-none"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
