import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MiniApp } from '../types';
import { CloseIcon, MaximizeIcon, LayoutGridIcon, MonitorIcon } from './Icons';
import './MiniAppWindow.css';

interface MiniAppWindowProps {
    app: MiniApp;
    onClose: (appId: string) => void;
}

const MiniAppWindow: React.FC<MiniAppWindowProps> = ({ app, onClose }) => {
    const [position, setPosition] = useState({ x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 });
    const [size, setSize] = useState({ width: 800, height: 600 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

    // Ensure URL is absolute
    const getAbsoluteUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `https://${url}`;
    };

    const absoluteUrl = getAbsoluteUrl(app.url);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    const handleResizeDown = (e: React.MouseEvent, direction: string) => {
        e.stopPropagation();
        setIsResizing(direction);
        resizeStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            w: size.width,
            h: size.height
        };
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStartRef.current.x,
                y: e.clientY - dragStartRef.current.y
            });
        } else if (isResizing) {
            const dx = e.clientX - resizeStartRef.current.x;
            const dy = e.clientY - resizeStartRef.current.y;
            
            let newW = resizeStartRef.current.w;
            let newH = resizeStartRef.current.h;

            if (isResizing.includes('right')) newW = Math.max(400, resizeStartRef.current.w + dx);
            if (isResizing.includes('bottom')) newH = Math.max(300, resizeStartRef.current.h + dy);
            
            setSize({ width: newW, height: newH });
        }
    }, [isDragging, isResizing]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setIsResizing(null);
    }, []);

    useEffect(() => {
        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (isLoading) {
                // Keep loading but show a hint that it might be blocked
            }
        }, 5000);
        return () => clearTimeout(timer);
    }, [isLoading]);

    return (
        <div 
            className="miniapp-window"
            style={{
                left: position.x,
                top: position.y,
                width: size.width,
                height: size.height,
                zIndex: isDragging || isResizing ? 9001 : 9000
            }}
        >
            <div className="miniapp-header" onMouseDown={handleMouseDown}>
                <div className="header-info">
                    <LayoutGridIcon size={16} color="var(--primary-neon)" />
                    <span>{app.name}</span>
                </div>
                <div className="header-actions">
                    <a 
                        href={absoluteUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="header-btn"
                        title="Открыть в новой вкладке"
                        onMouseDown={e => e.stopPropagation()}
                    >
                        <MaximizeIcon size={16} />
                    </a>
                    <button className="header-btn" onClick={() => onClose(app._id)} onMouseDown={e => e.stopPropagation()}>
                        <CloseIcon size={18} />
                    </button>
                </div>
            </div>
            <div className="miniapp-content" style={{ position: 'relative' }}>
                {isLoading && (
                    <div className="miniapp-loading">
                        <div className="loading-spinner-rings"><div></div><div></div><div></div><div></div></div>
                        <div className="loading-hint" style={{ marginTop: '60px', textAlign: 'center', padding: '0 20px', color: 'var(--text-dim)', fontSize: '13px' }}>
                            Если сайт долго не загружается, возможно, он запрещает встраивание. <br/>
                            Попробуйте открыть его в новой вкладке через кнопку сверху.
                        </div>
                    </div>
                )}
                <iframe 
                    src={absoluteUrl} 
                    title={app.name}
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    onLoad={() => setIsLoading(false)}
                    allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb"
                    style={{ pointerEvents: isDragging || isResizing ? 'none' : 'auto', background: 'white' }}
                />
            </div>
            {/* Resize Handles */}
            <div className="resize-handle right" onMouseDown={(e) => handleResizeDown(e, 'right')} />
            <div className="resize-handle bottom" onMouseDown={(e) => handleResizeDown(e, 'bottom')} />
            <div className="resize-handle bottom-right" onMouseDown={(e) => handleResizeDown(e, 'bottom-right')} />
        </div>
    );
};

export default MiniAppWindow;
