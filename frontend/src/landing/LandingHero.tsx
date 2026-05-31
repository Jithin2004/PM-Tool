import { motion } from 'motion/react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { slideUp } from '../lib/animation';

interface LandingHeroProps {
  verified: boolean;
}

export function LandingHero({ verified }: LandingHeroProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Subtle top-right glow */}
      <div className="absolute -top-48 -right-48 w-96 h-96 bg-emerald-500/3 rounded-full blur-3xl" />
      <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-blue-500/2 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        {/* Logo */}
        <motion.div
          variants={slideUp}
          initial="hidden"
          animate="visible"
          className="mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-14 h-14 border border-gray-300 dark:border-white/20 bg-white/5 flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="Resolve PM" className="w-full h-full object-cover scale-110" />
            </div>
          </div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-gray-900 dark:text-white/50">Resolve PM</p>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={slideUp}
          initial="hidden"
          animate="visible"
          className="text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight text-gray-900 dark:text-white/90 leading-[1.1] mb-6"
        >
          Real-time coordination for
          <br />
          <span className="text-gray-900 dark:text-white/50">execution-focused teams</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={slideUp}
          initial="hidden"
          animate="visible"
          className="text-sm font-mono text-gray-900 dark:text-white/40 leading-relaxed max-w-xl mx-auto mb-10"
        >
          Intelligent workflows. Operational clarity. Realtime awareness.
          <br />
          Built for teams that ship.
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={slideUp}
          initial="hidden"
          animate="visible"
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          {verified ? (
            <a
              href="/workspace"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-gray-900 dark:text-white/90 border border-gray-200 dark:border-white/10 hover:bg-white/15 transition-all text-[12px] font-mono uppercase tracking-wider"
            >
              Launch Workspace
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          ) : (
            <>
              <a
                href="/activate"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-gray-900 dark:text-white/90 border border-gray-200 dark:border-white/10 hover:bg-white/15 transition-all text-[12px] font-mono uppercase tracking-wider"
              >
                Activate Product Key
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <span className="text-[10px] font-mono text-gray-900 dark:text-white/20 px-2 hidden sm:inline">or</span>
              <a
                href="/activate"
                className="inline-flex items-center gap-2 px-6 py-3 text-gray-900 dark:text-white/50 border border-white/[0.06] hover:border-white/[0.12] hover:text-gray-900 dark:text-white/70 transition-all text-[12px] font-mono uppercase tracking-wider"
              >
                Request Access
              </a>
            </>
          )}
        </motion.div>

        {/* Already Invited */}
        <motion.div
          variants={slideUp}
          initial="hidden"
          animate="visible"
          className="mt-10"
        >
          <a
            href="/login"
            className="inline-flex items-center gap-2 text-[11px] font-mono text-gray-900 dark:text-white/30 hover:text-gray-900 dark:text-white/60 transition-colors"
          >
            Already invited?
            <span className="underline underline-offset-2">Login</span>
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.6 }}
      >
        <ChevronDown className="w-4 h-4 text-gray-900 dark:text-white/20 animate-bounce" />
      </motion.div>
    </section>
  );
}
