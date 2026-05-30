import type { Transition, Variants } from 'framer-motion';

// iOS-style spring presets. Tuned to feel like UIKit's default navigation/sheet springs.
export const iosSpring: Transition = {
  type: 'spring',
  stiffness: 360,
  damping: 34,
  mass: 0.9,
};

export const iosSpringSoft: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 30,
  mass: 0.95,
};

export const iosSpringSnappy: Transition = {
  type: 'spring',
  stiffness: 480,
  damping: 38,
  mass: 0.7,
};

// Quick fade-tween for fast inner swaps where spring would feel laggy.
export const iosFade: Transition = {
  type: 'tween',
  ease: [0.32, 0.72, 0, 1], // iOS easing curve
  duration: 0.28,
};

// Horizontal push (used between auth pages and Home — like a UINavigationController push).
export const pagePushVariants: Variants = {
  initial: { opacity: 0, x: '6%', scale: 0.985 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit:    { opacity: 0, x: '-3%', scale: 0.985 },
};

// Cross-fade + subtle scale (used for sibling routes without clear push/pop semantic).
export const pageFadeVariants: Variants = {
  initial: { opacity: 0, scale: 0.985 },
  animate: { opacity: 1, scale: 1 },
  exit:    { opacity: 0, scale: 1.005 },
};

// Sidebar swap (ServerSidebar ↔ DMSidebar): horizontal slide based on direction.
export const sidebarSwapVariants: Variants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  animate: { opacity: 1, x: 0 },
  exit:    (dir: number) => ({ opacity: 0, x: dir * -16 }),
};

// Content swap inside Main (Friends / Channel / Voice / DM / Empty).
export const contentSwapVariants: Variants = {
  initial: { opacity: 0, y: 8, scale: 0.992 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit:    { opacity: 0, y: -4, scale: 0.998 },
};

// Inner key-change (channel/DM id swap inside the same section).
export const innerKeyVariants: Variants = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -8 },
};

// Backdrop fade for modal/sheet overlays.
export const overlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
};

export const overlayTransition: Transition = {
  type: 'tween',
  ease: [0.32, 0.72, 0, 1],
  duration: 0.22,
};

// Centered modal pop-in (iOS alert style — quick, slightly overshooting spring).
export const modalPopVariants: Variants = {
  initial: { opacity: 0, scale: 0.92, y: 12 },
  animate: { opacity: 1, scale: 1,    y: 0  },
  exit:    { opacity: 0, scale: 0.96, y: 6  },
};

export const modalPopTransition: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.85,
};

// Sheet slide-up from bottom (iOS half-sheet / action sheet style).
export const sheetVariants: Variants = {
  initial: { opacity: 0, y: '8%',  scale: 0.98 },
  animate: { opacity: 1, y: 0,     scale: 1    },
  exit:    { opacity: 0, y: '6%',  scale: 0.99 },
};

// Fade-only variant for big modals with heavy backdrop-filter (settings, etc.)
// Avoids transform/scale that would cause backdrop-filter to re-rasterize each
// frame and visibly ripple the underlying animated background.
export const heavyModalVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
};

export const heavyModalTransition: Transition = {
  type: 'tween',
  ease: [0.32, 0.72, 0, 1],
  duration: 0.26,
};

// Popover scale-from-anchor (context menus, profile cards).
export const popoverVariants: Variants = {
  initial: { opacity: 0, scale: 0.94 },
  animate: { opacity: 1, scale: 1    },
  exit:    { opacity: 0, scale: 0.96 },
};

export const popoverTransition: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 36,
  mass: 0.7,
};
