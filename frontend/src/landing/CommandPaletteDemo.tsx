import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Command, ArrowRight, Search, FileText, Users, BarChart3 } from 'lucide-react';
import { slideUp, stagger } from '../lib/animation';

interface DemoCommand {
  input: string;
  results: { icon: React.ElementType; label: string; description: string }[];
}

const DEMOS: DemoCommand[] = [
  {
    input: '/find blockers',
    results: [
      { icon: BarChart3, label: 'Sprint velocity at risk', description: '3 tasks blocked in active sprint' },
      { icon: FileText, label: 'Overdue cluster detected', description: '2 overdue tasks share dependencies' },
      { icon: Users, label: 'Team capacity alert', description: '2 members at 90%+ workload' },
    ],
  },
  {
    input: '/assign @jordan',
    results: [
      { icon: FileText, label: '3 tasks assigned to Jordan', description: 'Frontend - UI polish sprint' },
      { icon: BarChart3, label: 'Jordan at 65% capacity', description: 'Available for new assignments' },
    ],
  },
  {
    input: '/open sprint',
    results: [
      { icon: BarChart3, label: 'Active Sprint: UI Polish', description: '8/12 tasks complete | 3 days remaining' },
      { icon: Users, label: 'Sprint participants', description: '5 members | 124 planned points' },
    ],
  },
];

export function CommandPaletteDemo() {
  const [demoIndex, setDemoIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [showResults, setShowResults] = useState(false);

  const demo = DEMOS[demoIndex];

  useEffect(() => {
    setShowResults(false);
    setTyped('');

    const typeTimer = setTimeout(() => {
      let i = 0;
      const input = demo.input;
      const interval = setInterval(() => {
        i++;
        setTyped(input.slice(0, i));
        if (i >= input.length) {
          clearInterval(interval);
          setTimeout(() => setShowResults(true), 300);
        }
      }, 40);

      return () => clearInterval(interval);
    }, 600);

    const advance = setTimeout(() => {
      setDemoIndex(d => (d + 1) % DEMOS.length);
    }, 5000);

    return () => {
      clearTimeout(typeTimer);
      clearTimeout(advance);
    };
  }, [demoIndex]);

  return (
    <section className="py-32 px-6 border-t border-[var(--border-soft)]">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger(0.06)}
          className="text-center mb-14"
        >
          <motion.p variants={slideUp} className="text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text)] dark:text-[var(--text-secondary)] mb-3">
            Keyboard-First Operations
          </motion.p>
          <motion.h2 variants={slideUp} className="text-2xl sm:text-3xl font-medium tracking-tight text-[var(--pm-text)] dark:text-[var(--text-secondary)]">
            Everything at your fingertips
          </motion.h2>
        </motion.div>

        {/* Simulated command palette */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="bg-[#FFFFFF] dark:bg-[#0c0c0c] border border-[var(--pm-border)] dark:border-[var(--border-soft)] overflow-hidden"
        >
          {/* Input bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-soft)]">
            <Command className="w-4 h-4 text-[var(--pm-text)] dark:text-[var(--text-secondary)] shrink-0" />
            <div className="flex-1 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-[var(--pm-text)] dark:text-[var(--text-secondary)] shrink-0" />
              <span className="font-mono text-sm text-[var(--pm-text)] dark:text-[var(--text-secondary)]">
                {typed}
                <span className="inline-block w-[2px] h-4 bg-[var(--pm-surface)]/40 ml-0.5 animate-pulse" />
              </span>
            </div>
          </div>

          {/* Results area */}
          <AnimatePresence mode="wait">
            {showResults && (
              <motion.div
                key={demoIndex}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                className="min-h-[180px]"
              >
                <div className="px-2 py-2 space-y-0.5">
                  {demo.results.map((result, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--pm-surface)]/[0.04] transition-colors cursor-default"
                    >
                      <result.icon className="w-3.5 h-3.5 text-[var(--pm-text)] dark:text-[var(--text-secondary)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-mono text-[var(--pm-text)] dark:text-[var(--text-secondary)] truncate">{result.label}</p>
                        <p className="text-[10px] font-mono text-[var(--pm-text)] dark:text-[var(--text-secondary)] truncate">{result.description}</p>
                      </div>
                      <ArrowRight className="w-3 h-3 text-[var(--pm-text)] dark:text-[var(--text-secondary)] shrink-0" />
                    </div>
                  ))}
                </div>

                {/* Footer hint */}
                <div className="px-4 py-2 border-t border-[var(--border-soft)]">
                  <p className="text-[9px] font-mono text-[var(--pm-text)] dark:text-[var(--text-secondary)]">
                    <span className="text-[var(--pm-text)] dark:text-[var(--text-secondary)]">/nav</span> navigation &middot;{' '}
                    <span className="text-[var(--pm-text)] dark:text-[var(--text-secondary)]">/task</span> tasks &middot;{' '}
                    <span className="text-[var(--pm-text)] dark:text-[var(--text-secondary)]">/ops</span> intelligence
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Demo indicator */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {DEMOS.map((_, i) => (
            <button
              key={i}
              onClick={() => setDemoIndex(i)}
              className={`h-1 transition-all duration-300 ${
                i === demoIndex ? 'w-5 bg-[var(--pm-surface)]/40' : 'w-2 bg-[var(--pm-surface)]/10 hover:bg-[var(--pm-surface)]/20'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
