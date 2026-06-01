import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  overlayVariants,
  overlayTransition,
  modalPopVariants,
  modalPopTransition,
} from '../animations/transitions';
import { useFreezeAppBackground } from '../animations/useFreezeAppBackground';
import './ReconnectingOverlay.css';

const ReconnectingOverlay: React.FC = () => {
    useFreezeAppBackground(true);
    return createPortal(
        <motion.div
            className="reconnecting-overlay"
            variants={overlayVariants}
            initial="initial" animate="animate" exit="exit"
            transition={overlayTransition}
        >
            <motion.div
                className="reconnecting-logo-wrap"
                variants={modalPopVariants}
                initial="initial" animate="animate"
                transition={modalPopTransition}
            >
                <div className="liquid-loader">
                    <div></div>
                    <div></div>
                    <div></div>
                </div>
            </motion.div>

            <div className="loading-text-glow" style={{ marginTop: '20px' }}>ВОССТАНОВЛЕНИЕ СВЯЗИ</div>

            <div className="reconnecting-dots">
                <span></span><span></span><span></span>
            </div>

            <div className="reconnecting-subtext">
                Потеряно соединение с сервером. Пытаемся восстановить связь...
            </div>
        </motion.div>,
        document.body
    );
};

export default ReconnectingOverlay;
