import React from 'react';
import { MiniApp } from '../types';
import MiniAppWindow from './MiniAppWindow';

interface MiniAppContainerProps {
    openApps: MiniApp[];
    onClose: (appId: string) => void;
}

const MiniAppContainer: React.FC<MiniAppContainerProps> = ({ openApps, onClose }) => {
    return (
        <div className="miniapp-container" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9000 }}>
            {openApps.map(app => (
                <div key={app._id} style={{ pointerEvents: 'auto' }}>
                    <MiniAppWindow app={app} onClose={onClose} />
                </div>
            ))}
        </div>
    );
};

export default MiniAppContainer;
