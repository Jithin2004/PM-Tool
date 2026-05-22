import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, BrainCircuit, Sun, Users, Menu, LogOut, Moon, X, Bell, Check, ChevronDown, ChevronRight, Briefcase, PlayCircle, Database, Shield, FolderOpen, BarChart3, LayoutDashboard, Activity, GitBranch, GitFork, Target, Settings as SettingsIcon, FileText, ChartArea, Search, BookOpen, Zap, Link2 } from 'lucide-react';
import { Profile } from '../../types';
import { calculateHoursFromRange } from '../../utils/timeUtils';

interface NavItem {
  label: string; path: string; icon?: React.ReactNode; roles?: string[];
}
interface NavSection {
  label: string; icon: React.ReactNode; items: NavItem[];
}

const NAV: NavSection[] = [
  { label: 'WORKSPACE', icon: <Briefcase className="w-3 h-3" />, items: [
    { label: 'Projects', path: '/workspace', icon: <FolderOpen className="w-2.5 h-2.5" /> },
    { label: 'Portfolio', path: '/workspace/portfolio', icon: <BarChart3 className="w-2.5 h-2.5" /> },
    { label: 'Knowledge Hub', path: '/workspace/knowledge', icon: <BookOpen className="w-2.5 h-2.5" /> },
    { label: 'Decision Center', path: '/workspace/decisions', icon: <BrainCircuit className="w-2.5 h-2.5" /> },
  ]},
  { label: 'EXECUTION', icon: <PlayCircle className="w-3 h-3" />, items: [
    { label: 'Board', path: '/execution', icon: <LayoutDashboard className="w-2.5 h-2.5" /> },
    { label: 'Timeline', path: '/execution/timeline', icon: <Activity className="w-2.5 h-2.5" /> },
    { label: 'Gantt', path: '/execution/gantt', icon: <GitBranch className="w-2.5 h-2.5" /> },
    { label: 'Sprint Center', path: '/execution/sprints', icon: <GitFork className="w-2.5 h-2.5" /> },
  ]},
  { label: 'RESOURCES', icon: <Database className="w-3 h-3" />, items: [
    { label: 'Teams', path: '/resources/teams', icon: <Users className="w-2.5 h-2.5" /> },
    { label: 'Logistics', path: '/resources', icon: <Target className="w-2.5 h-2.5" /> },
    { label: 'Capacity', path: '/resources/capacity', icon: <BarChart3 className="w-2.5 h-2.5" /> },
    { label: 'Work Logs', path: '/resources/work-logs', icon: <Clock className="w-2.5 h-2.5" /> },
  ]},
  { label: 'CONTROL', icon: <Shield className="w-3 h-3" />, items: [
    { label: 'Admin', path: '/control', icon: <SettingsIcon className="w-2.5 h-2.5" />, roles: ['super_admin'] },
    { label: 'Audit', path: '/control/audit', icon: <FileText className="w-2.5 h-2.5" />, roles: ['super_admin'] },
    { label: 'Analytics', path: '/control/analytics', icon: <ChartArea className="w-2.5 h-2.5" /> },
    { label: 'Automations', path: '/control/automations', icon: <Zap className="w-2.5 h-2.5" />, roles: ['super_admin'] },
    { label: 'Connections', path: '/control/connections', icon: <Link2 className="w-2.5 h-2.5" />, roles: ['super_admin'] },
    { label: 'Settings', path: '/control/settings', icon: <SettingsIcon className="w-2.5 h-2.5" /> },
  ]},
];

function getSectionForPath(path: string): string | null {
  const p = path.replace(/\/+$/, '');
  if (p === '/workspace' || p.startsWith('/workspace/')) return 'WORKSPACE';
  if (p === '/execution' || p.startsWith('/execution/')) return 'EXECUTION';
  if (p === '/resources' || p.startsWith('/resources/')) return 'RESOURCES';
  if (p === '/control' || p.startsWith('/control/')) return 'CONTROL';
  return null;
}

function canAccessItem(item: NavItem, role: string | undefined): boolean {
  if (!item.roles) return true;
  return item.roles.includes(role || '');
}

export function Header({
  user,
  profile,
  userCustomRoles = {},
  onLogout,
  onNavigate,
  onOpenCommandPalette,
  workingTimeFrom,
  workingTimeTo,
  onWorkingTimeChange,
  tilesPerRow,
  setTilesPerRow,
  theme,
  setTheme,
  notifications = [],
  onMarkAsRead
}: {
  user: any,
  profile: Profile | null,
  userCustomRoles?: Record<string, string>,
  onLogout: () => void,
  onNavigate: (path: string) => void,
  onOpenCommandPalette?: () => void,
  workingTimeFrom: string,
  workingTimeTo: string,
  onWorkingTimeChange: (from: string, to: string) => void,
  tilesPerRow: number,
  setTilesPerRow: (t: number) => void,
  theme: 'dark' | 'light',
  setTheme: (t: 'dark' | 'light') => void,
  notifications?: any[],
  onMarkAsRead?: (id: string) => Promise<void>
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pathname, setPathname] = useState(window.location.pathname);
  const [expandedSection, setExpandedSection] = useState<string | null>(() => {
    const isDesktopDevice = window.matchMedia('(hover:hover)').matches;
    const primaryKey = isDesktopDevice ? 'resolve-nav-section' : 'resolve-mobile-nav-section';
    const saved = localStorage.getItem(primaryKey);
    if (saved && NAV.some(s => s.label === saved)) return saved;
    return getSectionForPath(window.location.pathname);
  });
  const role = profile?.role || 'viewer';
  const unreadCount = notifications.filter(n => !n.read_at).length;

  const isDesktop = useMemo(() => window.matchMedia('(hover:hover)').matches, []);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Track route changes
  useEffect(() => {
    const handler = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handler);

    const originalPushState = window.history.pushState;
    window.history.pushState = function pushState(...args) {
      originalPushState.apply(window.history, args);
      handler();
    };

    return () => {
      window.removeEventListener('popstate', handler);
      window.history.pushState = originalPushState;
    };
  }, []);

  // Persist expanded section (desktop)
  useEffect(() => {
    if (!isDesktop) return;
    if (expandedSection) localStorage.setItem('resolve-nav-section', expandedSection);
    else localStorage.removeItem('resolve-nav-section');
  }, [expandedSection, isDesktop]);

  // Persist expanded section (mobile)
  useEffect(() => {
    if (isDesktop) return;
    if (expandedSection) {
      const allowed = NAV.some(s => s.label === expandedSection && s.items.filter(item => canAccessItem(item, role)).length !== 0);
      if (allowed) localStorage.setItem('resolve-mobile-nav-section', expandedSection);
      else localStorage.removeItem('resolve-mobile-nav-section');
    }
  }, [expandedSection, isDesktop, role]);

  // Lock body scroll when mobile drawer open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // Auto-expand on route change
  useEffect(() => {
    const section = getSectionForPath(pathname);
    if (section && section !== expandedSection) setExpandedSection(section);
  }, [pathname]);

  // Mobile: restore last section when drawer opens
  useEffect(() => {
    if (!mobileMenuOpen || isDesktop) return;
    if (!expandedSection) {
      const saved = localStorage.getItem('resolve-mobile-nav-section');
      if (saved) {
        const allowed = NAV.some(s => s.label === saved && s.items.filter(item => canAccessItem(item, role)).length !== 0);
        if (allowed) setExpandedSection(saved);
      }
    }
  }, [mobileMenuOpen]);

  // Mobile: close when tapping outside nav
  useEffect(() => {
    if (isDesktop || !expandedSection) return;
    const handleOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setExpandedSection(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isDesktop, expandedSection]);

  const handleSectionEnter = (label: string) => {
    if (!isDesktop) return;
    clearTimeout(closeTimer.current);
    clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => setExpandedSection(label), 150);
  };

  const handleSectionLeave = () => {
    if (!isDesktop) return;
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setExpandedSection(null), 200);
  };

  const handleParentClick = (label: string) => {
    if (isDesktop) return;
    setExpandedSection(prev => prev === label ? null : label);
  };

  const handleNav = (path: string) => {
    onNavigate(path);
    setMobileMenuOpen(false);
    setExpandedSection(null);
  };

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:text-xs focus:font-mono focus:uppercase focus:tracking-wider">
        Skip to main content
      </a>
      <header className="border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-md z-50" role="banner">
        {/* Logo */}
        <button
          onClick={() => { handleNav('/workspace'); }}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer group"
          title="Go to Project Workspace"
          id="logo-home-btn"
          aria-label="Home: Go to Project Workspace"
        >
          <div className="w-10 h-10 sm:w-14 sm:h-14 border border-white/20 bg-white/5 flex items-center justify-center overflow-hidden group-hover:border-white/40 transition-colors">
            <img src="/logo.png" alt="Resolve PM Logo" className="w-full h-full object-cover scale-110" />
          </div>
          <div>
            <h1 className="font-sans font-semibold text-base sm:text-lg tracking-tight uppercase leading-none">Resolve PM</h1>
            <p className="hidden sm:block text-[9px] font-mono text-white/70 uppercase tracking-[0.15em]">High-Fidelity Engineering System</p>
          </div>
        </button>

        {/* Desktop right side */}
        <div className="hidden lg:flex items-center gap-5">
          {/* Working hours + tiles — xl only */}
          <div className="hidden xl:flex items-center gap-6 border-x border-white/10 px-6">
            <div className="flex flex-col">
              <label className="text-[9px] font-mono text-white/50 uppercase tracking-widest mb-1">Company Working Time</label>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                {profile?.role === 'super_admin' ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="time"
                      value={workingTimeFrom}
                      onChange={(e) => onWorkingTimeChange(e.target.value, workingTimeTo)}
                      className="bg-transparent border-b border-blue-400/50 font-mono text-xs focus:border-blue-400 outline-none text-center py-0.5 text-white"
                    />
                    <span className="text-[10px] font-mono text-white/40">to</span>
                    <input
                      type="time"
                      value={workingTimeTo}
                      onChange={(e) => onWorkingTimeChange(workingTimeFrom, e.target.value)}
                      className="bg-transparent border-b border-blue-400/50 font-mono text-xs focus:border-blue-400 outline-none text-center py-0.5 text-white"
                    />
                  </div>
                ) : (
                  <span className="font-mono text-xs text-white/70">
                    {workingTimeFrom} - {workingTimeTo} ({calculateHoursFromRange(workingTimeFrom, workingTimeTo)}h)
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <label className="text-[9px] font-mono text-white/50 uppercase tracking-widest mb-1">Tiles Per Row</label>
              <div className="flex bg-white/5 p-1 border border-white/10 rounded-sm">
                {[2, 3, 4].map(num => (
                  <button key={num} onClick={() => setTilesPerRow(num)}
                    className={`px-2 py-0.5 text-[10px] font-mono transition-all ${tilesPerRow === num ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Expandable navigation sections — hover desktop / tap mobile */}
          <nav ref={navRef} className="flex items-start gap-1" aria-label="Main navigation" role="navigation">
            {NAV.map(section => (
              <div
                key={section.label}
                className="relative"
                onMouseEnter={() => handleSectionEnter(section.label)}
                onMouseLeave={handleSectionLeave}
              >
                <button
                  onClick={() => handleParentClick(section.label)}
                  aria-expanded={expandedSection === section.label}
                  aria-haspopup="true"
                  aria-controls={`nav-section-${section.label}`}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-mono uppercase tracking-widest transition-all cursor-pointer ${
                    expandedSection === section.label
                      ? 'bg-white/10 text-white border border-white/25 border-b-transparent'
                      : 'text-white/60 border border-white/5 hover:border-white/20'
                  }`}
                >
                  {section.icon}
                  {section.label}
                  {expandedSection === section.label ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                </button>
                {expandedSection === section.label && (
                  <div
                    id={`nav-section-${section.label}`}
                    role="menu"
                    className="absolute top-full left-0 w-44 bg-[#0a0a0a] border border-t-0 border-white/25 shadow-2xl z-50 py-1"
                    onMouseEnter={() => { clearTimeout(closeTimer.current); }}
                    onMouseLeave={handleSectionLeave}
                  >
                    {section.items.filter(item => canAccessItem(item, role)).map(item => (
                      <button
                        key={item.label}
                        role="menuitem"
                        onClick={() => handleNav(item.path)}
                        className={`w-full flex items-center gap-2 text-left px-3 py-2 text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                          pathname === item.path ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Role badge */}
          <div className="flex flex-col items-end">
            <p className="text-xs font-mono text-white/90 uppercase">
              Role: <span className={profile?.role === 'super_admin' ? 'text-red-500' : profile?.role === 'pm' ? 'text-blue-400' : 'text-white/85'}>
                {(profile && userCustomRoles[profile.id]) || profile?.role || 'INITIALIZING...'}
              </span>
            </p>
            <p className="text-[10px] font-mono text-white/60 uppercase tracking-[0.2em]">
              {profile?.role === 'viewer' ? 'READ ONLY' : 'FULL WRITE ACCESS'}
            </p>
          </div>

          <div className="h-8 w-[1px] bg-white/10" />

          {/* Interactive Tour Button */}
          <button
            onClick={() => (window as any).startOnboardingTour?.()}
            className="p-2 border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 transition-all rounded-sm flex items-center justify-center shrink-0 cursor-pointer"
            title="Start Interactive Tour"
          >
            <BrainCircuit className="w-4 h-4 text-blue-400" />
          </button>

          {/* Bell Notification Center */}
          <div className="relative shrink-0">
            <button
              onClick={() => setNotifOpen(prev => !prev)}
              className="p-2 border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 transition-all rounded-sm flex items-center justify-center shrink-0 cursor-pointer relative"
              title="Notification Center"
            >
              <Bell className="w-4 h-4 text-cyan-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[8px] font-mono font-bold flex items-center justify-center text-white animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2.5 w-80 bg-[#090a0f]/95 backdrop-blur-md border border-white/10 rounded-sm shadow-2xl p-4 z-50 max-h-96 overflow-y-auto"
                >
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-white/50">Notifications Center</span>
                    {unreadCount > 0 && (
                      <span className="text-[9px] font-mono text-rose-400 font-bold uppercase">{unreadCount} Unread</span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {notifications.length === 0 ? (
                      <div className="text-center py-6 text-[10px] font-mono text-white/30 uppercase">
                        No notifications registered
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          className={`p-2.5 rounded-sm border text-[11px] flex justify-between items-start gap-2 ${
                            notif.read_at 
                              ? 'bg-white/5 border-white/5 text-white/60' 
                              : 'bg-blue-950/20 border-blue-500/20 text-white'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                notif.category === 'risk' 
                                  ? 'bg-rose-500 animate-pulse' 
                                  : notif.category === 'deadlines'
                                    ? 'bg-amber-500'
                                    : notif.category === 'attendance'
                                      ? 'bg-blue-400'
                                      : 'bg-green-400'
                              }`} />
                              <span className="text-[9px] font-mono uppercase tracking-wider text-white/40">
                                {notif.category}
                              </span>
                            </div>
                            <h4 className="font-semibold leading-snug">{notif.title}</h4>
                            {notif.body && <p className="text-[10px] text-white/70 leading-relaxed">{notif.body}</p>}
                          </div>

                          {!notif.read_at && (
                            <button
                              onClick={() => onMarkAsRead?.(notif.id)}
                              className="p-1 hover:bg-white/10 rounded-sm cursor-pointer shrink-0 border border-white/5 hover:border-white/20"
                              title="Mark as Read"
                            >
                              <Check className="w-3 h-3 text-emerald-400" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 transition-all rounded-sm flex items-center justify-center shrink-0 cursor-pointer"
            title={theme === 'dark' ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
          </button>

          <div className="h-8 w-[1px] bg-white/10" />

          {/* Avatar + logout */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <p className="text-sm font-medium">{user.email?.split('@')[0]}</p>
                <button onClick={onLogout} className="text-[10px] font-mono uppercase text-white/60 hover:text-white transition-colors" id="logout-btn">
                  Terminate Session
                </button>
              </div>
              <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden cursor-pointer hover:border-white/40 transition-colors"
                onClick={() => (window as any).openProfileModal()}>
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> :
                  profile?.full_name ? <span className="text-[10px] font-mono font-bold">{profile.full_name.substring(0, 2).toUpperCase()}</span> :
                    <Users className="w-4 h-4 text-white/85" />}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Right Controls */}
        <div className="flex lg:hidden items-center gap-2">
          {/* Command Palette for Mobile */}
          <button
            onClick={() => onOpenCommandPalette?.()}
            className="p-2 border border-white/10 bg-white/5 hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Search (Ctrl+K)"
          >
            <Search className="w-4 h-4 text-white/70" />
          </button>

          {/* Interactive Tour for Mobile */}
          <button
            onClick={() => (window as any).startOnboardingTour?.()}
            className="p-2 border border-white/10 bg-white/5 hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Start Interactive Tour"
          >
            <BrainCircuit className="w-4 h-4 text-blue-400" />
          </button>

          {/* Theme Toggle for Mobile */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 border border-white/10 bg-white/5 hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title={theme === 'dark' ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
          </button>

          {user && (
            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden cursor-pointer hover:border-white/40 transition-colors"
              onClick={() => (window as any).openProfileModal()}>
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> :
                profile?.full_name ? <span className="text-[9px] font-mono font-bold">{profile.full_name.substring(0, 2).toUpperCase()}</span> :
                  <Users className="w-3.5 h-3.5 text-white/85" />}
            </div>
          )}
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="p-2 border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer + Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop overlay — tap to close drawer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="lg:hidden fixed inset-0 z-30 bg-black/60"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Drawer panel — slide from left, swipe right to close */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              drag={true}
              dragDirectionLock={true}
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={{ left: 0, right: 0.4, top: 0, bottom: 0 }}
              onDragEnd={(_, info) => {
                if (
                  Math.abs(info.offset.x) > Math.abs(info.offset.y) &&
                  (info.offset.x > 80 || (info.velocity.x > 300 && info.offset.x > 0))
                ) {
                  setMobileMenuOpen(false);
                }
              }}
              className="lg:hidden fixed top-[57px] left-0 bottom-0 w-80 max-w-[85vw] bg-[#0a0a0a]/98 backdrop-blur-md border-r border-white/10 z-40 shadow-2xl overflow-y-auto"
            >
              {/* Drawer content wrapper — tap on padding/background collapses section */}
              <div
                className="px-4 py-5 space-y-4 min-h-full"
                onClick={() => setExpandedSection(null)}
              >
                {/* User info */}
                {user && (
                  <div onClick={e => e.stopPropagation()} className="flex items-center justify-between pb-4 border-b border-white/10">
                    <div>
                      <p className="text-sm font-medium">{user.email?.split('@')[0]}</p>
                      <p className="text-[10px] font-mono text-white/50 uppercase mt-0.5">
                        Role: <span className={profile?.role === 'super_admin' ? 'text-red-500' : profile?.role === 'pm' ? 'text-blue-400' : 'text-white/70'}>
                          {(profile && userCustomRoles[profile.id]) || profile?.role || '—'}
                        </span>
                      </p>
                    </div>
                    <span className={`text-[9px] font-mono uppercase px-2 py-0.5 border ${profile?.role === 'viewer' ? 'border-white/10 text-white/50' : 'border-green-500/30 text-green-400'}`}>
                      {profile?.role === 'viewer' ? 'Read Only' : 'Write Access'}
                    </span>
                  </div>
                )}

                {/* Mobile navigation sections — single expanded at a time */}
                <div onClick={e => e.stopPropagation()} className="space-y-2">
                  <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-1">Navigation</p>
                  {NAV.map(section => (
                    <div key={section.label} className="border border-white/5">
                      <button
                        onClick={() => handleParentClick(section.label)}
                        className="w-full flex items-center justify-between text-left text-xs font-mono uppercase tracking-widest px-4 py-3 border-b border-white/5 text-white/70"
                      >
                        <span className="flex items-center gap-2">{section.icon}{section.label}</span>
                        {expandedSection === section.label ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>
                      <AnimatePresence initial={false}>
                        {expandedSection === section.label && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            {section.items.filter(item => canAccessItem(item, role)).map(item => (
                              <button key={item.label} onClick={() => handleNav(item.path)}
                                className={`w-full flex items-center gap-2 text-left text-[11px] font-mono uppercase tracking-wider px-6 py-2.5 border-b border-white/5 transition-all cursor-pointer ${pathname === item.path ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                                {item.icon}
                                {item.label}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>

                {/* Settings */}
                {user && (
                  <div onClick={e => e.stopPropagation()} className="space-y-3 pt-2 border-t border-white/5">
                    <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest">System Parameters</p>
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-mono text-white/70 flex items-center gap-2">
                        <Clock className="w-3 h-3 text-blue-400" /> Company Working Time
                      </span>
                      {profile?.role === 'super_admin' ? (
                        <div className="flex items-center gap-2 bg-black border border-white/10 p-2 rounded-sm w-full">
                          <input
                            type="time"
                            value={workingTimeFrom}
                            onChange={(e) => onWorkingTimeChange(e.target.value, workingTimeTo)}
                            className="flex-1 bg-transparent font-mono text-xs text-white text-center outline-none"
                          />
                          <span className="text-xs font-mono text-white/40">to</span>
                          <input
                            type="time"
                            value={workingTimeTo}
                            onChange={(e) => onWorkingTimeChange(workingTimeFrom, e.target.value)}
                            className="flex-1 bg-transparent font-mono text-xs text-white text-center outline-none"
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-white/70 bg-black/40 border border-white/10 p-2 rounded-sm text-center">
                          {workingTimeFrom} to {workingTimeTo} ({calculateHoursFromRange(workingTimeFrom, workingTimeTo)}h)
                        </span>
                      )}
                    </div>
                    {profile?.role === 'super_admin' && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-white/70">Tiles Per Row</span>
                        <div className="flex bg-white/5 p-1 border border-white/10 rounded-sm">
                          {[2, 3, 4].map(num => (
                            <button key={num} onClick={() => setTilesPerRow(num)}
                              className={`px-3 py-1 text-[10px] font-mono transition-all ${tilesPerRow === num ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Logout */}
                {user && (
                  <div onClick={e => e.stopPropagation()} className="pt-3 border-t border-white/5">
                    <button
                      onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                      className="w-full flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-red-400/80 hover:text-red-400 transition-colors py-2"
                      id="logout-btn-mobile"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Terminate Session
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
