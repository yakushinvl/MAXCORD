import React from 'react';
import { MotionConfig } from 'framer-motion';
import { useAppearance } from '../contexts/AppearanceContext';

/**
 * Wraps children in a framer-motion `MotionConfig` that respects:
 *   1. The system-level `prefers-reduced-motion` media query.
 *   2. The user-toggled `performanceMode` flag from AppearanceContext.
 *
 * When either is active, framer-motion short-circuits transitions to their
 * final state — no springs, no tweens, no exit-anim delays. This trades the
 * iOS feel for CPU/GPU headroom on low-end hardware and respects users with
 * vestibular sensitivities.
 *
 * The `data-reduce-motion` attribute on <body> additionally lets us scope CSS
 * rules (e.g. disable backdrop-filter animations) without prop-drilling.
 */
const MotionPreferences: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { performanceMode } = useAppearance();

  React.useEffect(() => {
    const root = document.body;
    if (performanceMode) root.dataset.reduceMotion = 'force';
    else delete root.dataset.reduceMotion;
    return () => { delete root.dataset.reduceMotion; };
  }, [performanceMode]);

  // "user" honors the OS-level media query. When perfMode is on we override to
  // "always" which forces reduced motion regardless of system setting.
  const reducedMotion = performanceMode ? 'always' : 'user';

  return <MotionConfig reducedMotion={reducedMotion}>{children}</MotionConfig>;
};

export default MotionPreferences;
