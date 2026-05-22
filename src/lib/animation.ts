import { type Variants, type Transition } from 'motion/react';

const IS_REDUCED = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const fastTransition: Transition = IS_REDUCED ? { duration: 0 } : { duration: 0.1, ease: 'easeOut' };
export const normalTransition: Transition = IS_REDUCED ? { duration: 0 } : { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] };
export const slowTransition: Transition = IS_REDUCED ? { duration: 0 } : { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] };

export const fadeIn: Variants = {
  hidden: { opacity: IS_REDUCED ? 1 : 0 },
  visible: { opacity: 1, transition: fastTransition },
};

export const slideUp: Variants = {
  hidden: IS_REDUCED ? { opacity: 1 } : { opacity: 0, y: 6 },
  visible: IS_REDUCED ? { opacity: 1 } : { opacity: 1, y: 0, transition: normalTransition },
};

export const slideIn: Variants = {
  hidden: IS_REDUCED ? { opacity: 1 } : { opacity: 0, x: -6 },
  visible: IS_REDUCED ? { opacity: 1 } : { opacity: 1, x: 0, transition: normalTransition },
};

export const scaleIn: Variants = {
  hidden: IS_REDUCED ? { opacity: 1 } : { opacity: 0, scale: 0.97 },
  visible: IS_REDUCED ? { opacity: 1 } : { opacity: 1, scale: 1, transition: normalTransition },
};

export const stagger = (delay = 0.03): Variants => ({
  hidden: IS_REDUCED ? { opacity: 1 } : { opacity: 0, y: 4 },
  visible: IS_REDUCED ? { opacity: 1 } : { opacity: 1, y: 0, transition: { delayChildren: delay, staggerChildren: delay } },
});

export const pulse: Variants = {
  idle: { scale: 1 },
  pulse: IS_REDUCED ? { scale: 1 } : { scale: [1, 1.03, 1], transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } },
};

export const skeleton: Variants = {
  hidden: { opacity: 0.3 },
  visible: IS_REDUCED ? { opacity: 0.3 } : { opacity: [0.3, 0.55, 0.3], transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } },
};

export const overlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: fastTransition },
};

export const modal: Variants = {
  hidden: IS_REDUCED ? { opacity: 1 } : { opacity: 0, scale: 0.97, y: -8 },
  visible: IS_REDUCED ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0, transition: normalTransition },
  exit: IS_REDUCED ? { opacity: 1 } : { opacity: 0, scale: 0.97, y: -8, transition: fastTransition },
};
