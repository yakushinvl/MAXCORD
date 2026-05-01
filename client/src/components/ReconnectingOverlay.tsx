import React from 'react';
import { createPortal } from 'react-dom';
import './ReconnectingOverlay.css';

const ReconnectingOverlay: React.FC = () => {
    return createPortal(
        <div className="reconnecting-overlay">
            <div className="reconnecting-logo-wrap">
                <svg viewBox="0 0 100 100" className="z-logo-svg">
                    {/* Z Top Left */}
                    <rect className="z-part z-top-left" x="20" y="20" width="30" height="12" rx="4" fill="var(--primary-neon)" />
                    {/* Z Top Right */}
                    <rect className="z-part z-top-right" x="50" y="20" width="30" height="12" rx="4" fill="var(--primary-neon)" />
                    
                    {/* Z Diagonal (Main) */}
                    <path className="z-part z-mid" d="M75 32 L30 80 L20 80 L20 68 L65 20 Z" fill="var(--primary-neon)" />
                    
                    {/* Z Bottom Left */}
                    <rect className="z-part z-bot-left" x="20" y="68" width="30" height="12" rx="4" fill="var(--primary-neon)" />
                    {/* Z Bottom Right */}
                    <rect className="z-part z-bot-right" x="50" y="68" width="30" height="12" rx="4" fill="var(--primary-neon)" />
                </svg>
            </div>
            
            <div className="reconnecting-text">ПОДКЛЮЧЕНИЕ</div>
            
            <div className="reconnecting-dots">
                <span></span><span></span><span></span>
            </div>
            
            <div className="reconnecting-subtext">
                Потеряно соединение с сервером. Пытаемся восстановить связь...
            </div>
        </div>,
        document.body
    );
};

export default ReconnectingOverlay;
