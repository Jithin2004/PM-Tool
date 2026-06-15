import React, { useEffect, useState } from 'react';
import { isProductKeyVerified } from '../lib/productKey';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { navigateTo, resolveAuthenticatedDestination } from '../core/auth/postAuthRedirect';

export function LandingPage() {
  const verified = isProductKeyVerified() || !!useAuth().user;
  const { user, profile, profileResolved, loading: authLoading } = useAuth();
  const { workspace, loading: workspaceLoading } = useWorkspace();

  const authReady = profileResolved && !authLoading;
  const hasSession = authReady && !!user && !!profile && profile.role !== 'uninvited';

  const [systemSpeed, setSystemSpeed] = useState('98.4');
  const [activeSection, setActiveSection] = useState('');

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

  // Simulated data updates
  useEffect(() => {
    const interval = setInterval(() => {
      const base = 98.4;
      const fluc = (Math.random() * 0.2).toFixed(1);
      setSystemSpeed((base + parseFloat(fluc)).toFixed(1));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
              <a href={verified ? "/login" : "/activate"} className="btn-premium-primary px-8 py-4 rounded font-headline-sm text-headline-sm font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300">Start Workspace</a>
              <a href="#pricing" className="glass-panel px-8 py-4 rounded font-headline-sm text-headline-sm hover:bg-white/5 transition-all duration-300">View License Options</a>
            </div>
            <div className="mt-4">
              <a className="text-body-sm text-on-surface-variant hover:text-primary transition-colors underline decoration-dotted" href="/login">Already a member? Login</a>
            </div>
          </div>
          <div className="lg:col-span-5 hidden lg:block relative">
            <div className="absolute -inset-10 bg-primary/10 blur-[80px] rounded-full"></div>
            <div className="glass-panel p-8 rounded-2xl relative border border-[var(--pm-border)] dark:border-[var(--border-soft)] shadow-2xl animate-pulse-slow">
              <div className="flex items-center justify-between mb-8">
                <span className="font-mono-label text-mono-label text-on-surface-variant uppercase">Deployment Status</span>
                <span className="flex items-center gap-2 font-mono-label text-mono-label text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></span> SELF-HOSTED ACTIVE
                </span>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-surface-container-low rounded-xl border border-[var(--border-soft)] flex flex-col gap-2">
                    <span className="material-symbols-outlined text-primary mb-1">database</span>
                    <span className="font-mono-label text-[10px] text-on-surface-variant uppercase">Data Ownership</span>
                    <span className="font-mono-data text-sm text-on-surface">100% Private</span>
                  </div>
                  <div className="p-4 bg-surface-container-low rounded-xl border border-[var(--border-soft)] flex flex-col gap-2">
                    <span className="material-symbols-outlined text-green-400 mb-1">speed</span>
                    <span className="font-mono-label text-[10px] text-on-surface-variant uppercase">System Speed</span>
                    <span className="font-mono-data text-sm text-on-surface">{systemSpeed}ms</span>
                  </div>
                </div>
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 flex flex-col gap-2">
                    <span className="font-mono-label text-[10px] text-primary uppercase">License Verification</span>
                    <span className="font-mono-data text-xs text-on-surface break-all">RSLV-ENT-9942-XXXX-VALIDATED</span>
                </div>
              </div>
            </div>
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

        {/* Section 3: License Pricing */}
        <section id="pricing" className="py-32 scroll-mt-16 bg-surface-container-lowest border-y border-[var(--border-soft)]">
          <div className="max-w-7xl mx-auto px-container-padding">
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <span className="font-mono-label text-mono-label text-primary uppercase tracking-widest">No Monthly Subscription</span>
              </div>
              <h2 className="font-display-lg text-4xl md:text-5xl text-on-surface mb-6 tracking-tight font-bold">Own Your Operations</h2>
              <p className="font-body-lg text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
                A company buys Resolve PM once, deploys it, and owns their operational system forever. Updates included for the first year.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
              {/* Evaluation */}
              <div className="glass-panel p-8 rounded-2xl border border-[var(--border-soft)] flex flex-col">
                <h3 className="text-xl font-bold text-on-surface mb-2">Evaluation</h3>
                <div className="text-4xl font-bold text-white mb-2">Free</div>
                <p className="text-sm text-on-surface-variant mb-8 pb-8 border-b border-[var(--border-soft)]">For testing Resolve PM securely.</p>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-green-400 text-[18px]">check</span> Product exploration</li>
                  <li className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-green-400 text-[18px]">check</span> Limited workspace</li>
                  <li className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-green-400 text-[18px]">check</span> Demo data provisioning</li>
                </ul>
                <a href="#contact" className="w-full text-center py-3 rounded-lg border border-[var(--border-soft)] text-on-surface hover:bg-white/5 transition-colors font-semibold">Request Evaluation Key</a>
              </div>

              {/* Professional */}
              <div className="glass-panel p-8 rounded-2xl border-2 border-primary relative flex flex-col transform md:-translate-y-4 shadow-[0_10px_40px_rgba(99,102,241,0.15)]">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold uppercase tracking-widest py-1 px-4 rounded-full">Recommended</div>
                <h3 className="text-xl font-bold text-on-surface mb-2">Professional License</h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <div className="text-4xl font-bold text-white">$2,499</div>
                  <div className="text-sm text-on-surface-variant line-through opacity-60">or ₹1,49,000</div>
                </div>
                <p className="text-sm text-primary mb-8 pb-8 border-b border-[var(--border-soft)] font-medium">One-time payment.</p>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-primary text-[18px]">check</span> Lifetime deployment license</li>
                  <li className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-primary text-[18px]">check</span> Unlimited projects & users</li>
                  <li className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-primary text-[18px]">check</span> Project intelligence & Finance</li>
                  <li className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-primary text-[18px]">check</span> Client portal & Change requests</li>
                  <li className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-primary text-[18px]">check</span> Time-to-invoice workflows</li>
                  <li className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-primary text-[18px]">check</span> Governance & Company memory</li>
                </ul>
                <a href="/activate" className="w-full text-center py-3 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-bold shadow-lg shadow-primary/20">Buy Professional License</a>
              </div>

              {/* Enterprise */}
              <div className="glass-panel p-8 rounded-2xl border border-[var(--border-soft)] flex flex-col">
                <h3 className="text-xl font-bold text-on-surface mb-2">Enterprise License</h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <div className="text-4xl font-bold text-white">Starting $7,999+</div>
                </div>
                <p className="text-sm text-on-surface-variant mb-8 pb-8 border-b border-[var(--border-soft)]">or ₹4,99,000+</p>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-white text-[18px]">add</span> Everything in Professional</li>
                  <li className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-green-400 text-[18px]">check</span> Deployment assistance</li>
                  <li className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-green-400 text-[18px]">check</span> Advanced governance</li>
                  <li className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-green-400 text-[18px]">check</span> Larger team architecture</li>
                  <li className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-green-400 text-[18px]">check</span> Custom branding</li>
                  <li className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-green-400 text-[18px]">check</span> Priority support SLA</li>
                </ul>
                <a href="#contact" className="w-full text-center py-3 rounded-lg border border-[var(--border-soft)] text-on-surface hover:bg-white/5 transition-colors font-semibold">Contact Enterprise Sales</a>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Price Justification */}
        <section id="justification" className="py-32 bg-[#050712]">
          <div className="max-w-4xl mx-auto px-container-padding text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-6">balance</span>
            <h2 className="font-display-lg text-3xl md:text-4xl text-on-surface mb-8 tracking-tight font-bold">Why ownership beats subscription sprawl</h2>
            <p className="font-body-lg text-lg text-on-surface-variant leading-relaxed text-left md:text-center">
              Most agencies pay separately for project management, time tracking, reporting, client communication, and finance coordination. By the end of the year, per-seat SaaS fees drain significant capital while siloing your critical data.
            </p>
            <p className="font-body-lg text-lg text-on-surface-variant leading-relaxed mt-6 text-left md:text-center">
              Resolve PM replaces disconnected systems with one owned platform. Purchasing a perpetual license transforms software from an endless operating expense into a permanent capital asset for your agency.
            </p>
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
