import { motion } from 'motion/react';
import { ArrowRight, Shield, ArrowUpRight, Monitor } from 'lucide-react';
import { slideUp, stagger } from '../lib/animation';

interface AccessGatewayProps {
  verified: boolean;
}

export function AccessGateway({ verified }: AccessGatewayProps) {
  return (
    <section className="py-32 px-6 border-t border-[var(--border-soft)]">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger(0.06)}
        >
          <motion.div variants={slideUp} className="inline-flex items-center gap-2 px-3 py-1.5 border border-[var(--border-soft)] bg-[var(--pm-surface)]/[0.02] mb-8">
            <Shield className="w-3 h-3 text-[var(--pm-text)] dark:text-[var(--text-secondary)]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text)] dark:text-[var(--text-secondary)]">Get Started</span>
          </motion.div>

          <motion.h2 variants={slideUp} className="text-2xl sm:text-3xl font-medium tracking-tight text-[var(--pm-text)] dark:text-[var(--text-secondary)] mb-4">
            Ready to take control
          </motion.h2>

          <motion.p variants={slideUp} className="text-sm font-mono text-[var(--pm-text)] dark:text-[var(--text-secondary)] leading-relaxed mb-10 max-w-md mx-auto">
            Activate your product key to unlock the full operational command system.
          </motion.p>

          <motion.div variants={slideUp} className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {verified ? (
              <a
                href="/workspace"
                className="inline-flex items-center gap-2.5 px-6 py-3 bg-[var(--pm-surface)]/10 text-[var(--pm-text)] dark:text-[var(--text-secondary)] border border-[var(--pm-border)] dark:border-[var(--border-soft)] hover:bg-[var(--pm-surface)]/15 transition-all text-[12px] font-mono uppercase tracking-wider"
              >
                <Monitor className="w-3.5 h-3.5" />
                Launch Workspace
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            ) : (
              <>
                <a
                  href="/activate-license"
                  className="inline-flex items-center gap-2.5 px-6 py-3 bg-[var(--pm-surface)]/10 text-[var(--pm-text)] dark:text-[var(--text-secondary)] border border-[var(--pm-border)] dark:border-[var(--border-soft)] hover:bg-[var(--pm-surface)]/15 transition-all text-[12px] font-mono uppercase tracking-wider"
                >
                  <Shield className="w-3.5 h-3.5" />
                  Activate Product Key
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
                <a
                  href="/activate-license"
                  className="inline-flex items-center gap-2.5 px-6 py-3 text-[var(--pm-text)] dark:text-[var(--text-secondary)] border border-[var(--border-soft)] hover:border-[var(--border-soft)] hover:text-[var(--pm-text)] dark:text-[var(--text-secondary)] transition-all text-[12px] font-mono uppercase tracking-wider"
                >
                  Request Demo
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </>
            )}
          </motion.div>

          <motion.p variants={slideUp} className="mt-10 text-[9px] font-mono uppercase tracking-wider text-[var(--pm-text)] dark:text-[var(--text-secondary)]">
            Resolve PM &middot; Operational Command System
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
