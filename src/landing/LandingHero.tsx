import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, ChevronDown, Shield } from 'lucide-react';
import { fadeIn, slideUp } from '../lib/animation';

interface LandingHeroProps {
  verified: boolean;
}

export function LandingHero({ verified }: LandingHeroProps) {
  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 500], [0, 120]);
  const opacity = useTransform(scrollY, [0, 400], [1, 0]);

  return (
    <motion.section
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ opacity }}
    >
      {/* Grid background */}
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
          backgroundSize: '48px 48px',
          y: bgY,
        }}
      />

      {/* Subtle top-right glow */}
      <div className="absolute -top-48 -right-48 w-96 h-96 bg-emerald-500/3 rounded-full blur-3xl" />
      <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-blue-500/2 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        {/* Badge */}
        <motion.div
          variants={slideUp}
          initial="hidden"
          animate="visible"
          className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/[0.06] bg-white/[0.02] mb-8"
        >
          <Shield className="w-3 h-3 text-white/40" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Operational Command System</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={slideUp}
          initial="hidden"
          animate="visible"
          className="text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight text-white/90 leading-[1.1] mb-6"
        >
          Real-time coordination for
          <br />
          <span className="text-white/50">execution-focused teams</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={slideUp}
          initial="hidden"
          animate="visible"
          className="text-sm font-mono text-white/40 leading-relaxed max-w-xl mx-auto mb-10"
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
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white/90 border border-white/10 hover:bg-white/15 transition-all text-[12px] font-mono uppercase tracking-wider"
            >
              Launch Workspace
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          ) : (
            <>
              <a
                href="/activate"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white/90 border border-white/10 hover:bg-white/15 transition-all text-[12px] font-mono uppercase tracking-wider"
              >
                Activate Product Key
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <span className="text-[10px] font-mono text-white/20 px-2 hidden sm:inline">or</span>
              <a
                href="/activate"
                className="inline-flex items-center gap-2 px-6 py-3 text-white/50 border border-white/[0.06] hover:border-white/[0.12] hover:text-white/70 transition-all text-[12px] font-mono uppercase tracking-wider"
              >
                Request Access
              </a>
            </>
          )}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.6 }}
      >
        <ChevronDown className="w-4 h-4 text-white/20 animate-bounce" />
      </motion.div>
    </motion.section>
  );
}
