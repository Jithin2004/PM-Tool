import { motion } from 'motion/react';
import { Sparkles, AlertTriangle, AlertCircle, BarChart3 } from 'lucide-react';
import { slideUp, stagger } from '../lib/animation';

const INSIGHTS = [
  {
    type: 'blocked-sprint',
    icon: AlertCircle,
    label: 'Sprint Blocked',
    message: 'Frontend sprint stalled — 3 tasks awaiting design approval. Est. impact: 2 days.',
    confidence: 'high',
  },
  {
    type: 'workload-imbalance',
    icon: BarChart3,
    label: 'Workload Alert',
    message: '2 team members above 90% capacity. Reallocation recommended to balance sprint load.',
    confidence: 'high',
  },
  {
    type: 'overdue-cluster',
    icon: AlertTriangle,
    label: 'Overdue Cluster',
    message: '4 overdue tasks share dependencies with 8 upcoming deadlines. Potential cascade risk.',
    confidence: 'medium',
  },
];

export function AIInsightsPreview() {
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
            Operational Intelligence
          </motion.p>
          <motion.h2 variants={slideUp} className="text-2xl sm:text-3xl font-medium tracking-tight text-[var(--pm-text)] dark:text-[var(--text-secondary)]">
            Intelligence embedded, not bolted on
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={stagger(0.08)}
          className="space-y-3"
        >
          {INSIGHTS.map((insight) => (
            <motion.div
              key={insight.type}
              variants={slideUp}
              className="group bg-[#FFFFFF] dark:bg-[#0c0c0c] border border-[var(--pm-border)] dark:border-[var(--border-soft)] hover:border-[var(--border-soft)] transition-all p-5"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="shrink-0 w-8 h-8 bg-[var(--pm-surface)]/[0.03] border border-[var(--border-soft)] flex items-center justify-center">
                  <insight.icon className="w-4 h-4 text-[var(--pm-text)] dark:text-[var(--text-secondary)]" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--pm-text)] dark:text-[var(--text-secondary)]">
                      {insight.label}
                    </span>
                    <span
                      className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 ${
                        insight.confidence === 'high'
                          ? 'text-emerald-400/60 bg-emerald-400/10'
                          : 'text-amber-400/60 bg-amber-400/10'
                      }`}
                    >
                      {insight.confidence}
                    </span>
                  </div>
                  <p className="text-[12px] font-mono text-[var(--pm-text)] dark:text-[var(--text-secondary)] leading-relaxed">
                    {insight.message}
                  </p>
                </div>

                {/* Action hint */}
                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--pm-text)] dark:text-[var(--text-secondary)]" />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Sub-note */}
        <p className="text-center mt-8 text-[10px] font-mono text-[var(--pm-text)] dark:text-[var(--text-secondary)]">
          No chatbot. No essays. Just operational intelligence.
        </p>
      </div>
    </section>
  );
}
