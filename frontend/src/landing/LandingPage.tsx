import React, { useEffect, useState } from 'react';
import { isProductKeyVerified } from '../lib/productKey';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { navigateTo, resolveAuthenticatedDestination } from '../core/auth/postAuthRedirect';
import { LiveCommandCenterSimulation } from './LiveCommandCenterSimulation';

export function LandingPage() {
  const verified = isProductKeyVerified() || !!useAuth().user;
  const { user, profile, profileResolved, loading: authLoading } = useAuth();
  const { workspace, loading: workspaceLoading } = useWorkspace();

  const authReady = profileResolved && !authLoading;
  const hasSession = authReady && !!user && !!profile && profile.role !== 'uninvited';


  const [activeSection, setActiveSection] = useState('');
  const [activePricingTab, setActivePricingTab] = useState('project');
  const [priceRevealed, setPriceRevealed] = useState(false);

  // Scroll Spy for Nav
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['showcase', 'why-resolve', 'pricing', 'justification'];
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
    <div className="font-body-md text-body-md overflow-x-hidden min-h-screen text-[#e2e2e5]">
      <style>{`
        html { scroll-behavior: smooth; }
        .glass-panel {
            background: rgba(15, 23, 42, 0.55);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            vertical-align: middle;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(0.98); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
      `}</style>

      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-container-padding h-16 bg-[#050712]/70 backdrop-blur-md border-b border-[var(--border-soft)] shadow-sm">
        <div className="flex items-center gap-stack-gap-lg">
          <img src="/logo.png" alt="Resolve PM Logo" className="h-8 w-auto object-contain" />
          <div className="hidden md:flex items-center gap-stack-gap-md ml-8">
            <a className={`transition-colors font-body-md text-body-md ${activeSection === 'showcase' ? 'text-primary font-bold border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary'}`} href="#showcase">Showcase</a>
            <a className={`transition-colors font-body-md text-body-md ${activeSection === 'why-resolve' ? 'text-primary font-bold border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary'}`} href="#why-resolve">Why Resolve</a>
            <a className={`transition-colors font-body-md text-body-md ${activeSection === 'pricing' ? 'text-primary font-bold border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary'}`} href="#pricing">Pricing</a>
          </div>
        </div>
        <div className="flex items-center gap-stack-gap-md">
          <a href="/login" className="btn-premium-primary px-5 py-2.5 rounded font-body-md text-body-md font-semibold">Login</a>
        </div>
      </nav>

      <main className="pt-32 pb-24">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-container-padding grid grid-cols-1 lg:grid-cols-12 gap-grid-gutter items-center mb-32">
          <div className="lg:col-span-7 flex flex-col gap-stack-gap-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 w-fit">
              <span className="material-symbols-outlined text-[14px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>corporate_fare</span>
              <span className="font-mono-label text-mono-label text-primary uppercase tracking-widest">Enterprise Agency OS</span>
            </div>
            <h1 className="font-display-lg text-5xl md:text-6xl text-on-surface leading-tight font-bold tracking-tight bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent pb-2">
              Your Agency's Operating System.<br/>Not Another Subscription Tool.
            </h1>
            <p className="font-body-lg text-xl text-on-surface-variant max-w-xl leading-relaxed">
              Resolve PM unifies projects, people, clients, finance, and decisions into one privately controlled workspace.
            </p>
            <div className="flex flex-wrap gap-stack-gap-md mt-6">
              <a href={verified ? "/login" : "/activate-license"} className="btn-premium-primary px-8 py-4 rounded font-headline-sm text-headline-sm font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300">Start Workspace</a>
              <a href="#pricing" className="glass-panel px-8 py-4 rounded font-headline-sm text-headline-sm hover:bg-white/5 transition-all duration-300">View License Options</a>
            </div>
            <div className="mt-4">
              <a className="text-body-sm text-on-surface-variant hover:text-primary transition-colors underline decoration-dotted" href="/login">Already a member? Login</a>
            </div>
          </div>
          <div className="lg:col-span-5 hidden lg:block relative">
            <LiveCommandCenterSimulation />
          </div>
        </section>

        {/* Section 1: Interactive Product Showcase */}
        <section id="showcase" className="bg-surface-container-lowest py-32 border-y border-[var(--pm-border)] dark:border-[var(--border-soft)] scroll-mt-16">
          <div className="max-w-7xl mx-auto px-container-padding">
            <div className="mb-20 text-center">
              <h2 className="font-display-lg text-4xl md:text-5xl text-on-surface mb-6 tracking-tight font-bold">Premium Agency Operations</h2>
              <p className="font-body-lg text-lg text-on-surface-variant max-w-3xl mx-auto leading-relaxed">
                Stop duct-taping SaaS tools together. Resolve PM provides enterprise-grade infrastructure out of the box.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Delivery Intelligence */}
              <div className="glass-panel p-8 rounded-2xl hover:border-primary/40 transition-all duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-primary">monitoring</span>
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-2">Delivery Intelligence</h3>
                <p className="text-on-surface-variant mb-6 text-sm">Deterministic forecasting prevents timeline slips.</p>
                <div className="bg-surface-container-low p-4 rounded-lg border border-[var(--border-soft)]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-on-surface-variant">Q4 Project Alpha</span>
                    <span className="text-xs font-mono text-green-400 bg-green-400/10 px-2 py-1 rounded">Confidence: 91%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[var(--pm-surface)]/5 rounded-full overflow-hidden flex">
                    <div className="h-full bg-green-400 w-[91%] rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Profit Intelligence */}
              <div className="glass-panel p-8 rounded-2xl hover:border-green-400/40 transition-all duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-green-400/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-green-400">payments</span>
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-2">Profit Intelligence</h3>
                <p className="text-on-surface-variant mb-6 text-sm">Track real-time burn against project budgets.</p>
                <div className="bg-surface-container-low p-4 rounded-lg border border-[var(--border-soft)]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-on-surface-variant">Margin Protection</span>
                    <span className="text-xs font-mono text-green-400">Leakage Prevented</span>
                  </div>
                  <div className="flex items-end gap-1 h-8">
                    <div className="w-full bg-green-400/20 h-[40%] rounded-t-sm"></div>
                    <div className="w-full bg-green-400/40 h-[60%] rounded-t-sm"></div>
                    <div className="w-full bg-green-400/60 h-[80%] rounded-t-sm"></div>
                    <div className="w-full bg-green-400 h-[100%] rounded-t-sm"></div>
                  </div>
                </div>
              </div>

              {/* Resource Engine */}
              <div className="glass-panel p-8 rounded-2xl hover:border-purple-400/40 transition-all duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-purple-400/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-purple-400">group_work</span>
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-2">Resource Engine</h3>
                <p className="text-on-surface-variant mb-6 text-sm">Balance workloads without spreadsheet chaos.</p>
                <div className="bg-surface-container-low p-4 rounded-lg border border-[var(--border-soft)] flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-400/20 flex items-center justify-center border border-purple-400/50">
                    <span className="text-xs text-purple-400 font-bold">JD</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1 font-mono text-on-surface-variant">
                      <span>Dev Team</span>
                      <span className="text-purple-400">Capacity Balanced</span>
                    </div>
                    <div className="h-1 w-full bg-[var(--pm-surface)]/5 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-400 w-[85%] rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Governance */}
              <div className="glass-panel p-8 rounded-2xl hover:border-blue-400/40 transition-all duration-300 group lg:col-span-1 md:col-span-2">
                <div className="w-12 h-12 rounded-xl bg-blue-400/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-blue-400">handshake</span>
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-2">Client Governance</h3>
                <p className="text-on-surface-variant mb-6 text-sm">Formalized sign-offs and change requests protect scope.</p>
                <div className="bg-surface-container-low p-4 rounded-lg border border-[var(--border-soft)]">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-blue-400 text-sm">verified</span>
                    <span className="text-xs font-mono text-on-surface">Client Approval Captured</span>
                    <span className="text-[10px] font-mono text-on-surface-variant ml-auto">14:02 UTC</span>
                  </div>
                </div>
              </div>

              {/* Security */}
              <div className="glass-panel p-8 rounded-2xl hover:border-orange-400/40 transition-all duration-300 group lg:col-span-2 md:col-span-2">
                <div className="w-12 h-12 rounded-xl bg-orange-400/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-orange-400">admin_panel_settings</span>
                </div>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-on-surface mb-2">Military-Grade Security</h3>
                    <p className="text-on-surface-variant text-sm">Row-Level Security (RLS) policies ensure data isolation. No multi-tenant cross-contamination.</p>
                  </div>
                  <div className="bg-surface-container-low p-4 rounded-lg border border-[var(--border-soft)] flex-1 flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-orange-400/5 blur-2xl"></div>
                    <span className="text-xs font-mono text-orange-400 mb-2">POLICY_ENFORCED</span>
                    <code className="text-[10px] font-mono text-on-surface-variant">
                      CREATE POLICY "isolation" ON items<br/>
                      USING (workspace_id = auth.jwt() {'->>'} 'ws');
                    </code>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Section 2: Why Resolve */}
        <section id="why-resolve" className="py-32 scroll-mt-16 bg-[#0a0c10]">
          <div className="max-w-7xl mx-auto px-container-padding">
            <div className="mb-24 text-center md:text-left">
              <h2 className="font-display-lg text-4xl md:text-5xl text-on-surface mb-6 tracking-tight font-bold">Consolidate the Chaos</h2>
              <p className="font-body-lg text-lg text-on-surface-variant max-w-3xl leading-relaxed mx-auto md:mx-0">
                Stop paying for disconnected tools and manually reconciling data.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-on-surface">Instead of managing:</h3>
                <ul className="space-y-4">
                  {[
                    { title: 'Project tools', desc: 'Jira, Asana, Monday' },
                    { title: 'Timesheets', desc: 'Harvest, Toggl, Clockify' },
                    { title: 'Client approvals', desc: 'Email threads, Slack, PDF sign-offs' },
                    { title: 'Finance spreadsheets', desc: 'Manual budget vs actuals' },
                    { title: 'Resource planning', desc: 'Float, ResourceGuru' }
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-4 p-4 rounded-xl border border-error/10 bg-error/5">
                      <span className="material-symbols-outlined text-error opacity-70">close</span>
                      <div>
                        <span className="block text-on-surface font-semibold">{item.title}</span>
                        <span className="text-xs text-on-surface-variant">{item.desc}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="glass-panel p-10 rounded-2xl border-2 border-primary/30 relative overflow-hidden h-full flex flex-col justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent"></div>
                <div className="relative z-10 text-center space-y-6">
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/40 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                    <span className="material-symbols-outlined text-primary text-4xl">dashboard_customize</span>
                  </div>
                  <h3 className="text-3xl font-bold text-white">Resolve Combines Everything</h3>
                  <p className="text-on-surface-variant text-lg">
                    One unified database. Real-time correlation between your developers' time, your clients' approvals, and your agency's profit margins.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Value Inspector & License Pricing */}
        <section id="pricing" className="py-32 scroll-mt-16 bg-[#070913] border-y border-[var(--border-soft)]">
          <div className="max-w-7xl mx-auto px-container-padding">
            {/* Header */}
            <div className="text-center mb-24">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <span className="font-mono-label text-mono-label text-primary uppercase tracking-widest">Unified Operations Stack</span>
              </div>
              <h2 className="font-display-lg text-4xl md:text-5xl text-on-surface mb-6 tracking-tight font-bold">Replace Your Fragmented SaaS Subscriptions</h2>
              <p className="font-body-lg text-lg text-on-surface-variant max-w-3xl mx-auto leading-relaxed">
                Resolve PM consolidates your entire agency operation into a single privately deployed database. 
                Stop paying per-seat subscriptions for fragmented tools.
              </p>
            </div>

            {/* 10 Operational Verticals Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-28">
              {[
                { title: 'Project Execution', icon: 'splitscreen', desc: 'Sprints, Kanban, Backlogs' },
                { title: 'Task Management', icon: 'format_list_bulleted', desc: 'Subtasks, checklists & files' },
                { title: 'Employee Operations', icon: 'badge', desc: 'Roles, profiles & departments' },
                { title: 'Resource Planning', icon: 'date_range', desc: 'Holiday calendars & capacity' },
                { title: 'Client Management', icon: 'group', desc: 'Portals & visibility scopes' },
                { title: 'Finance Control', icon: 'account_balance_wallet', desc: 'Budget tracking & burn-rates' },
                { title: 'Invoices', icon: 'receipt_long', desc: 'Direct timesheet billing conversion' },
                { title: 'Reports', icon: 'analytics', desc: 'Command logs & performance metrics' },
                { title: 'Automation', icon: 'rule', desc: 'Approval pipelines & triggers' },
                { title: 'Executive Intelligence', icon: 'psychology', desc: 'Diagnostic risk analysis' }
              ].map((item, i) => (
                <div key={i} className="glass-panel p-5 rounded-xl border border-white/5 bg-[#0a0d1d]/40 flex flex-col gap-2">
                  <span className="material-symbols-outlined text-primary text-2xl">{item.icon}</span>
                  <h4 className="text-sm font-bold text-on-surface">{item.title}</h4>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Module Inspector ("What's Included") */}
            <div className="mb-28">
              <div className="text-center mb-12">
                <h3 className="text-2xl font-bold text-on-surface mb-4">Inspection: What's Included</h3>
                <p className="text-sm text-on-surface-variant max-w-xl mx-auto">
                  Click a module to inspect the exact database features and terminal diagnostic metrics.
                </p>
              </div>

              {/* Tab headers */}
              <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-4xl mx-auto">
                {[
                  { id: 'project', label: 'Project Command', icon: 'rocket_launch' },
                  { id: 'people', label: 'People Operations', icon: 'groups' },
                  { id: 'financial', label: 'Financial Control', icon: 'payments' },
                  { id: 'client', label: 'Client Delivery', icon: 'handshake' },
                  { id: 'admin', label: 'Enterprise Administration', icon: 'admin_panel_settings' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActivePricingTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-lg text-xs font-semibold font-mono-pm border uppercase tracking-wider transition-all ${activePricingTab === tab.id ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'border-white/5 bg-[#050712]/50 text-on-surface-variant hover:text-on-surface hover:bg-white/5'}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab contents */}
              <div className="glass-panel p-8 rounded-2xl border border-white/5 bg-[#050712]/50 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                {activePricingTab === 'project' && (
                  <>
                    <div className="md:col-span-7 space-y-4">
                      <h4 className="text-lg font-bold text-on-surface">Project Command Module</h4>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Complete workspace organization with agile backlog parsing and live sprint engines. 
                        Configured entirely on the client side with local state variables.
                      </p>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-on-surface-variant">
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Sprint Planning Boards</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Kanban Lane Configurations</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Backlog Hierarchy & Sorting</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Timeline Tracking Views</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Custom Project Workflows</li>
                      </ul>
                    </div>
                    <div className="md:col-span-5 bg-[#02040a] p-5 rounded-xl border border-white/5 font-mono-pm text-[10px] leading-relaxed text-on-surface-variant h-full flex flex-col justify-center">
                      <div className="text-primary/70 uppercase tracking-widest text-[9px] font-bold mb-2">PROJECT_METRICS_DUMP</div>
                      <div className="text-green-400 font-bold mb-1">▶ EXECUTION_MODE: KANBAN</div>
                      <div>▶ SPRINTS: ACTIVE (Sprint 04)</div>
                      <div>▶ BACKLOG ITEMS: 45</div>
                      <div>▶ TARGET LANE COUNT: 5</div>
                      <div className="text-indigo-400 mt-2">▶ CRITICAL_PATH: VERIFIED & NORMAL</div>
                    </div>
                  </>
                )}

                {activePricingTab === 'people' && (
                  <>
                    <div className="md:col-span-7 space-y-4">
                      <h4 className="text-lg font-bold text-on-surface">People Operations Module</h4>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Track resource capacity, balance team workloads, and manage holidays. Ensure optimal team deployment and avoid burnout.
                      </p>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-on-surface-variant">
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Resource Capacity Planning</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Timesheet Log Ingest</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Team Capacity Balance</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Holiday Calendars & Time Off</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> User Role/Capability Overrides</li>
                      </ul>
                    </div>
                    <div className="md:col-span-5 bg-[#02040a] p-5 rounded-xl border border-white/5 font-mono-pm text-[10px] leading-relaxed text-on-surface-variant h-full flex flex-col justify-center">
                      <div className="text-primary/70 uppercase tracking-widest text-[9px] font-bold mb-2">RESOURCE_CAPACITY_DUMP</div>
                      <div className="text-green-400 font-bold mb-1">▶ ACTIVE_MEMBERS: 12</div>
                      <div>▶ TEAM_ROSTER: DESIGN, DEV, HR</div>
                      <div>▶ AVG_UTILIZATION: 82%</div>
                      <div>▶ ACTIVE_TIMESHEETS: CAPTURED</div>
                      <div className="text-indigo-400 mt-2">▶ SYSTEM_LOAD: STABLE & BALANCED</div>
                    </div>
                  </>
                )}

                {activePricingTab === 'financial' && (
                  <>
                    <div className="md:col-span-7 space-y-4">
                      <h4 className="text-lg font-bold text-on-surface">Financial Control Module</h4>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Direct financial correlation from timesheet logging to milestone invoicing. Secure your profit margins with real-time budget forecasting.
                      </p>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-on-surface-variant">
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Budget Margin Tracking</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Invoices Generation</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Milestone Approval Status</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Expense Reporting</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Manual Exchange Model</li>
                      </ul>
                    </div>
                    <div className="md:col-span-5 bg-[#02040a] p-5 rounded-xl border border-white/5 font-mono-pm text-[10px] leading-relaxed text-on-surface-variant h-full flex flex-col justify-center">
                      <div className="text-primary/70 uppercase tracking-widest text-[9px] font-bold mb-2">FINANCIAL_LEDGER_DUMP</div>
                      <div className="text-green-400 font-bold mb-1">▶ BUDGET_BURN_RATE: NOMINAL</div>
                      <div>▶ TOTAL_CONTRACT_VALUE: $25,000</div>
                      <div>▶ PENDING_APPROVALS: ₹1,80,000</div>
                      <div>▶ EXCHANGE_CALCULATION: MANUAL</div>
                      <div className="text-indigo-400 mt-2">▶ CASHFLOW_ESTIMATION: POSITIVE</div>
                    </div>
                  </>
                )}

                {activePricingTab === 'client' && (
                  <>
                    <div className="md:col-span-7 space-y-4">
                      <h4 className="text-lg font-bold text-on-surface">Client Delivery Module</h4>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Formalized client sign-off engines and change request approval steps. Maintain visibility control scopes and isolate internal communications.
                      </p>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-on-surface-variant">
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Client Portal Interface</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Formalized Sign-off Process</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Change Request Flows</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Workspace Visibility Control</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Client Accounts & Roles</li>
                      </ul>
                    </div>
                    <div className="md:col-span-5 bg-[#02040a] p-5 rounded-xl border border-white/5 font-mono-pm text-[10px] leading-relaxed text-on-surface-variant h-full flex flex-col justify-center">
                      <div className="text-primary/70 uppercase tracking-widest text-[9px] font-bold mb-2">CLIENT_DELIVERY_STATE</div>
                      <div className="text-green-400 font-bold mb-1">▶ APPROVAL_ID: APR_9921_OK</div>
                      <div>▶ VISIBILITY_SCOPE: RESTRICTED</div>
                      <div>▶ CLIENT_USERS: 2 ACTIVE</div>
                      <div>▶ CHANGE_REQUESTS: 0 PENDING</div>
                      <div className="text-indigo-400 mt-2">▶ SIGN_OFF_FLOW: ENFORCED & CALIBRATED</div>
                    </div>
                  </>
                )}

                {activePricingTab === 'admin' && (
                  <>
                    <div className="md:col-span-7 space-y-4">
                      <h4 className="text-lg font-bold text-on-surface">Enterprise Administration Module</h4>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Control your self-hosted operating stack. Access direct activity log auditing, system settings configurations, and raw data backup utilities.
                      </p>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-on-surface-variant">
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Activity Logs & Auditing</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Backup & Export Center</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> System Settings Management</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Security Settings Panel</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Self-Hosted Deployment Var</li>
                      </ul>
                    </div>
                    <div className="md:col-span-5 bg-[#02040a] p-5 rounded-xl border border-white/5 font-mono-pm text-[10px] leading-relaxed text-on-surface-variant h-full flex flex-col justify-center">
                      <div className="text-primary/70 uppercase tracking-widest text-[9px] font-bold mb-2">SYSTEM_AUDIT_LOG</div>
                      <div className="text-green-400 font-bold mb-1">▶ DATA_BACKUP: SUCCESSFUL</div>
                      <div>▶ AUDIT_LOGS: CAPTURED</div>
                      <div>▶ DEPLOYMENT_TYPE: SELF-HOSTED</div>
                      <div>▶ SECURITY_POLICY: ENFORCED</div>
                      <div className="text-indigo-400 mt-2">▶ INTEGRITY_HASH: STABLE (SHA256)</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Pricing Reveal Block */}
            <div className="max-w-4xl mx-auto text-center border border-white/5 bg-[#050712]/30 p-12 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-indigo-500" />
              
              <h3 className="text-2xl font-bold text-on-surface mb-4">Ready to Own Your Operational Stack?</h3>
              <p className="text-xs text-on-surface-variant max-w-xl mx-auto leading-relaxed mb-8">
                Resolve PM is delivered as a permanent software capital asset. 
                Deploy it in your own private cloud database instance, retain 100% data ownership, and avoid endless per-seat monthly subscription sprawl.
              </p>

              {!priceRevealed ? (
                <button
                  onClick={() => setPriceRevealed(true)}
                  className="btn-premium-primary px-8 py-4 rounded font-headline-sm text-headline-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300 transform hover:scale-[1.02]"
                >
                  View Deployment License Pricing
                </button>
              ) : (
                <div className="space-y-12 slide-up-fade">
                  {/* The Pricing Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch mt-6 text-left">
                    {/* Evaluation */}
                    <div className="glass-panel p-8 rounded-2xl border border-white/5 bg-[#050712]/90 flex flex-col">
                      <h4 className="text-sm font-mono-pm text-primary uppercase font-bold tracking-wider mb-2">Evaluation</h4>
                      <div className="text-3xl font-bold text-white mb-2">Free Key</div>
                      <p className="text-[11px] text-on-surface-variant mb-6 pb-6 border-b border-white/5">For testing the platform features securely.</p>
                      <ul className="space-y-3 mb-8 flex-1 text-[11px] text-on-surface-variant">
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-400 text-sm">check</span> Product Exploration</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-400 text-sm">check</span> Limited Database Space</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-400 text-sm">check</span> Single Workspace</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-400 text-sm">check</span> Sandbox Environment</li>
                      </ul>
                      <a href={verified ? "/login" : "/activate-license"} className="w-full text-center py-2.5 rounded-lg border border-white/10 text-on-surface hover:bg-white/5 transition-colors text-xs font-bold font-mono-pm uppercase">Request Evaluation Key</a>
                    </div>

                    {/* Professional */}
                    <div className="glass-panel p-8 rounded-2xl border-2 border-primary bg-[#080b1e]/90 flex flex-col relative transform md:-translate-y-4 shadow-[0_15px_45px_rgba(99,102,241,0.2)]">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[9px] font-bold uppercase tracking-widest py-1 px-3.5 rounded-full">Owner License</div>
                      <h4 className="text-sm font-mono-pm text-primary uppercase font-bold tracking-wider mb-2">Professional</h4>
                      <div className="flex items-baseline gap-2 mb-2">
                        <div className="text-3xl font-bold text-white">$2,499</div>
                        <div className="text-xs text-on-surface-variant line-through opacity-60">or ₹1,49,000</div>
                      </div>
                      <p className="text-[11px] text-primary mb-6 pb-6 border-b border-white/5 font-semibold">One-time perpetual fee.</p>
                      <ul className="space-y-3 mb-8 flex-1 text-[11px] text-on-surface-variant">
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check</span> Lifetime Deployment License</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check</span> 100% Core Database Ownership</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check</span> Unlimited Projects & Members</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check</span> Client Portal & Governance</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check</span> Timesheet & Finance Modules</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check</span> 1 Year Support & System Updates</li>
                      </ul>
                      <a href={verified ? "/login" : "/activate-license"} className="w-full text-center py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all text-xs font-bold font-mono-pm uppercase shadow-md shadow-primary/20">Buy Professional License</a>
                    </div>

                    {/* Enterprise */}
                    <div className="glass-panel p-8 rounded-2xl border border-white/5 bg-[#050712]/90 flex flex-col">
                      <h4 className="text-sm font-mono-pm text-primary uppercase font-bold tracking-wider mb-2">Enterprise</h4>
                      <div className="text-3xl font-bold text-white mb-2">Starting $7,999+</div>
                      <p className="text-[11px] text-on-surface-variant mb-6 pb-6 border-b border-white/5">or ₹4,99,000+</p>
                      <ul className="space-y-3 mb-8 flex-1 text-[11px] text-on-surface-variant">
                        <li className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-white text-sm">add</span> Everything in Professional</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-400 text-sm">check</span> Private Multi-Server Clusters</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-400 text-sm">check</span> Custom Security & SSO</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-400 text-sm">check</span> Priority SLA Support</li>
                      </ul>
                      <a href="mailto:contact@resolvepm.app" className="w-full text-center py-2.5 rounded-lg border border-white/10 text-on-surface hover:bg-white/5 transition-colors text-xs font-bold font-mono-pm uppercase">Contact Enterprise Sales</a>
                    </div>
                  </div>

                  {/* Pricing justification details */}
                  <div className="border-t border-white/5 pt-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-left text-xs text-on-surface-variant">
                    <div className="space-y-2">
                      <h5 className="font-bold text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-primary">database</span> Private Workspace
                      </h5>
                      <p className="leading-relaxed">
                        Data resides completely on your chosen database instance. There is no multi-tenant sharing or risk of cross-contamination.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h5 className="font-bold text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-primary">shield</span> Owned Deployment
                      </h5>
                      <p className="leading-relaxed">
                        Deploy it self-hosted, behind your VPN or in your private cloud. You hold absolute governance and password policies.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h5 className="font-bold text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-primary">grid_view</span> Consolidated Database
                      </h5>
                      <p className="leading-relaxed">
                        No fragmented data. All developers' hours, invoice items, task sprints, and client approvals are unified in one system.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer id="contact" className="w-full py-stack-gap-lg px-container-padding flex flex-col md:flex-row justify-between items-center border-t border-[var(--pm-border)] dark:border-[var(--border-soft)]">
        <div className="flex flex-col items-center md:items-start gap-2 mb-6 md:mb-0">
          <img src="/logo.png" alt="Resolve PM Logo" className="h-6 w-auto object-contain opacity-80" />
          <p className="font-body-sm text-body-sm text-on-surface-variant opacity-60">© 2026 Resolve PM. All rights reserved. Registered Enterprise Systems.</p>
          <div className="flex gap-4 mt-2">
             <a href="/login" className="font-mono-label text-[10px] text-primary hover:text-primary/80 transition-colors uppercase">Admin Login</a>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          <a href="/privacy" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface underline transition-all">Privacy</a>
          <a href="/terms" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface underline transition-all">Terms</a>
          <a href="mailto:contact@resolvepm.app" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface underline transition-all">Contact</a>
        </div>
      </footer>
    </div>
  );
}
