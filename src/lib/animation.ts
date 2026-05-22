import { type Variants, type Transition } from 'motion/react';

export const fastTransition: Transition = { duration: 0.12, ease: 'easeOut' };
export const normalTransition: Transition = { duration: 0.2, ease: 'easeOut' };
export const slowTransition: Transition = { duration: 0.3, ease: 'easeOut' };

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: fastTransition },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: normalTransition },
};

export const slideIn: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: normalTransition },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: normalTransition },
};

export const stagger = (delay = 0.04): Variants => ({
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { delayChildren: delay, staggerChildren: delay } },
});

export const pulse: Variants = {
  idle: { scale: 1 },
  pulse: { scale: [1, 1.04, 1], transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } },
};

export const skeleton: Variants = {
  hidden: { opacity: 0.3 },
  visible: { opacity: [0.3, 0.6, 0.3], transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } },
};

export const overlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: fastTransition },
};

export const modal: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: normalTransition },
  exit: { opacity: 0, scale: 0.96, y: -12, transition: fastTransition },
};
