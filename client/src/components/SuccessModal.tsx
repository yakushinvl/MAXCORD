import React from 'react';
import AnimatedOverlay from '../animations/AnimatedOverlay';
import './SuccessModal.css';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, onClose, title, message }) => {
  return (
    <AnimatedOverlay
      isOpen={isOpen}
      onClose={onClose}
      overlayClassName="modal-overlay success-overlay"
      contentClassName="glass-panel-base success-modal-content"
      contentStyle={{ zIndex: 6000 }}
    >
      <div className="success-checkmark-wrapper">
        <div className="success-checkmark">
          <div className="check-icon">
            <span className="icon-line line-tip"></span>
            <span className="icon-line line-long"></span>
            <div className="icon-circle"></div>
            <div className="icon-fix"></div>
          </div>
        </div>
      </div>

      <h2 className="success-title">{title}</h2>
      <p className="success-message">{message}</p>

      <button className="neon-btn success-btn" onClick={onClose}>
        Продолжить
      </button>
    </AnimatedOverlay>
  );
};

export default SuccessModal;
