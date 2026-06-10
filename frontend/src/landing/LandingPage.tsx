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
      const sections = ['how-it-works', 'analytics', 'trust'];
      const scrollPosition = window.scrollY + 120; // offset for header + margin

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

    // Typing Animation
    useEffect(() => {
      const text = "Why is Project Delta delayed again?...";
      const typingElement = document.getElementById('typing-text');
      let index = 0;
      let timeoutId: any;
  
      function type() {
        if (!typingElement) return;
        if (index < text.length) {
          typingElement.textContent += text.charAt(index);
          index++;
          timeoutId = setTimeout(type, 80);
        } else {
          timeoutId = setTimeout(() => {
            if (typingElement) typingElement.textContent = "";
            index = 0;
            type();
          }, 3000);
        }
      }

    timeoutId = setTimeout(type, 100);
    return () => clearTimeout(timeoutId);
  }, []);

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
    <div className="font-body-md text-body-md overflow-x-hidden min-h-screen  text-[#e2e2e5]">
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
        .typing-container::after {
            content: '|';
            animation: blink 1s step-end infinite;
            color: #c0c1ff;
            margin-left: 2px;
        }
        @keyframes blink {
            from, to { opacity: 1; }
            50% { opacity: 0; }
        }
        @keyframes slideUpFade {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .stagger-item {
            animation: slideUpFade 0.5s ease forwards;
            opacity: 0;
        }
        .stagger-delay-1 { animation-delay: 0.1s; }
        .stagger-delay-2 { animation-delay: 0.2s; }
        .stagger-delay-3 { animation-delay: 0.3s; }
        .hover-translate-x { transition: transform 0.2s ease; }
        .hover-translate-x:hover { transform: translateX(4px); }
      `}</style>

      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-container-padding h-16 bg-[#050712]/70 backdrop-blur-md border-b border-[var(--border-soft)] shadow-sm">
        <div className="flex items-center gap-stack-gap-lg">
          <span className="font-headline-md text-headline-md font-bold text-on-surface">Resolve PM</span>
          <div className="hidden md:flex items-center gap-stack-gap-md ml-8">
            <a className={`transition-colors font-body-md text-body-md ${activeSection === '' ? 'text-primary font-bold border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary'}`} href="#">Product</a>
            <a className={`transition-colors font-body-md text-body-md ${activeSection === 'how-it-works' ? 'text-primary font-bold border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary'}`} href="#how-it-works">How it Works</a>
            <a className={`transition-colors font-body-md text-body-md ${activeSection === 'analytics' ? 'text-primary font-bold border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary'}`} href="#analytics">Analytics</a>
            <a className={`transition-colors font-body-md text-body-md ${activeSection === 'trust' ? 'text-primary font-bold border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary'}`} href="#trust">Trust</a>
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
              <span className="material-symbols-outlined text-[14px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>visibility</span>
              <span className="font-mono-label text-mono-label text-primary uppercase tracking-widest">For Software Agencies</span>
            </div>
            <h1 className="font-display-lg text-display-lg text-on-surface leading-tight">
              Stop wondering why<br/>development is slow.
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
              You aren't missing deadlines because your developers are lazy. You're missing them because your team is waiting on client approvals, third-party APIs, and feedback. Resolve PM exposes exactly where time is lost, so you can guarantee your delivery timelines.
            </p>
            <div className="flex flex-wrap gap-stack-gap-md mt-4">
              <a href={verified ? "/login" : "/activate"} className="btn-premium-primary px-8 py-3.5 rounded font-headline-sm text-headline-sm font-semibold">Start Founder Pilot</a>
              <a href="/activate" className="btn-premium-secondary px-8 py-3.5 rounded font-headline-sm text-headline-sm">See Pricing</a>
            </div>
            <div className="mt-4">
              <a className="text-body-sm text-on-surface-variant hover:text-primary transition-colors underline decoration-dotted" href="/login">Already a member? Login</a>
            </div>
          </div>
          <div className="lg:col-span-5 hidden lg:block relative">
            <div className="absolute -inset-10 bg-primary/5 blur-3xl rounded-full"></div>
            <div className="glass-panel p-6 rounded-xl relative border border-[var(--pm-border)] dark:border-[var(--border-soft)]">
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono-label text-mono-label text-on-surface-variant uppercase">System Health</span>
                <span className="flex items-center gap-1.5 font-mono-label text-mono-label text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> MONITORING ACTIVE
                </span>
              </div>
              <div className="space-y-6">
                <div className="flex gap-1">
                  <div className="h-1 flex-1 bg-green-400/30 rounded-full"><div className="h-full bg-green-400 w-full rounded-full"></div></div>
                  <div className="h-1 flex-1 bg-green-400/30 rounded-full"><div className="h-full bg-green-400 w-full rounded-full"></div></div>
                  <div className="h-1 flex-1 bg-green-400/30 rounded-full"><div className="h-full bg-green-400 w-3/4 rounded-full"></div></div>
                  <div className="h-1 flex-1 bg-[var(--pm-surface)]/10 rounded-full"></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-surface-container-low rounded border border-[var(--pm-border)] dark:border-[var(--border-soft)]">
                    <span className="font-mono-label text-[10px] text-on-surface-variant block mb-1 uppercase text-xs">SPEED</span>
                    <span className="font-mono-data text-mono-data text-on-surface">{systemSpeed}%</span>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded border border-[var(--pm-border)] dark:border-[var(--border-soft)]">
                    <span className="font-mono-label text-[10px] text-on-surface-variant block mb-1 uppercase text-xs">STABILITY</span>
                    <span className="font-mono-data text-mono-data text-on-surface text-xs">±0.002</span>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded border border-[var(--pm-border)] dark:border-[var(--border-soft)]">
                    <span className="font-mono-label text-[10px] text-on-surface-variant block mb-1 uppercase text-xs">ACTIVE ID</span>
                    <span className="font-mono-data text-mono-data text-primary text-xs">#42-99</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: How It Works */}
        <section id="how-it-works" className="bg-surface-container-lowest py-32 border-y border-[var(--pm-border)] dark:border-[var(--border-soft)] scroll-mt-16">
          <div className="max-w-7xl mx-auto px-container-padding">
            <div className="mb-24 md:mb-32">
              <h2 className="font-display-lg text-4xl md:text-5xl text-on-surface mb-6 tracking-tight">How agencies regain control</h2>
              <p className="font-body-lg text-lg text-on-surface-variant max-w-3xl leading-relaxed">
                Client projects aren't delayed by code—they are delayed by miscommunication, missing assets, and external wait states. Resolve PM forces visibility onto the hidden blocks that kill your margins.
              </p>
            </div>
            
            <div className="relative">
              {/* Vertical line connecting nodes */}
              <div className="absolute left-[27px] top-4 bottom-4 w-[2px] bg-[var(--pm-surface)]/5 hidden md:block"></div>
              
              <div className="space-y-16 md:space-y-24">
                {/* Step 1 & 2 */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-16 relative">
                  <div className="md:col-span-5 flex gap-6">
                    <div className="relative z-10 w-14 h-14 shrink-0 rounded-xl bg-surface-container-highest border border-[var(--pm-border)] dark:border-[var(--border-soft)] flex items-center justify-center text-on-surface font-mono-label shadow-lg">01</div>
                    <div>
                      <h3 className="text-xl font-semibold text-on-surface mb-3">Map the Reality</h3>
                      <p className="text-on-surface-variant leading-relaxed text-sm">Most tools just track 'To-Do'. We track who is actually holding the ball. Define the critical path including the parts your team doesn't control.</p>
                    </div>
                  </div>
                  <div className="md:col-span-7">
                    <div className="glass-panel p-6 rounded-xl border border-[var(--pm-border)] dark:border-[var(--border-soft)]">
                      <div className="h-4 w-1/4 bg-[var(--pm-surface)]/10 rounded mb-6"></div>
                      <div className="space-y-3">
                        <div className="h-8 w-full bg-surface-container-low border border-[var(--pm-border)] dark:border-[var(--border-soft)] rounded flex items-center px-4 gap-3">
                          <span className="material-symbols-outlined text-[14px] text-primary">check_circle</span>
                          <span className="h-2 w-1/3 bg-[var(--pm-surface)]/10 rounded"></span>
                        </div>
                        <div className="h-8 w-full bg-surface-container-low border border-[var(--pm-border)] dark:border-[var(--border-soft)] rounded flex items-center px-4 gap-3">
                          <span className="material-symbols-outlined text-[14px] text-[var(--pm-text)] dark:text-[var(--text-secondary)]">radio_button_unchecked</span>
                          <span className="h-2 w-1/2 bg-[var(--pm-surface)]/10 rounded"></span>
                        </div>
                        <div className="h-8 w-3/4 bg-surface-container-low border border-[var(--pm-border)] dark:border-[var(--border-soft)] rounded flex items-center px-4 gap-3">
                          <span className="material-symbols-outlined text-[14px] text-[var(--pm-text)] dark:text-[var(--text-secondary)]">radio_button_unchecked</span>
                          <span className="h-2 w-1/4 bg-[var(--pm-surface)]/10 rounded"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-16 relative">
                  <div className="md:col-span-5 flex gap-6">
                    <div className="relative z-10 w-14 h-14 shrink-0 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-mono-label shadow-[0_0_15px_rgba(99,102,241,0.15)]">02</div>
                    <div>
                      <h3 className="text-xl font-semibold text-on-surface mb-3">Highlight the Blockers</h3>
                      <p className="text-on-surface-variant leading-relaxed text-sm">When a client doesn't send the API keys, Jira just shows a task sitting there. Resolve PM flags it, calculates the cost of the delay, and alerts you.</p>
                    </div>
                  </div>
                  <div className="md:col-span-7">
                    <div className="glass-panel p-6 rounded-xl flex flex-col gap-4 border border-[var(--pm-border)] dark:border-[var(--border-soft)]">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-12 bg-surface-container-high rounded border border-[var(--pm-border)] dark:border-[var(--border-soft)] flex items-center px-4">
                          <span className="w-2 h-2 rounded-full bg-primary/50 mr-3"></span>
                          <span className="text-xs font-mono text-on-surface-variant">Core API</span>
                        </div>
                        <span className="material-symbols-outlined text-[var(--pm-text)] dark:text-[var(--text-secondary)]">arrow_forward</span>
                        <div className="flex-1 h-12 bg-surface-container-high rounded border border-primary/20 flex items-center px-4 relative overflow-hidden">
                          <div className="absolute inset-0 bg-primary/5 pointer-events-none"></div>
                          <span className="w-2 h-2 rounded-full bg-primary animate-pulse mr-3"></span>
                          <span className="text-xs font-mono text-primary">Client Auth Gateway</span>
                        </div>
                      </div>
                      <div className="px-4 py-2 border-l-2 border-error/50 bg-error/5 text-[10px] font-mono text-error/80 uppercase tracking-wider rounded-r">
                        DEPENDENCY BLOCKED: AWAITING COMPLIANCE REVIEW
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 4 & 5 */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-16 relative">
                  <div className="md:col-span-5 flex gap-6">
                    <div className="relative z-10 w-14 h-14 shrink-0 rounded-xl bg-surface-container-highest border border-[var(--pm-border)] dark:border-[var(--border-soft)] flex items-center justify-center text-on-surface font-mono-label shadow-lg">03</div>
                    <div>
                      <h3 className="text-xl font-semibold text-on-surface mb-3">Defend Your Margins</h3>
                      <p className="text-on-surface-variant leading-relaxed text-sm">When the client asks "Why is this late?", you have an exact, immutable timeline showing that 14 days were spent waiting on their compliance team.</p>
                    </div>
                  </div>
                  <div className="md:col-span-7">
                    <div className="glass-panel p-6 rounded-xl border border-[var(--pm-border)] dark:border-[var(--border-soft)] border-l-4 border-l-primary/50">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Drift Detected</span>
                        <span className="text-[10px] text-error font-mono bg-error/10 border border-error/20 px-2 py-1 rounded">+2.4 Days</span>
                      </div>
                      <div className="h-2 w-full bg-[var(--pm-surface)]/5 rounded overflow-hidden flex">
                        <div className="h-full bg-primary/40 w-[60%]"></div>
                        <div className="h-full bg-error/40 w-[15%]"></div>
                      </div>
                      <div className="mt-4 flex justify-between text-[10px] font-mono text-on-surface-variant">
                        <span>Expected: 12th Aug</span>
                        <span>Forecast: 15th Aug</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Analytics */}
        <section id="analytics" className="py-32 scroll-mt-16 bg-[#121416]">
          <div className="max-w-7xl mx-auto px-container-padding">
            <div className="mb-24 text-center md:text-left">
              <h2 className="font-display-lg text-4xl md:text-5xl text-on-surface mb-6 tracking-tight">See what's actually happening</h2>
              <p className="font-body-lg text-lg text-on-surface-variant max-w-3xl leading-relaxed md:mx-0 mx-auto">
                Stop looking at generic burndown charts. Resolve PM analytics focus on delivery confidence, client bottleneck congestion, and exactly how much time your project spends waiting on external factors.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Block 1 */}
              <div className="glass-panel rounded-2xl p-8 md:p-12 border border-[var(--pm-border)] dark:border-[var(--border-soft)] hover:border-primary/20 transition-colors">
                <div className="flex justify-between items-start mb-12">
                  <h3 className="text-lg font-medium text-on-surface">Execution Pressure</h3>
                  <span className="material-symbols-outlined text-primary">monitoring</span>
                </div>
                <div className="space-y-8">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-on-surface-variant font-mono text-[11px] uppercase">Internal Work</span>
                      <span className="text-on-surface font-mono text-xs">32%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[var(--pm-surface)]/5 rounded-full overflow-hidden">
                      <div className="h-full bg-primary/60 w-[32%] rounded-full"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-on-surface-variant font-mono text-[11px] uppercase">Blocked / Waiting</span>
                      <span className="text-error font-mono font-medium text-xs">68%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[var(--pm-surface)]/5 rounded-full overflow-hidden">
                      <div className="h-full bg-error/60 w-[68%] rounded-full"></div>
                    </div>
                    <p className="mt-6 text-sm text-on-surface-variant/80 leading-relaxed border-t border-[var(--pm-border)] dark:border-[var(--border-soft)] pt-6">
                      Project has spent the majority of its lifecycle waiting on external infrastructure provisioning and client compliance reviews.
                    </p>
                  </div>
                </div>
              </div>

              {/* Block 2 */}
              <div className="glass-panel rounded-2xl p-8 md:p-12 border border-[var(--pm-border)] dark:border-[var(--border-soft)] hover:border-primary/20 transition-colors flex flex-col">
                <div className="flex justify-between items-start mb-12">
                  <h3 className="text-lg font-medium text-on-surface">Release Confidence</h3>
                  <span className="material-symbols-outlined text-primary">tune</span>
                </div>
                <div className="flex items-end gap-2 h-32 mt-auto mb-6">
                  <div className="w-1/6 bg-[var(--pm-surface)]/5 rounded-t-sm h-[40%] hover:bg-[var(--pm-surface)]/10 transition-colors"></div>
                  <div className="w-1/6 bg-[var(--pm-surface)]/5 rounded-t-sm h-[60%] hover:bg-[var(--pm-surface)]/10 transition-colors"></div>
                  <div className="w-1/6 bg-[var(--pm-surface)]/5 rounded-t-sm h-[45%] hover:bg-[var(--pm-surface)]/10 transition-colors"></div>
                  <div className="w-1/6 bg-[var(--pm-surface)]/5 rounded-t-sm h-[80%] hover:bg-[var(--pm-surface)]/10 transition-colors"></div>
                  <div className="w-1/6 bg-primary/20 rounded-t-sm h-[95%] border-t border-primary/50 relative">
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface text-primary text-[10px] px-2 py-1 rounded border border-primary/20 font-mono tracking-wider">Q3</div>
                  </div>
                  <div className="w-1/6 bg-[var(--pm-surface)]/5 rounded-t-sm h-[30%] hover:bg-[var(--pm-surface)]/10 transition-colors"></div>
                </div>
                <p className="text-sm text-on-surface-variant/80 leading-relaxed border-t border-[var(--pm-border)] dark:border-[var(--border-soft)] pt-6 mt-auto">
                  Deterministic forecasting based on historical wait states predicts a 95% probability of on-time delivery for the Q3 release window.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Trust */}
        <section id="trust" className="bg-surface-container-lowest py-32 border-y border-[var(--pm-border)] dark:border-[var(--border-soft)] scroll-mt-16">
          <div className="max-w-7xl mx-auto px-container-padding">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
              <div>
                <h2 className="font-display-lg text-4xl md:text-5xl text-on-surface mb-6 tracking-tight">Why Trust Us?</h2>
                <div className="space-y-6 text-lg text-on-surface-variant leading-relaxed">
                  <p>
                    We built Resolve PM because we were tired of running agencies on spreadsheets and chaotic chat threads. Generic tools track tasks, but they don't track reality.
                  </p>
                  <p>
                    Resolve PM is provided as a <strong>Perpetual License</strong>. You buy it once, you host it yourself (or we host it for you), and you own your data forever. No per-seat pricing. No SaaS lock-in. No unexpected subscription hikes.
                  </p>
                  <ul className="space-y-4 mt-8 pt-4 border-t border-[var(--pm-border)] dark:border-[var(--border-soft)]">
                    <li className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-sm">payments</span>
                      <span className="text-sm font-mono text-on-surface">One-time flat fee (₹2,50,000)</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-sm">groups</span>
                      <span className="text-sm font-mono text-on-surface">Unlimited team members</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-sm">shield</span>
                      <span className="text-sm font-mono text-on-surface">100% data ownership</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl border border-[var(--pm-border)] dark:border-[var(--border-soft)] shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
                
                {/* Mock Ledger */}
                <div className="space-y-1 relative z-10">
                  <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-[var(--pm-border)] dark:border-[var(--border-soft)] text-[10px] font-mono text-on-surface-variant uppercase tracking-wider mb-2">
                    <span>Timestamp</span>
                    <span>Actor</span>
                    <span>Action</span>
                    <span>Status</span>
                  </div>
                  
                  {[
                    { t: '10:42:05Z', a: 'SYS_SYNC', act: 'CAL_UPDATE', s: 'SUCCESS' },
                    { t: '09:15:22Z', a: 'USR_4091', act: 'STATE_CHANGE', s: 'VERIFIED' },
                    { t: '08:02:11Z', a: 'USR_2288', act: 'DEPEND_ADD', s: 'VERIFIED' },
                    { t: '07:45:00Z', a: 'SYS_AUDIT', act: 'LEDGER_SEAL', s: 'LOCKED' },
                  ].map((row, i) => (
                    <div key={i} className="grid grid-cols-4 gap-4 px-4 py-3 bg-[var(--pm-surface)]/[0.02] rounded hover:bg-[var(--pm-surface)]/[0.04] transition-colors text-xs font-mono text-on-surface">
                      <span className="text-on-surface-variant/60 text-[10px]">{row.t}</span>
                      <span className="text-primary/80 text-[10px]">{row.a}</span>
                      <span className="text-[10px]">{row.act}</span>
                      <span className={`text-[10px] ${row.s === 'LOCKED' ? 'text-on-surface-variant' : 'text-green-400/80'}`}>{row.s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="max-w-7xl mx-auto px-container-padding py-32">
          <div className="glass-panel p-12 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-stack-gap-lg">
            <div className="flex-1 text-center md:text-left">
              <h2 className="font-headline-md text-3xl text-on-surface mb-2 tracking-tight">Join the Founder Pilot Program</h2>
              <p className="font-body-md text-lg text-on-surface-variant">We are onboarding 10 agencies this month with direct CEO support and discounted perpetual licensing.</p>
            </div>
            <div className="flex flex-col items-center gap-stack-gap-md shrink-0">
              <a href="/activate" className="btn-premium-primary px-8 py-3.5 rounded font-headline-sm text-sm font-semibold">Apply for Pilot</a>
              <a className="text-xs font-mono text-on-surface-variant hover:text-primary transition-colors underline decoration-dotted" href="/login">Already a member? Login</a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-stack-gap-lg px-container-padding flex flex-col md:flex-row justify-between items-center border-t border-[var(--pm-border)] dark:border-[var(--border-soft)]">
        <div className="flex flex-col items-center md:items-start gap-2 mb-6 md:mb-0">
          <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">Resolve PM</span>
          <p className="font-body-sm text-body-sm text-on-surface-variant opacity-60">© 2026 Resolve PM. All rights reserved. Registered Enterprise Systems.</p>
          <div className="flex gap-4 mt-2">
            <span className="font-mono-label text-[10px] text-primary/60 uppercase">Secure Verification Active</span>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          {/* These are the active links Google will check */}
          <a href="/privacy" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface underline transition-all">Privacy</a>
          <a href="/terms" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface underline transition-all">Terms</a>
          <a href="/compliance" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface underline transition-all">Compliance</a>
          <a href="/security" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface underline transition-all">Security</a>
        </div>
      </footer>
    </div>
  );
}
