import React, { useEffect, useState } from 'react';
import { isProductKeyVerified } from '../lib/productKey';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { navigateTo, resolveAuthenticatedDestination } from '../core/auth/postAuthRedirect';
import { LiveCommandCenterSimulation } from './LiveCommandCenterSimulation';
import { 
  CheckCircle2, Box, CalendarClock, MessageSquare, Briefcase, 
  Wallet, FolderSearch, Settings2, ShieldCheck, PlaySquare,
  BarChart2, Users, Receipt
} from 'lucide-react';

export function LandingPage() {
  const verified = isProductKeyVerified() || !!useAuth().user;
  const { user, profile, profileResolved, loading: authLoading } = useAuth();
  const { workspace, loading: workspaceLoading } = useWorkspace();

  const authReady = profileResolved && !authLoading;
  const hasSession = authReady && !!user && !!profile && profile.role !== 'uninvited';

  const [activeSection, setActiveSection] = useState('');

  // Scroll Spy for Nav
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['problem', 'features', 'pricing'];
      const scrollPosition = window.scrollY + 120;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section);
            return;
          }
        }
      }
      if (window.scrollY < 300) {
         setActiveSection('');
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!hasSession) return;
    const destination = resolveAuthenticatedDestination(profile!.role, !!workspace, null);
    if (workspaceLoading && profile!.role !== 'pending-workspace-setup' && !workspace) {
      return;
    }
    navigateTo(destination, true);
  }, [hasSession, profile, workspace, workspaceLoading]);

  return (
    <div className="font-body-md text-body-md overflow-x-hidden min-h-screen bg-[#0a0c10] text-[#e2e2e5]">
      <style>{`
        html { scroll-behavior: smooth; }
        .glass-panel {
            background: rgba(15, 23, 42, 0.4);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
        }
      `}</style>

      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-6 lg:px-12 h-16 bg-[#0a0c10]/80 backdrop-blur-xl border-b border-white/5 shadow-sm">
        <div className="flex items-center gap-8">
          <img src="/logo.png" alt="Resolve PM Logo" className="h-7 w-auto object-contain" />
          <div className="hidden md:flex items-center gap-6">
            <a className={`transition-colors text-sm ${activeSection === 'problem' ? 'text-white font-medium' : 'text-zinc-400 hover:text-white'}`} href="#problem">Why Resolve</a>
            <a className={`transition-colors text-sm ${activeSection === 'features' ? 'text-white font-medium' : 'text-zinc-400 hover:text-white'}`} href="#features">Features</a>
            <a className={`transition-colors text-sm ${activeSection === 'pricing' ? 'text-white font-medium' : 'text-zinc-400 hover:text-white'}`} href="#pricing">Pricing</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a href="/login" className="text-zinc-300 hover:text-white text-sm font-medium transition-colors">Log in</a>
          <a href="mailto:demo@resolvepm.app" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Request Demo</a>
        </div>
      </nav>

      <main className="pt-32 pb-24">
        
        {/* 1. HERO SECTION */}
        <section className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-32">
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 w-fit">
              <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
              <span className="text-xs text-indigo-300 font-medium tracking-wide">Enterprise Operations</span>
            </div>
            <h1 className="text-5xl md:text-6xl text-white leading-tight font-bold tracking-tight">
              Run your company's work from one connected workspace.
            </h1>
            <p className="text-xl text-zinc-400 max-w-xl leading-relaxed">
              Projects, teams, documents, approvals, finance, and daily priorities — organized together.
            </p>
            <div className="flex flex-wrap gap-4 mt-4">
              <a href="mailto:demo@resolvepm.app" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all">
                Request Demo
              </a>
              <a href={verified ? "/login" : "/activate-license"} className="glass-panel text-white hover:bg-white/5 px-6 py-3 rounded-xl font-medium transition-all">
                Explore Demo Workspace
              </a>
            </div>
          </div>
          <div className="lg:col-span-5 hidden lg:block relative">
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-indigo-500/10">
              <LiveCommandCenterSimulation />
            </div>
          </div>
        </section>

        {/* 2. PROBLEM SECTION */}
        <section id="problem" className="py-24 border-y border-white/5 bg-[#0d0f14] scroll-mt-16">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 text-center">
            <h2 className="text-3xl md:text-4xl text-white mb-6 font-bold tracking-tight">Stop scattering your work</h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-16 leading-relaxed">
              Teams usually work across task tools, spreadsheets, chats, files, and finance trackers. Resolve PM connects these workflows into a single source of truth.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-left">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center mb-4">
                  <span className="text-red-400 font-bold">×</span>
                </div>
                <h3 className="text-white font-medium mb-2">Fragmented Context</h3>
                <p className="text-sm text-zinc-400">Searching through chats and emails to find project decisions.</p>
              </div>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-left">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center mb-4">
                  <span className="text-red-400 font-bold">×</span>
                </div>
                <h3 className="text-white font-medium mb-2">Disconnected Finance</h3>
                <p className="text-sm text-zinc-400">Manually matching timesheets and task progress to budget spreadsheets.</p>
              </div>
              <div className="p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-left relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/20 blur-2xl rounded-full"></div>
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-4 relative z-10">
                  <CheckCircle2 className="text-indigo-400 w-5 h-5" />
                </div>
                <h3 className="text-white font-medium mb-2 relative z-10">Connected Operations</h3>
                <p className="text-sm text-indigo-200/70 relative z-10">Everything tied together natively. No manual reconciliation needed.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. DAILY OVERVIEW SECTION */}
        <section id="features" className="py-24 scroll-mt-16">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 glass-panel p-8 rounded-2xl relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                  <h4 className="text-white font-medium">Daily Command Center</h4>
                  <span className="text-xs text-zinc-500 font-mono">LIVE</span>
                </div>
                <div className="p-3 rounded-lg bg-white/5 flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-orange-400 mt-1.5"></div>
                  <div>
                    <div className="text-sm text-white">Blocked Work</div>
                    <div className="text-xs text-zinc-400">2 tasks require your input</div>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5"></div>
                  <div>
                    <div className="text-sm text-white">Today's Priorities</div>
                    <div className="text-xs text-zinc-400">Finish Q3 Roadmap review</div>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5"></div>
                  <div>
                    <div className="text-sm text-white">Workload Changes</div>
                    <div className="text-xs text-zinc-400">Engineering capacity at 85%</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <PlaySquare className="text-blue-400 w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight">Know exactly where things stand</h2>
              <p className="text-lg text-zinc-400 leading-relaxed">
                Start your day with a clear picture. See today's priorities, important updates, blocked work, deadlines, and workload changes instantly.
              </p>
            </div>
          </div>
        </section>

        {/* 4. PROJECT MANAGEMENT SECTION */}
        <section className="py-24 border-y border-white/5 bg-[#0d0f14]">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <Box className="text-purple-400 w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight">Plan work your way</h2>
              <p className="text-lg text-zinc-400 leading-relaxed">
                Flexible tools that adapt to how your team executes, from simple task lists to structured multi-phase deliveries.
              </p>
              <ul className="grid grid-cols-2 gap-y-4 gap-x-8">
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-purple-400" /> Task boards</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-purple-400" /> Work cycles</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-purple-400" /> Timeline planning</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-purple-400" /> Milestones</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-purple-400" /> Dependencies</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-purple-400" /> Progress tracking</li>
              </ul>
            </div>
            <div className="glass-panel p-2 rounded-xl overflow-hidden hidden md:block">
              <div className="bg-[#131620] rounded-lg border border-white/5 p-4 h-72 flex flex-col relative overflow-hidden">
                 <div className="flex gap-4 h-full">
                   {/* Column 1: Planning */}
                   <div className="flex-1 bg-[#0f111a]/80 rounded-lg p-3 border border-white/5">
                     <div className="flex items-center justify-between mb-4">
                       <span className="text-xs font-medium text-zinc-400">Planning <span className="ml-1 text-zinc-600">2</span></span>
                       <span className="w-4 h-1 bg-white/10 rounded-full"></span>
                     </div>
                     <div className="w-full bg-[#1c1f29] rounded-lg border border-white/5 mb-3 p-3 shadow-sm shadow-black/20">
                       <div className="text-xs text-white mb-2 font-medium">Homepage redesign</div>
                       <div className="flex items-center justify-between mt-3">
                         <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">P2</span>
                         <div className="flex -space-x-1">
                           <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border border-[#1c1f29] text-[8px] flex items-center justify-center font-bold text-white">AM</div>
                         </div>
                       </div>
                     </div>
                     <div className="w-full bg-[#1c1f29] rounded-lg border border-white/5 p-3 shadow-sm shadow-black/20">
                       <div className="text-xs text-white mb-2 font-medium">Q3 launch checklist</div>
                       <div className="flex items-center justify-between mt-3">
                         <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">P1</span>
                         <div className="flex -space-x-1">
                           <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 border border-[#1c1f29] text-[8px] flex items-center justify-center font-bold text-white">DT</div>
                         </div>
                       </div>
                     </div>
                   </div>

                   {/* Column 2: In Progress */}
                   <div className="flex-1 bg-[#0f111a]/80 rounded-lg p-3 border border-white/5 relative">
                     <div className="flex items-center justify-between mb-4">
                       <span className="text-xs font-medium text-zinc-400">In Progress <span className="ml-1 text-zinc-600">1</span></span>
                       <span className="w-4 h-1 bg-white/10 rounded-full"></span>
                     </div>
                     <div className="w-full bg-[#1c1f29] rounded-lg border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)] p-3 relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-full h-0.5 bg-purple-500/50"></div>
                       <div className="text-xs text-white mb-2 font-medium">Finance dashboard update</div>
                       <div className="flex items-center gap-2 mb-3">
                         <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-purple-500/70 w-2/3"></div></div>
                         <span className="text-[9px] text-zinc-500">66%</span>
                       </div>
                       <div className="flex items-center justify-between mt-3">
                         <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">P0</span>
                         <div className="flex -space-x-1">
                           <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 border border-[#1c1f29] text-[8px] flex items-center justify-center font-bold text-white">MI</div>
                           <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border border-[#1c1f29] text-[8px] flex items-center justify-center font-bold text-white">AM</div>
                         </div>
                       </div>
                     </div>
                   </div>

                   {/* Column 3: Review */}
                   <div className="flex-1 bg-[#0f111a]/80 rounded-lg p-3 border border-white/5 hidden sm:block">
                     <div className="flex items-center justify-between mb-4">
                       <span className="text-xs font-medium text-zinc-400">Review <span className="ml-1 text-zinc-600">1</span></span>
                       <span className="w-4 h-1 bg-white/10 rounded-full"></span>
                     </div>
                     <div className="w-full bg-[#1c1f29] opacity-70 hover:opacity-100 transition-opacity rounded-lg border border-white/5 p-3 shadow-sm shadow-black/20">
                       <div className="text-xs text-white mb-2 font-medium">Client feedback review</div>
                       <div className="flex items-center justify-between mt-3">
                         <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">P2</span>
                         <div className="flex -space-x-1">
                           <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 border border-[#1c1f29] text-[8px] flex items-center justify-center font-bold text-white">SR</div>
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. SMART INSIGHTS SECTION */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 glass-panel p-8 rounded-2xl relative overflow-hidden border-orange-500/20">
              <div className="absolute top-0 right-0 p-4">
                <span className="text-[10px] font-mono text-orange-400/80 uppercase tracking-widest">Workspace Insights</span>
              </div>
              <div className="mt-6 space-y-6">
                <div>
                  <div className="text-sm text-white mb-1 flex items-center gap-2">Estimate Patterns</div>
                  <div className="text-xs text-zinc-400 leading-relaxed">Design tasks frequently exceed estimates by 15% this quarter.</div>
                </div>
                <div>
                  <div className="text-sm text-white mb-1 flex items-center gap-2">Unusual Activity</div>
                  <div className="text-xs text-zinc-400 leading-relaxed">Volume of late-stage scope changes is higher than average for Project Alpha.</div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                <BarChart2 className="text-orange-400 w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight">Insights based on your workspace activity.</h2>
              <p className="text-lg text-zinc-400 leading-relaxed">
                Objective analytics derived from actual work patterns. Spot bottlenecks and capacity issues before they affect delivery.
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-orange-400" /> Estimate patterns</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-orange-400" /> Increasing blocked work</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-orange-400" /> Workload changes</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-orange-400" /> Unusual activity changes</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 6. TEAM MANAGEMENT SECTION */}
        <section className="py-24 border-y border-white/5 bg-[#0d0f14]">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                <Users className="text-cyan-400 w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight">Understand your team's availability</h2>
              <p className="text-lg text-zinc-400 leading-relaxed">
                Centralize people operations. Know who is available, manage time off, and maintain basic HR records securely.
              </p>
              <ul className="grid grid-cols-2 gap-y-4 gap-x-8">
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-cyan-400" /> Team directory</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-cyan-400" /> Leave tracking</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-cyan-400" /> Attendance overview</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-cyan-400" /> Compensation records</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-cyan-400" /> Workload visibility</li>
              </ul>
            </div>
            <div className="glass-panel p-6 rounded-2xl text-sm border-cyan-500/10">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                <span className="text-white font-medium">Team Roster</span>
                <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded">12 Active</span>
              </div>
              <div className="space-y-5">
                {/* Team Member 1 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs shadow-inner shadow-white/20">AM</div>
                    <div>
                      <div className="text-white font-medium">Aarav Menon</div>
                      <div className="text-xs text-zinc-500">Product Lead</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 text-xs flex items-center justify-end gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Available</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">85% capacity</div>
                  </div>
                </div>

                {/* Team Member 2 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white font-bold text-xs shadow-inner shadow-white/20">MI</div>
                    <div>
                      <div className="text-white font-medium">Maya Iyer</div>
                      <div className="text-xs text-zinc-500">Designer</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-amber-400 text-xs flex items-center justify-end gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>In Meeting</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">100% capacity</div>
                  </div>
                </div>

                {/* Team Member 3 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs shadow-inner shadow-white/20">DT</div>
                    <div>
                      <div className="text-white font-medium">Daniel Thomas</div>
                      <div className="text-xs text-zinc-500">Engineer</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 text-xs flex items-center justify-end gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Available</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">60% capacity</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. FINANCE SECTION */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 glass-panel p-6 rounded-2xl">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-xs text-zinc-500 mb-1">Cash Visibility</div>
                  <div className="text-xl text-white font-mono">$12,450</div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-xs text-zinc-500 mb-1">Profit Overview</div>
                  <div className="text-xl text-emerald-400 font-mono">+$3,200</div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-3">
                  <span>Recent Invoice #1024</span>
                  <span className="text-indigo-400">Sent</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 w-1/2"></div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Receipt className="text-emerald-400 w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight">Business finance without accounting complexity</h2>
              <p className="text-lg text-zinc-400 leading-relaxed">
                Track your business clearly. Generate invoices directly from timesheets and manage expenses without leaving the platform.
              </p>
              <ul className="grid grid-cols-2 gap-y-4 gap-x-8 mb-6">
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Customer invoices</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Payments received</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Expenses</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Cash visibility</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Profit overview</li>
              </ul>
              <p className="text-xs text-zinc-500 italic">
                * Includes strict double-entry accounting records and safe correction entries for finance users.
              </p>
            </div>
          </div>
        </section>

        {/* 8. DOCUMENTS & 9. AUTOMATIONS */}
        <section className="py-24 border-y border-white/5 bg-[#0d0f14]">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 md:grid-cols-2 gap-12">
            
            {/* Documents */}
            <div className="glass-panel p-8 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-6">
                <FolderSearch className="text-blue-400 w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Documents & Collaboration</h3>
              <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                Keep client requirements and internal specs attached to the work itself.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Documents', 'Files', 'Comments', 'Approvals', 'Activity History', 'Search'].map(tag => (
                  <span key={tag} className="px-2.5 py-1 rounded bg-white/5 text-xs text-zinc-300 border border-white/5">{tag}</span>
                ))}
              </div>
            </div>

            {/* Automations */}
            <div className="glass-panel p-8 rounded-2xl border border-white/5 hover:border-yellow-500/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center mb-6">
                <Settings2 className="text-yellow-400 w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Reduce repeated work</h3>
              <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                Connect external tools and set up rules to automate routine administrative tasks.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Automations', 'Connected tools', 'Integration status', 'Recovery handling'].map(tag => (
                  <span key={tag} className="px-2.5 py-1 rounded bg-white/5 text-xs text-zinc-300 border border-white/5">{tag}</span>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* 10. SECURITY & 11. SANDBOX */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            
            {/* Security */}
            <div className="mb-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 mx-auto mb-6">
                <ShieldCheck className="text-indigo-400 w-8 h-8" />
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight mb-4">Everyone sees only what they need</h2>
              <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-12">
                Strict workspace isolation and role permissions mean clients only see their approvals, and employees only see their tasks.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-left">
                <div className="p-5 rounded-xl border border-white/5 bg-white/5">
                  <div className="text-white font-medium mb-1">Owner</div>
                  <div className="text-xs text-zinc-400">Full company control & finance.</div>
                </div>
                <div className="p-5 rounded-xl border border-white/5 bg-white/5">
                  <div className="text-white font-medium mb-1">Manager</div>
                  <div className="text-xs text-zinc-400">Team coordination & projects.</div>
                </div>
                <div className="p-5 rounded-xl border border-white/5 bg-white/5">
                  <div className="text-white font-medium mb-1">Employee</div>
                  <div className="text-xs text-zinc-400">Daily work & time tracking.</div>
                </div>
                <div className="p-5 rounded-xl border border-white/5 bg-white/5">
                  <div className="text-white font-medium mb-1">Client</div>
                  <div className="text-xs text-zinc-400">Shared visibility only.</div>
                </div>
              </div>
            </div>

            {/* Sandbox */}
            <div className="glass-panel p-10 rounded-3xl border border-indigo-500/20 text-center relative overflow-hidden bg-indigo-900/10">
              <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-white mb-4">Try before adding your company</h3>
                <p className="text-zinc-400 max-w-lg mx-auto mb-8">
                  Resolve PM includes a secure Sandbox Experience filled with sample projects, a sample team, sample finance ledgers, and activity history.
                </p>
                <a href={verified ? "/login" : "/activate-license"} className="bg-white text-black px-6 py-3 rounded-lg text-sm font-bold hover:bg-zinc-200 transition-colors">
                  Explore Demo Workspace
                </a>
              </div>
            </div>

          </div>
        </section>

        {/* 12. OWNERSHIP / PRICING SECTION */}
        <section id="pricing" className="py-24 border-y border-white/5 bg-[#0d0f14] scroll-mt-16">
          <div className="max-w-3xl mx-auto px-6 lg:px-12 text-center">
            <h2 className="text-4xl font-bold text-white tracking-tight mb-4">Simple ownership. No per-user surprises.</h2>
            <p className="text-lg text-zinc-400 mb-12">
              Purchase once, set up your workspace, and run your operations without monthly per-user billing.
            </p>

            <div className="glass-panel p-10 rounded-3xl border border-indigo-500/30 text-left relative shadow-[0_0_40px_rgba(99,102,241,0.1)]">
              <div className="absolute top-0 right-0 p-6">
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full">One-Time Asset</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Business License</h3>
              <p className="text-sm text-zinc-400 mb-8 border-b border-white/5 pb-8">
                A complete operational platform for your company.
              </p>

              <ul className="space-y-4 mb-10">
                <li className="flex items-center gap-3"><CheckCircle2 className="text-indigo-400 w-5 h-5" /> <span className="text-zinc-300">One-time purchase model</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="text-indigo-400 w-5 h-5" /> <span className="text-zinc-300">Complete Resolve PM workspace</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="text-indigo-400 w-5 h-5" /> <span className="text-zinc-300">Project and team operations</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="text-indigo-400 w-5 h-5" /> <span className="text-zinc-300">Finance and documents</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="text-indigo-400 w-5 h-5" /> <span className="text-zinc-300">Smart operational insights</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="text-indigo-400 w-5 h-5" /> <span className="text-zinc-300">Setup assistance available</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="text-indigo-400 w-5 h-5" /> <span className="text-zinc-300">Optional yearly support</span></li>
              </ul>

              <a href="mailto:demo@resolvepm.app" className="block text-center w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold transition-all">
                Discuss Pricing
              </a>
              <p className="text-[10px] text-center text-zinc-500 mt-4 uppercase tracking-wider">
                Configuration and deployment options may vary.
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full py-12 px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center border-t border-white/5">
        <div className="flex flex-col items-center md:items-start gap-2 mb-6 md:mb-0">
          <img src="/logo.png" alt="Resolve PM Logo" className="h-5 w-auto object-contain opacity-60 grayscale hover:grayscale-0 transition-all" />
          <p className="text-xs text-zinc-500">© 2026 Resolve PM. Enterprise Operations Platform.</p>
          <div className="flex gap-4 mt-2">
             <a href="/login" className="text-[10px] text-zinc-500 hover:text-white transition-colors uppercase font-medium">Admin Login</a>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          <a href="/privacy" className="text-sm text-zinc-500 hover:text-white transition-colors">Privacy</a>
          <a href="/terms" className="text-sm text-zinc-500 hover:text-white transition-colors">Terms</a>
          <a href="mailto:contact@resolvepm.app" className="text-sm text-zinc-500 hover:text-white transition-colors">Contact</a>
        </div>
      </footer>
    </div>
  );
}
