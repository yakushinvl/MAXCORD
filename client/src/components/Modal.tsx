import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  overlayVariants,
  overlayTransition,
  modalPopVariants,
  modalPopTransition,
} from '../animations/transitions';
import { useFreezeAppBackground } from '../animations/useFreezeAppBackground';
import './Modal.css';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  showCloseButton?: boolean;
  footer?: React.ReactNode;
  footerAlign?: 'start' | 'end' | 'between';
  children?: React.ReactNode;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEsc = true,
  showCloseButton = true,
  footer,
  footerAlign = 'end',
  children,
  className = '',
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeOnEsc, onClose]);

  useFreezeAppBackground(open);

  useEffect(() => {
    if (open && contentRef.current) {
      const focusable = contentRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }
  }, [open]);

  const onBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) onClose();
  };

  const footerClass =
    footerAlign === 'start'
      ? 'zv-modal__footer zv-modal__footer--start'
      : footerAlign === 'between'
      ? 'zv-modal__footer zv-modal__footer--between'
      : 'zv-modal__footer';

  // Portal to <body> so the fixed-positioned overlay isn't trapped inside an
  // ancestor that has a transform/filter (which would create a containing block
  // and confine `position: fixed`). framer-motion keeps inline `transform` on
  // every motion.div in the tree, so this matters.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="zv-modal-overlay"
          onMouseDown={onBackdropClick}
          role="dialog"
          aria-modal="true"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={overlayTransition}
        >
          <motion.div
            ref={contentRef}
            className={`zv-modal zv-modal--${size} ${className}`}
            onMouseDown={(e) => e.stopPropagation()}
            variants={modalPopVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={modalPopTransition}
          >
            {(title || showCloseButton) && (
              <header className="zv-modal__header">
                <div>
                  {title && <h2 className="zv-modal__title">{title}</h2>}
                  {subtitle && <div className="zv-modal__subtitle">{subtitle}</div>}
                </div>
                {showCloseButton && (
                  <button
                    type="button"
                    className="zv-modal__close"
                    onClick={onClose}
                    aria-label="Закрыть"
                  >
                    ×
                  </button>
                )}
              </header>
            )}
            <div className="zv-modal__body">{children}</div>
            {footer && <footer className={footerClass}>{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default Modal;
