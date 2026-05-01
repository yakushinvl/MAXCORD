import React, { useState, useRef, useEffect } from 'react';
import { getAvatarUrl } from '../utils/avatar';
import { useAuth } from '../contexts/AuthContext';
import './UserAvatar.css';

interface UserAvatarProps {
    user: {
        _id?: string;
        username?: string;
        avatar?: string | null;
        [key: string]: any;
    } | null | undefined;
    size?: number;
    animate?: boolean; // Force animation (e.g., in voice chat)
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
    user,
    size = 40,
    animate = false,
    className = '',
    onClick,
    onContextMenu
}) => {
    const { globalUsers } = useAuth();
    const [isHovered, setIsHovered] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // Get the most up-to-date user data from global cache if available
    const activeUser = (user?._id && globalUsers[user._id]) ? { ...user, ...globalUsers[user._id] } : user;
    
    const avatarUrl = getAvatarUrl(activeUser?.avatar);
    const username = activeUser?.username || '?';
    const firstLetter = username.charAt(0).toUpperCase();

    // Check if it's a GIF synchronously to ensure canvas is rendered
    const isGif = !!avatarUrl && (
        avatarUrl.toLowerCase().endsWith('.gif') ||
        avatarUrl.toLowerCase().includes('.gif?')
    );

    useEffect(() => {
        if (!avatarUrl || !isGif) return;

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = avatarUrl;
        img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = size;
            canvas.height = size;

            // Draw with "cover" logic to avoid stretching/zooming
            const imgAspect = img.width / img.height;
            const canvasAspect = 1; // since size/size
            let drawWidth, drawHeight, offsetX, offsetY;

            if (imgAspect > canvasAspect) {
                drawHeight = size;
                drawWidth = size * imgAspect;
                offsetX = -(drawWidth - size) / 2;
                offsetY = 0;
            } else {
                drawWidth = size;
                drawHeight = size / imgAspect;
                offsetX = 0;
                offsetY = -(drawHeight - size) / 2;
            }

            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            setIsLoaded(true);
        };
    }, [avatarUrl, size, isGif]);

    if (!avatarUrl) {
        const isGroup = user === null;
        return (
            <div
                className={`avatar-placeholder ${className} ${isGroup ? 'group-avatar' : ''}`}
                style={{ width: size, height: size, fontSize: size * 0.45 }}
                onClick={onClick}
                onContextMenu={onContextMenu}
            >
                {isGroup ? (
                    <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                ) : firstLetter}
            </div>
        );
    }

    const showAnimation = animate || isHovered;

    return (
        <div
            className={`user-avatar-container ${className}`}
            style={{ width: size, height: size }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
            onContextMenu={onContextMenu}
        >
            {/* Real Animated Image */}
            <img
                ref={imgRef}
                src={avatarUrl}
                alt={username}
                className={`avatar-img ${showAnimation || !isGif ? 'visible' : 'hidden'}`}
                style={{ width: size, height: size }}
                onLoad={() => !isGif && setIsLoaded(true)}
            />

            {/* Static Frame Canvas (for GIFs when not hovered/voice) */}
            {isGif && (
                <canvas
                    ref={canvasRef}
                    className={`avatar-static-canvas ${isLoaded && !showAnimation ? 'visible' : 'hidden'}`}
                    style={{ width: size, height: size }}
                />
            )}

            {/* Simple placeholder while loading (only when not animating) */}
            {!isLoaded && isGif && !showAnimation && (
                <div className="avatar-loading-placeholder" style={{ width: size, height: size, position: 'absolute' }} />
            )}
        </div>
    );
};

export default UserAvatar;
