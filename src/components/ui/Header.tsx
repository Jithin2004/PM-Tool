import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, BrainCircuit, Sun, Users, Menu, LogOut, Moon, X, Bell, Check, ChevronDown, ChevronRight, Briefcase, PlayCircle, Database, Shield } from 'lucide-react';
import { Profile } from '../../types';
import { calculateHoursFromRange } from '../../utils/timeUtils';

export function Header({
  user,
  profile,
  userCustomRoles = {},
  onLogout,
  onToggleAdmin,
  showAdmin,
  onToggleLogistics,
  showLogistics,
  onTogglePipeline,
  showPipeline,
  onGoHome,
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
  onToggleAdmin: () => void,
  showAdmin: boolean,
  onToggleLogistics: () => void,
  showLogistics: boolean,
  onTogglePipeline: () => void,
  showPipeline: boolean,
  onGoHome: () => void,
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ Workspace: true, Execution: false, Resources: false, Control: false });
  const canAccessLogistics = profile?.role === 'super_admin' || profile?.role === 'pm';
  const canAccessAdmin = profile?.role === 'super_admin';
  const canAccessControl = profile?.role === 'super_admin' || profile?.role === 'pm';
  const unreadCount = notifications.filter(n => !n.read_at).length;

  const toggleSection = (section: string) => setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  const isActive = (path: string) => window.location.pathname === path;

  return (
    <>
      <header className="border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-md z-50">
        {/* Logo */}
        <button
          onClick={() => { onGoHome(); setMobileMenuOpen(false); }}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer group"
          title="Go to Project Workspace"
          id="logo-home-btn"
        >
          <div className="w-10 h-10 sm:w-14 sm:h-14 border border-white/20 bg-white/5 flex items-center justify-center overflow-hidden group-hover:border-white/40 transition-colors">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover scale-110" />
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

          {/* Expandable navigation sections */}
          <div className="flex items-start gap-1">
            {[
              { label: 'Workspace', icon: Briefcase, items: [
                { label: 'Projects', path: '/workspace', onClick: onGoHome, active: isActive('/workspace') || isActive('/') }
              ]},
              { label: 'Execution', icon: PlayCircle, items: [
                { label: 'Task Board', path: '/execution', onClick: onTogglePipeline, active: isActive('/execution') || showPipeline },
                ...(canAccessLogistics ? [{ label: 'Logistics', path: '/resources', onClick: onToggleLogistics, active: isActive('/resources') || showLogistics }] : [])
              ]},
              { label: 'Resources', icon: Database, items: [
                ...(canAccessLogistics ? [{ label: 'Logistics', path: '/resources', onClick: onToggleLogistics, active: isActive('/resources') || showLogistics }] : []),
                ...(profile?.role === 'viewer' ? [] : [{ label: 'Timesheets', path: '/resources/timesheets', onClick: () => {}, active: false }])
              ]},
              { label: 'Control', icon: Shield, items: [
                ...(canAccessAdmin ? [{ label: 'Admin', path: '/control', onClick: onToggleAdmin, active: isActive('/control') || showAdmin }] : []),
                ...(canAccessControl ? [{ label: 'Reports', path: '/control/reports', onClick: () => {}, active: false }] : [])
              ]}
            ].map(section => (
              <div key={section.label} className="relative">
                <button
                  onClick={() => toggleSection(section.label)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-all cursor-pointer ${
                    expandedSections[section.label] ? 'bg-white/10 border-white/25 text-white' : 'text-white/60 border-white/5 hover:border-white/20'
                  }`}
                >
                  <section.icon className="w-3 h-3" />
                  {section.label}
                  {expandedSections[section.label] ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                </button>
                {expandedSections[section.label] && (
                  <div className="absolute top-full left-0 mt-1 w-44 bg-[#0a0a0a] border border-white/10 shadow-2xl z-50 py-1">
                    {section.items.map(item => (
                      <button
                        key={item.label}
                        onClick={() => { item.onClick(); toggleSection(section.label); }}
                        className={`w-full text-left px-3 py-2 text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                          item.active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

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

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="lg:hidden fixed top-[57px] left-0 right-0 bg-[#0a0a0a]/98 backdrop-blur-md border-b border-white/10 z-40 shadow-2xl overflow-y-auto max-h-[calc(100vh-57px)]"
          >
            <div className="px-4 py-5 space-y-4">
              {/* User info */}
              {user && (
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
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

              {/* Expandable navigation sections for mobile */}
              <div className="space-y-2">
                <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-1">Navigation</p>
                {[
                  { label: 'Workspace', icon: Briefcase, items: [
                    { label: 'Projects', onClick: () => { onGoHome(); setMobileMenuOpen(false); }, active: (!showAdmin && !showLogistics && !showPipeline) }
                  ]},
                  { label: 'Execution', icon: PlayCircle, items: [
                    { label: 'Task Board', onClick: () => { onTogglePipeline(); setMobileMenuOpen(false); }, active: showPipeline },
                    ...(canAccessLogistics ? [{ label: 'Logistics', onClick: () => { onToggleLogistics(); setMobileMenuOpen(false); }, active: showLogistics }] : [])
                  ]},
                  { label: 'Resources', icon: Database, items: [
                    ...(canAccessLogistics ? [{ label: 'Logistics', onClick: () => { onToggleLogistics(); setMobileMenuOpen(false); }, active: showLogistics }] : [])
                  ]},
                  { label: 'Control', icon: Shield, items: [
                    ...(canAccessAdmin ? [{ label: 'Admin', onClick: () => { onToggleAdmin(); setMobileMenuOpen(false); }, active: showAdmin }] : [])
                  ]}
                ].map(section => (
                  <div key={section.label} className="border border-white/5">
                    <button
                      onClick={() => toggleSection(section.label)}
                      className="w-full flex items-center justify-between text-left text-xs font-mono uppercase tracking-widest px-4 py-3 border-b border-white/5 text-white/70"
                    >
                      <span className="flex items-center gap-2"><section.icon className="w-3.5 h-3.5" />{section.label}</span>
                      {expandedSections[section.label] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                    {expandedSections[section.label] && section.items.map(item => (
                      <button key={item.label} onClick={item.onClick}
                        className={`w-full text-left text-[11px] font-mono uppercase tracking-wider px-6 py-2.5 border-b border-white/5 transition-all cursor-pointer ${item.active ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {/* Settings */}
              {user && (
                <div className="space-y-3 pt-2 border-t border-white/5">
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
                <div className="pt-3 border-t border-white/5">
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
        )}
      </AnimatePresence>
    </>
  );
}
