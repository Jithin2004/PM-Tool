import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Command, Activity, Sparkles, LayoutGrid, Users, Zap } from 'lucide-react';

interface Slide {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  details: string[];
}

const SLIDES: Slide[] = [
  {
    id: 'command-center',
    title: 'Command Center',
    description: 'Centralized operational cockpit with real-time health metrics, activity streams, and team radar.',
    icon: LayoutGrid,
    details: ['Workspace health at a glance', '5 key operational metrics', 'Live activity streaming'],
  },
  {
    id: 'realtime-activity',
    title: 'Realtime Activity',
    description: 'Live activity feed with intelligent grouping, severity indicators, and expanding event clusters.',
    icon: Activity,
    details: ['Grouped activity entries', 'Severity-colored indicators', 'Auto-scroll with pause on review'],
  },
  {
    id: 'ai-insights',
    title: 'AI Operational Insights',
    description: 'Embedded intelligence that surfaces blockers, imbalances, and risks without a chatbot interface.',
    icon: Sparkles,
    details: ['Confidence-ranked alerts', 'Blocked sprint detection', 'Workload imbalance warnings'],
  },
  {
    id: 'command-palette',
    title: 'Command Palette',
    description: 'Keyboard-first operational control. Slash commands, fuzzy search, and workflow triggers.',
    icon: Command,
    details: ['Spotlight-style interface', 'Slash filters (/nav, /task, /ai)', 'Contextual suggestions'],
  },
  {
    id: 'team-radar',
    title: 'Team Radar',
    description: 'Workload awareness across the team. Detect overload, blockers, and idle capacity instantly.',
    icon: Users,
    details: ['Visual workload bars', 'Blocked member indicators', 'Sprint participation tracking'],
  },
  {
    id: 'automation',
    title: 'Workflow Automation',
    description: 'Trigger automated workflows, integration syncs, and approval chains from a single rail.',
    icon: Zap,
    details: ['Quick-action shortcuts', 'Approval chain management', 'Integration health monitoring'],
  },
];

export function ProductShowcase() {
  const [current, setCurrent] = useState(0);
  const slide = SLIDES[current];

  const next = useCallback(() => setCurrent(c => Math.min(c + 1, SLIDES.length - 1)), []);
  const prev = useCallback(() => setCurrent(c => Math.max(c - 1, 0)), []);

  return (
    <section className="py-32 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-20">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text)] dark:text-[var(--text-secondary)] mb-3">Platform Capabilities</p>
          <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-[var(--pm-text)] dark:text-[var(--text-secondary)]">
            Everything you need to execute
          </h2>
        </div>

        {/* Slideshow */}
        <div className="relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Caption side */}
            <AnimatePresence mode="wait">
              <motion.div
                key={slide.id + '-text'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <div className="inline-flex items-center gap-2 px-2.5 py-1 border border-[var(--border-soft)] bg-[var(--pm-surface)]/[0.02] mb-5">
                  <slide.icon className="w-3 h-3 text-[var(--pm-text)] dark:text-[var(--text-secondary)]" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text)] dark:text-[var(--text-secondary)]">{slide.id}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-medium tracking-tight text-[var(--pm-text)] dark:text-[var(--text-secondary)] mb-3">{slide.title}</h3>
                <p className="text-sm font-mono text-[var(--pm-text)] dark:text-[var(--text-secondary)] leading-relaxed mb-6">{slide.description}</p>
                <ul className="space-y-2">
                  {slide.details.map(detail => (
                    <li key={detail} className="flex items-center gap-2.5 text-[11px] font-mono text-[var(--pm-text)] dark:text-[var(--text-secondary)]">
                      <span className="w-1 h-1 bg-[var(--pm-surface)]/20" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>

            {/* Visual side */}
            <div className="relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={slide.id + '-viz'}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                  className="aspect-[4/3] bg-[#FFFFFF] dark:bg-[#0c0c0c] border border-[var(--pm-border)] dark:border-[var(--border-soft)] flex items-center justify-center"
                >
                  <div className="text-center p-8">
                    <slide.icon className="w-12 h-12 text-[var(--pm-text)] dark:text-[var(--text-secondary)] mx-auto mb-4" />
                    <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text)] dark:text-[var(--text-secondary)]">{slide.title}</p>
                    <div className="mt-6 flex justify-center gap-2">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className="w-16 h-1 bg-[var(--pm-surface)]/[0.04]"
                          style={{ opacity: 1 - i * 0.25 }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10">
            <div className="flex items-center gap-2">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-1 transition-all duration-300 ${
                    i === current ? 'w-6 bg-[var(--pm-surface)]/40' : 'w-3 bg-[var(--pm-surface)]/10 hover:bg-[var(--pm-surface)]/20'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={prev}
                disabled={current === 0}
                className="p-2 border border-[var(--pm-border)] dark:border-[var(--border-soft)] hover:bg-[var(--pm-surface)]/[0.04] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-[var(--pm-text)] dark:text-[var(--text-secondary)]" />
              </button>
              <button
                onClick={next}
                disabled={current === SLIDES.length - 1}
                className="p-2 border border-[var(--pm-border)] dark:border-[var(--border-soft)] hover:bg-[var(--pm-surface)]/[0.04] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3.5 h-3.5 text-[var(--pm-text)] dark:text-[var(--text-secondary)]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
