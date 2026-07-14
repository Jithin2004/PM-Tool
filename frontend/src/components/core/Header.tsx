import React from 'react';
import { Menu, Search, Shield, ChevronDown, Sun, Moon, Sunset, HelpCircle, Plus } from 'lucide-react';
import { ActionInbox } from '../inbox/ActionInbox';
import { hasCapability } from '../../core/auth/permissions';
import { UserRole } from '../../types';

/* ================================================================
   RESOLVE PM — Core Header Component
   Source of truth: Design Bible Phase 12-13, 17, 18
   
   Rules:
     - Fixed height: 48px (layout header-height).
     - Border bottom (color-border).
     - Subnav pill active: primary color, no shadow/glow.
     - No glassmorphism.
   ================================================================ */

interface HeaderProps {
  activeDomain: any;
  activeSubsection: any;
  setMobileSidebarOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  isSandboxMode: boolean;
  isSandboxTransitioning: boolean;
  onToggleSandbox: () => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  setIsEndOfDayModalOpen: (open: boolean) => void;
  setSupportModalOpen: (open: boolean) => void;
  setIsAdding: (open: boolean) => void;
  profile: any;
  trueProfile: any;
  simulatedRole: UserRole | null;
  setSimulatedRole: (role: UserRole | null) => void;
  isSimulating: boolean;
  onNavigate: (path: string) => void;
}

export function Header({
  activeDomain,
  activeSubsection,
  setMobileSidebarOpen,
  setCommandPaletteOpen,
  isSandboxMode,
  isSandboxTransitioning,
  onToggleSandbox,
  theme,
  setTheme,
  setIsEndOfDayModalOpen,
  setSupportModalOpen,
  setIsAdding,
  profile,
  trueProfile,
  simulatedRole,
  setSimulatedRole,
  isSimulating,
  onNavigate,
}: HeaderProps) {
  return (
    <header
      id="tour-topbar"
      className={[
        'h-[var(--layout-header-height)] flex items-center justify-between px-[var(--space-5)]',
        'bg-[var(--color-surface-1)] border-b border-[var(--color-border)]',
        'sticky top-0 z-40 select-none w-full shrink-0',
      ].join(' ')}
    >
      {/* Mobile Menu Toggle & Logo */}
      <div className="flex items-center gap-[var(--space-3)] lg:hidden">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="p-1.5 border border-[var(--color-border)] bg-[var(--color-surface-2)] rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] focus:outline-none"
          aria-label="Toggle mobile menu"
        >
          <Menu size={16} strokeWidth={1.5} />
        </button>
        <div className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0">
          <img src="/logo.png" alt="Resolve PM" className="w-full h-full object-contain" />
        </div>
      </div>

      {/* Subnav Tabs (Center) */}
      <div
        className="flex items-center gap-[var(--space-1)] mx-auto flex-1 justify-start sm:justify-center px-[var(--space-4)] overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {activeDomain?.subsections.map((sub: any) => {
          const isSubActive = activeSubsection === sub;
          return (
            <button
              key={sub.path}
              onClick={() => onNavigate(sub.path)}
              className={[
                'px-[14px] py-1 rounded-[var(--radius-pill)] text-[12px] font-medium transition-colors focus:outline-none whitespace-nowrap',
                isSubActive
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
            >
              {sub.label}
            </button>
          );
        })}
      </div>

      {/* Utilities (Right) */}
      <div className="flex items-center gap-[var(--space-2)] ml-auto">
        {/* Search Input Bar */}
        <div
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden md:flex items-center gap-[var(--space-2)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] h-8 px-[var(--space-3)] rounded-[var(--radius-md)] text-[var(--color-text-secondary)] cursor-pointer transition-colors shadow-[var(--shadow-sm)]"
        >
          <Search size={14} strokeWidth={1.5} className="text-[var(--color-text-muted)]" />
          <span className="text-[var(--text-xs)] select-none flex-1 text-left">Search...</span>
          <span className="ml-[var(--space-2)] bg-[var(--color-surface-0)] border border-[var(--color-border)] px-1.5 py-0.5 rounded-[var(--radius-xs)] text-[9px] font-mono text-[var(--color-text-muted)]">
            Ctrl + K
          </span>
        </div>

        {/* View As Role Simulator */}
        {hasCapability(trueProfile?.role, 'user.manage') && (
          <div className="relative flex items-center">
            <select
              value={simulatedRole || ''}
              onChange={(e) => setSimulatedRole(e.target.value ? (e.target.value as UserRole) : null)}
              className={[
                'h-8 pl-3 pr-8 rounded-[var(--radius-md)] text-[var(--text-xs)] font-medium border appearance-none cursor-pointer transition-colors focus:outline-none',
                isSimulating
                  ? 'bg-[var(--color-warning-subtle)] border-[var(--color-warning)] text-[var(--color-warning)]'
                  : 'bg-[var(--color-surface-1)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]',
              ].join(' ')}
            >
              <option value="">View As: Super Admin</option>
              <option value="pm">Simulate: PM</option>
              <option value="developer">Simulate: Developer</option>
              <option value="external_client">Simulate: Client</option>
            </select>
            <div
              className={[
                'absolute right-2 pointer-events-none',
                isSimulating ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-muted)]',
              ].join(' ')}
            >
              <ChevronDown size={12} strokeWidth={1.5} />
            </div>
          </div>
        )}

        {/* Sandbox Training Mode */}
        {hasCapability(profile?.role, 'sandbox.manage') && (
          <button
            onClick={onToggleSandbox}
            disabled={isSandboxTransitioning}
            className={[
              'p-1.5 border rounded-[var(--radius-md)] transition-colors shrink-0 cursor-pointer shadow-[var(--shadow-sm)] flex items-center gap-[var(--space-1)] px-[var(--space-2)] focus:outline-none',
              isSandboxMode
                ? 'bg-[var(--color-info-subtle)] border-[var(--color-info)] text-[var(--color-info)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              isSandboxTransitioning ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
            title="Toggle Sandbox Training Mode"
          >
            <Shield size={14} strokeWidth={1.5} className={isSandboxTransitioning ? 'animate-spin' : ''} />
            <span className="text-[10px] font-bold uppercase hidden sm:inline">Sandbox</span>
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-1.5 border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors shrink-0 cursor-pointer shadow-[var(--shadow-sm)] focus:outline-none"
          title={theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
        >
          {theme === 'dark' ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
        </button>

        {/* Finish My Day */}
        <button
          onClick={() => setIsEndOfDayModalOpen(true)}
          className="p-1.5 border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] rounded-[var(--radius-md)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors shrink-0 cursor-pointer shadow-[var(--shadow-sm)] focus:outline-none"
          title="Finish My Day"
        >
          <Sunset size={16} strokeWidth={1.5} />
        </button>

        {/* Support Escalation */}
        <button
          onClick={() => setSupportModalOpen(true)}
          className="p-1.5 border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] rounded-[var(--radius-md)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors shrink-0 cursor-pointer shadow-[var(--shadow-sm)] focus:outline-none"
          title="Support Escalation"
        >
          <HelpCircle size={16} strokeWidth={1.5} />
        </button>

        <ActionInbox />

        {/* New Project Button */}
        {profile && hasCapability(profile.role, 'project.update') && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-[var(--space-1)] text-[var(--text-xs)] font-medium h-7 px-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] text-[var(--color-text-on-primary)] transition-colors cursor-pointer shrink-0 focus:outline-none"
          >
            <Plus size={12} strokeWidth={1.5} />
            <span className="hidden sm:inline">New Project</span>
          </button>
        )}
      </div>
    </header>
  );
}
