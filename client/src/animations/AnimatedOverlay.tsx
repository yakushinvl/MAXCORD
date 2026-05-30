import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  overlayVariants,
  overlayTransition,
  modalPopVariants,
  modalPopTransition,
  sheetVariants,
  heavyModalVariants,
  heavyModalTransition,
  iosSpring,
} from './transitions';
import { useFreezeAppBackground } from './useFreezeAppBackground';

type Variant = 'pop' | 'sheet' | 'fade';

interface AnimatedOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  /** Class for the inner content wrapper. Pre-existing modal classNames go here. */
  contentClassName?: string;
  /** Class for the backdrop. Defaults to "modal-overlay". */
  overlayClassName?: string;
  /** 'pop' = centered alert spring, 'sheet' = bottom sheet slide-up. */
  variant?: Variant;
  /** Close on backdrop click. Defaults to true. */
  closeOnBackdrop?: boolean;
  /** Close on Escape. Defaults to true. */
  closeOnEsc?: boolean;
  /** Render via portal to document.body. Defaults to true. */
  portal?: boolean;
  /** Optional inline style for the content wrapper. */
  contentStyle?: React.CSSProperties;
  /** Aria role for the dialog. */
  role?: string;
  children?: React.ReactNode;
}

/**
 * iOS-style overlay wrapper. Drop-in replacement for `<div className="modal-overlay">…</div>`
 * patterns scattered across modal components. Animates backdrop fade + content
 * pop/sheet via framer-motion AnimatePresence so exit transitions actually run.
 */
const AnimatedOverlay: React.FC<AnimatedOverlayProps> = ({
  isOpen,
  onClose,
  contentClassName,
  overlayClassName = 'modal-overlay',
  variant = 'pop',
  closeOnBackdrop = true,
  closeOnEsc = true,
  portal = true,
  contentStyle,
  role = 'dialog',
  children,
}) => {
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, closeOnEsc, onClose]);

  useFreezeAppBackground(isOpen);

  const contentVariants =
    variant === 'sheet' ? sheetVariants
    : variant === 'fade' ? heavyModalVariants
    : modalPopVariants;
  const contentTransition =
    variant === 'sheet' ? iosSpring
    : variant === 'fade' ? heavyModalTransition
    : modalPopTransition;

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) onClose();
  };

  const tree = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={overlayClassName}
          onMouseDown={handleBackdropMouseDown}
          role={role}
          aria-modal="true"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={overlayTransition}
        >
          <motion.div
            className={contentClassName}
            style={contentStyle}
            onMouseDown={(e) => e.stopPropagation()}
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={contentTransition}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!portal) return tree;
  return createPortal(tree, document.body);
};

export default AnimatedOverlay;
