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
    const text = "Find bottlenecks in Project Delta...";
    const typingElement = document.getElementById('typing-text');
    let index = 0;
    let timeoutId: any;

    function type() {
      if (!typingElement) return;
      if (index < text.length) {
        typingElement.textContent += text.charAt(index);
        index++;
        timeoutId = setTimeout(type, 100);
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
    <div className="font-body-md text-body-md overflow-x-hidden min-h-screen bg-[#121416] text-[#e2e2e5]">
      <style>{`
        .glass-panel {
            background: rgba(45, 46, 50, 0.4);
            backdrop-filter: blur(12px);
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
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
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-container-padding h-16 bg-surface border-b border-white/5 shadow-sm">
        <div className="flex items-center gap-stack-gap-lg">
          <span className="font-headline-md text-headline-md font-bold text-on-surface">Resolve PM</span>
          <div className="hidden md:flex items-center gap-stack-gap-md ml-8">
            <a className="text-primary font-bold border-b-2 border-primary pb-1 font-body-md text-body-md transition-colors" href="#">Product</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors font-body-md text-body-md" href="#">How it Works</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors font-body-md text-body-md" href="#">Analytics</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors font-body-md text-body-md" href="#">Trust</a>
          </div>
        </div>
        <div className="flex items-center gap-stack-gap-md">
          <a href="/login" className="px-5 py-2 rounded bg-primary text-on-primary font-body-md text-body-md font-semibold hover:opacity-90 transition-opacity">Login</a>
        </div>
      </nav>

      <main className="pt-32 pb-24">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-container-padding grid grid-cols-1 lg:grid-cols-12 gap-grid-gutter items-center mb-32">
          <div className="lg:col-span-7 flex flex-col gap-stack-gap-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 w-fit">
              <span className="material-symbols-outlined text-[14px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              <span className="font-mono-label text-mono-label text-primary uppercase tracking-widest">Enterprise Ready 2026</span>
            </div>
            <h1 className="font-display-lg text-display-lg text-on-surface leading-tight">
              Project Delivery, Simplified.
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
              Keep your team on track by identifying bottlenecks before they cause delays. Track external dependencies, maintain project safety, and forecast your completion dates with real-world data.
            </p>
            <div className="flex flex-wrap gap-stack-gap-md mt-4">
              <a href={verified ? "/login" : "/activate"} className="px-8 py-3 rounded bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)]">Get Started</a>
              <a href="/activate" className="px-8 py-3 rounded border border-outline-variant text-on-surface font-headline-sm text-headline-sm hover:bg-surface-variant transition-all">Request Access</a>
            </div>
            <div className="mt-4">
              <a className="text-body-sm text-on-surface-variant hover:text-primary transition-colors underline decoration-dotted" href="/login">Already a member? Login</a>
            </div>
          </div>
          <div className="lg:col-span-5 hidden lg:block relative">
            <div className="absolute -inset-10 bg-primary/5 blur-3xl rounded-full"></div>
            <div className="glass-panel p-6 rounded-xl relative border border-white/5">
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
                  <div className="h-1 flex-1 bg-white/10 rounded-full"></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-surface-container-low rounded border border-white/5">
                    <span className="font-mono-label text-[10px] text-on-surface-variant block mb-1 uppercase text-xs">SPEED</span>
                    <span className="font-mono-data text-mono-data text-on-surface">{systemSpeed}%</span>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded border border-white/5">
                    <span className="font-mono-label text-[10px] text-on-surface-variant block mb-1 uppercase text-xs">STABILITY</span>
                    <span className="font-mono-data text-mono-data text-on-surface text-xs">±0.002</span>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded border border-white/5">
                    <span className="font-mono-label text-[10px] text-on-surface-variant block mb-1 uppercase text-xs">ACTIVE ID</span>
                    <span className="font-mono-data text-mono-data text-primary text-xs">#42-99</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Section: Execution Tracking */}
        <section className="bg-surface-container-lowest py-32 border-y border-white/5">
          <div className="max-w-7xl mx-auto px-container-padding">
            <div className="mb-16">
              <h2 className="font-display-lg text-display-lg text-on-surface mb-4">Real-Time Project Visibility</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">High-precision tracking for important projects. Distinguish between internal progress and outside delays with a clear, permanent history.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-grid-gutter">
              {/* Smart Search */}
              <div className="lg:col-span-8 glass-panel rounded-xl p-8 flex flex-col gap-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">Smart Search</h3>
                    <p className="text-body-sm text-on-surface-variant">Instantly find status updates and blockers across all projects.</p>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1 rounded bg-primary/10 border border-primary/20">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                    <span className="font-mono-label text-[10px] text-primary">LIVE VIEW</span>
                  </div>
                </div>
                <div className="relative mb-6">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-primary text-xl">search</span>
                  </div>
                  <div className="w-full bg-surface-container-highest border border-outline-variant rounded-lg py-4 pl-12 pr-4 font-mono-data text-on-surface flex items-center min-h-[58px]">
                    <span className="typing-container" id="typing-text"></span>
                  </div>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                    <kbd className="bg-surface px-1.5 py-0.5 rounded border border-outline-variant text-[10px] font-mono-label text-on-surface-variant">CMD</kbd>
                    <kbd className="bg-surface px-1.5 py-0.5 rounded border border-outline-variant text-[10px] font-mono-label text-on-surface-variant">K</kbd>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="stagger-item stagger-delay-1 flex items-center justify-between p-4 bg-surface-container-low rounded-lg border border-white/5 hover:border-primary/30 transition-all cursor-default group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded flex items-center justify-center bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                        <span className="material-symbols-outlined">account_tree</span>
                      </div>
                      <div>
                        <div className="font-body-md text-on-surface">Project Delta: Core Updates</div>
                        <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Active Development</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="font-mono-data text-primary text-sm">74% Complete</div>
                        <div className="h-1 w-24 bg-white/5 rounded-full mt-1">
                          <div className="h-full bg-primary rounded-full" style={{ width: '74%' }}></div>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                    </div>
                  </div>
                  <div className="stagger-item stagger-delay-2 flex items-center justify-between p-4 bg-surface-container-low rounded-lg border border-white/5 hover:border-primary/30 transition-all cursor-default group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded flex items-center justify-center bg-tertiary/10 text-tertiary">
                        <span className="material-symbols-outlined">history_toggle_off</span>
                      </div>
                      <div>
                        <div className="font-body-md text-on-surface">Schedule Change Noted</div>
                        <div className="font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">Source: Partner Update</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="px-2 py-0.5 rounded bg-surface border border-outline-variant text-[10px] font-mono-label text-primary uppercase">Record Updated</span>
                      <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                    </div>
                  </div>
                  <div className="stagger-item stagger-delay-3 flex items-center justify-between p-4 bg-surface-container-low rounded-lg border border-white/5 hover:border-primary/30 transition-all cursor-default group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded flex items-center justify-center bg-error/10 text-error">
                        <span className="material-symbols-outlined">warning</span>
                      </div>
                      <div>
                        <div className="font-body-md text-on-surface">Mark Thompson</div>
                        <div className="font-mono-label text-[10px] text-on-surface-variant">Team Lead</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="px-2 py-0.5 rounded bg-error/10 border border-error/20 text-[10px] font-mono-label text-error uppercase">Action Required</span>
                      <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline Ledger */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="glass-panel rounded-xl p-6 border border-white/5 h-full">
                  <div className="flex items-center gap-2 mb-6 text-on-surface">
                    <span className="material-symbols-outlined">receipt_long</span>
                    <h3 className="font-headline-sm text-headline-sm">Activity Log</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 rounded border hover-translate-x bg-surface-container-high border-l-4 border-l-[#EF4444] border-white/5">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono-label text-[10px] text-on-surface-variant">REF: TX-9921</span>
                        <span className="font-mono-data text-mono-data text-[#EF4444] font-bold">-5.5d</span>
                      </div>
                      <p className="font-body-sm text-[12px] text-on-surface leading-snug">Partner server downtime causing integration delay.</p>
                      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[9px] text-on-surface-variant uppercase">Critical Delay</span>
                        <span className="text-[9px] text-error bg-error/10 px-1 py-0.5 rounded">OPEN</span>
                      </div>
                    </div>
                    <div className="p-4 rounded border hover-translate-x bg-surface-container-low border-l-4 border-l-[#22C55E] border-white/5">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono-label text-[10px] text-on-surface-variant">REF: TX-9918</span>
                        <span className="font-mono-data text-mono-data text-[#22C55E] font-bold">+1.2d</span>
                      </div>
                      <p className="font-body-sm text-[12px] text-on-surface-variant">Testing process automated ahead of schedule.</p>
                      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[9px] text-on-surface-variant uppercase">Gain</span>
                        <span className="text-[9px] text-primary bg-primary/10 px-1 py-0.5 rounded uppercase">Verified</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Value Prop Columns */}
        <section className="max-w-7xl mx-auto px-container-padding py-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-grid-gutter">
            <div className="flex flex-col gap-stack-gap-md p-8 bg-surface-container-low rounded-xl border border-white/5 hover:bg-surface-container transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[28px]">verified_user</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Verified History</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Our permanent record system ensures that project timelines can't be changed after the fact. Every update is tracked, creating a single source of truth for your leadership team.
              </p>
            </div>
            <div className="flex flex-col gap-stack-gap-md p-8 bg-surface-container-low rounded-xl border border-white/5 hover:bg-surface-container transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[28px]">speed</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Fast Performance</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Built for speed, our interface handles global projects without slowing down. Get instant updates on your most complex workstreams without the typical enterprise lag.
              </p>
            </div>
            <div className="flex flex-col gap-stack-gap-md p-8 bg-surface-container-low rounded-xl border border-white/5 hover:bg-surface-container transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[28px]">assignment_turned_in</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Clear Accountability</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Stop the guessing games. Automatically identify when outside factors affect your deadlines, protecting your team's reputation and focusing on solutions rather than blame.
              </p>
            </div>
          </div>
        </section>

        {/* Trust Section */}
        <section className="max-w-7xl mx-auto px-container-padding pb-32">
          <div className="glass-panel p-12 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-stack-gap-lg">
            <div className="flex-1 text-center md:text-left">
              <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Ready for better project visibility?</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">Work with our team to set up your custom project tracking environment.</p>
            </div>
            <div className="flex flex-col items-center gap-stack-gap-md">
              <a href="/activate" className="px-8 py-3 rounded bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold hover:opacity-90">Start Setup</a>
              <a className="text-body-sm text-on-surface-variant hover:text-primary transition-colors underline decoration-dotted" href="/login">Already have an invite? Login</a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-stack-gap-lg px-container-padding flex flex-col md:flex-row justify-between items-center bg-surface-container-lowest border-t border-white/5">
        <div className="flex flex-col items-center md:items-start gap-2 mb-6 md:mb-0">
          <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">Resolve PM</span>
          <p className="font-body-sm text-body-sm text-on-surface-variant opacity-60">© 2026 Resolve PM. All rights reserved. Registered Enterprise Systems.</p>
          <div className="flex gap-4 mt-2">
            <span className="font-mono-label text-[10px] text-primary/60 uppercase">Secure Verification Active</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface underline transition-all duration-200" href="#">Privacy</a>
          <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface underline transition-all duration-200" href="#">Terms</a>
          <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface underline transition-all duration-200" href="#">Compliance</a>
          <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface underline transition-all duration-200" href="#">Security</a>
        </div>
      </footer>
    </div>
  );
}
