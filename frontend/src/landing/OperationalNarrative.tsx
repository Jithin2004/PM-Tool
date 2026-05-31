import { motion } from 'motion/react';
import { slideUp, stagger } from '../lib/animation';
import { Crosshair, GitBranch, Eye, Brain, Sliders } from 'lucide-react';

const PILLARS = [
  {
    id: 'execution',
    icon: Crosshair,
    statement: 'Ship with precision. Every task, sprint, and release tracked in real time.',
  },
  {
    id: 'coordination',
    icon: GitBranch,
    statement: 'Align teams across workflows. Automate handoffs and eliminate friction.',
  },
  {
    id: 'visibility',
    icon: Eye,
    statement: 'Complete operational awareness. Know what every team member is working on.',
  },
  {
    id: 'intelligence',
    icon: Brain,
    statement: 'Surface risks before they become blockers. Intelligent recommendations embedded in your workflow.',
  },
  {
    id: 'control',
    icon: Sliders,
    statement: 'Fine-grained operational control. Role-based access, audit trails, and execution modes.',
  },
];

export function OperationalNarrative() {
  return (
    <section className="py-32 px-6 border-t border-white/[0.03]">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger(0.06)}
          className="space-y-20"
        >
          {PILLARS.map((pillar, i) => (
            <motion.div
              key={pillar.id}
              variants={slideUp}
              className={`grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-8 items-start ${
                i % 2 === 0 ? '' : 'sm:text-right'
              }`}
            >
              <div className={`sm:col-span-3 ${i % 2 === 0 ? 'sm:order-1' : 'sm:order-2'}`}>
                <div className={`inline-flex items-center gap-2 ${i % 2 === 0 ? '' : 'sm:flex-row-reverse'}`}>
                  <pillar.icon className="w-4 h-4 text-[var(--pm-text)] dark:text-white/30" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text)] dark:text-white/30">{pillar.id}</span>
                </div>
              </div>
              <div className={`sm:col-span-9 ${i % 2 === 0 ? 'sm:order-2' : 'sm:order-1'}`}>
                <p className="text-base sm:text-lg font-mono text-[var(--pm-text)] dark:text-white/70 leading-relaxed">
                  {pillar.statement}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
