import React, { useEffect, useState, useRef } from 'react';
import './Overlay.css';

interface OverlayUser {
    id: string;
    username: string;
    avatar?: string;
    isSpeaking: boolean;
    isMuted?: boolean;
    isDeafened?: boolean;
}

const StaticAvatar: React.FC<{ src: string; isSpeaking: boolean; className?: string }> = ({ src, isSpeaking, className }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const isGif = src.includes('.gif') || src.includes('.GIF');

    useEffect(() => {
        if (isGif && !isSpeaking && canvasRef.current && imgRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            const img = imgRef.current;
            
            const captureFrame = () => {
                if (img.complete && img.naturalWidth > 0) {
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    ctx?.drawImage(img, 0, 0);
                }
            };

            if (img.complete) captureFrame();
            else img.onload = captureFrame;
        }
    }, [src, isSpeaking, isGif]);

    if (!isGif) return <img src={src} alt="" className={className} />;

    return (
        <>
            <img 
                ref={imgRef} 
                src={src} 
                alt="" 
                className={className} 
                style={{ display: isSpeaking ? 'block' : 'none' }} 
            />
            {!isSpeaking && (
                <canvas 
                    ref={canvasRef} 
                    className={className}
                    style={{ display: 'block' }}
                />
            )}
        </>
    );
};

const Overlay: React.FC = () => {
    const [users, setUsers] = useState<OverlayUser[]>([]);
    const [channelName, setChannelName] = useState<string>('');
    const [isGameRunning, setIsGameRunning] = useState(false);
    const [showIntro, setShowIntro] = useState(false);
    const [config, setConfig] = useState(() => ({
        opacity: Number(localStorage.getItem('overlayOpacity')) || 1.0,
        size: Number(localStorage.getItem('overlaySize')) || 1.0,
        position: localStorage.getItem('overlayPosition') || 'top-left'
    }));

    useEffect(() => {
        // @ts-ignore
        const electron = window.electron;
        if (!electron || !electron.ipc) return;

        const removeListener = electron.ipc.on('overlay-data', (_event: any, data: any) => {
            console.log('[Overlay] Received data:', data);
            if (data.users) setUsers(data.users);
            if (data.channelName) setChannelName(data.channelName);
        });

        const removeConfigListener = electron.ipc.on('overlay-config', (_event: any, newConfig: any) => {
            setConfig(newConfig);
        });

        const removeActivityListener = electron.ipc.on('activity-changed', (_event: any, activity: any) => {
            setIsGameRunning(!!activity);
        });

        electron.ipc.invoke('get-current-activity').then((activity: any) => {
            setIsGameRunning(!!activity);
        });

        // Request initial data if needed? 
        // Or just wait for the next periodic update from the main window.

        return () => {
            if (removeListener) removeListener();
            if (removeActivityListener) removeActivityListener();
            if (removeConfigListener) removeConfigListener();
        };
    }, []);

    useEffect(() => {
        if (isGameRunning) {
            setShowIntro(true);
            const t = setTimeout(() => setShowIntro(false), 5000);
            return () => clearTimeout(t);
        } else {
            setShowIntro(false);
        }
    }, [isGameRunning]);

    // Filter to show only speaking users OR all users if configured?
    // Discord usually shows only speaking users unless "always show" is on.
    // Let's show all users for now but highlight speaking ones.
    
    if (!isGameRunning) return null;
    if (users.length === 0 && !showIntro) return null;

    return (
        <div 
            className="overlay-container" 
            style={{ 
                opacity: config.opacity, 
                transform: `scale(${config.size})`,
                transformOrigin: `${config.position.includes('top') ? 'top' : config.position.includes('middle') ? 'center' : 'bottom'} ${config.position.includes('left') ? 'left' : 'right'}`,
                justifyContent: config.position.includes('middle') ? 'center' : 'flex-start'
            }}
        >
            {users.length === 0 && showIntro && (
                <div style={{ 
                    background: 'rgba(0,0,0,0.6)', 
                    padding: '8px 16px', 
                    borderRadius: '8px', 
                    color: 'white', 
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontSize: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    width: 'fit-content'
                }}>
                    MAXCORD Оверлей запущен
                </div>
            )}
            {users.length > 0 && (
                <div className="overlay-user-list">
                    {users.map(user => (

                    <div key={user.id} className={`overlay-user-item ${user.isSpeaking ? 'speaking' : ''}`}>
                        <div className="overlay-avatar-wrapper">
                            {user.avatar ? (
                                <StaticAvatar 
                                    src={user.avatar} 
                                    isSpeaking={user.isSpeaking} 
                                    className="overlay-avatar" 
                                />
                            ) : (
                                <div className="overlay-avatar-placeholder">
                                    {user.username.charAt(0).toUpperCase()}
                                </div>
                            )}
                            {user.isSpeaking && <div className="overlay-speaking-ring" />}
                        </div>
                        <span className="overlay-username">{user.username}</span>
                        <div className="overlay-user-status">
                            {user.isDeafened ? (
                                <div className="status-icon deafened" />
                            ) : user.isMuted ? (
                                <div className="status-icon muted" />
                            ) : null}
                        </div>
                    </div>
                ))}
                </div>
            )}
        </div>
    );
};


export default Overlay;
