import React from 'react';
import { useVoice, useVoiceLevels } from '../contexts/VoiceContext';
import { Channel } from '../types';
import { SpeakerIcon, PhoneIcon, MicMutedIcon, MicIcon, DeafenedIcon, MaximizeIcon } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import './VoiceCall.css'; // Reuse styles

interface ActiveVoiceOverlayProps {
    channel: Channel;
    onReturn?: () => void;
}

const ActiveVoiceOverlay: React.FC<ActiveVoiceOverlayProps> = ({ channel, onReturn }) => {
    const {
        leaveChannel,
        isMuted,
        isDeafened,
        toggleMute,
        toggleDeafen,
        connectedUsers,
    } = useVoice();
    const { speakingUsers = new Set<string>() } = useVoiceLevels() || {};
    const { user } = useAuth();

    // Initial position: bottom right corner, approximate
    const [position, setPosition] = React.useState({ x: window.innerWidth - 420, y: window.innerHeight - 150 });
    const [isDragging, setIsDragging] = React.useState(false);
    const dragStartRef = React.useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    const handleMouseMove = React.useCallback((e: MouseEvent) => {
        if (isDragging) {
            const newX = e.clientX - dragStartRef.current.x;
            const newY = e.clientY - dragStartRef.current.y;
            setPosition({ x: newX, y: newY });
        }
    }, [isDragging]);

    const handleMouseUp = React.useCallback(() => {
        setIsDragging(false);
    }, []);

    React.useEffect(() => {
        if (isDragging) {
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
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <div
            className="voice-call-container"
            style={{
                left: position.x,
                top: position.y,
                right: 'auto',
                bottom: 'auto',
                cursor: isDragging ? 'grabbing' : 'auto'
            }}
        >
            <div
                className="voice-call-header"
                onMouseDown={handleMouseDown}
                style={{ cursor: 'grab' }}
            >
                <div className="call-user-info" style={{ pointerEvents: 'none' }}>
                    <div className={`call-avatar ${user && speakingUsers.has(user._id) ? 'speaking' : ''}`}>
                        <SpeakerIcon size={24} />
                    </div>
                    <div className="call-user-details">
                        <div className="call-username">{channel.name}</div>
                        <div className="call-status">
                            {connectedUsers.length + 1} участник(ов)
                        </div>
                    </div>
                </div>
                <button
                    className="end-call-button"
                    onClick={leaveChannel}
                    title="Отключиться"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <PhoneIcon color="white" />
                </button>
            </div>

            <div className="voice-call-content" style={{ padding: '10px 20px', minHeight: 'auto' }}>
                <div className="call-controls">
                    <button
                        className={`control-button ${isMuted ? 'muted' : ''}`}
                        onClick={toggleMute}
                        title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
                    >
                        {isMuted ? <MicMutedIcon /> : <MicIcon />}
                    </button>
                    <button
                        className={`control-button ${isDeafened ? 'deafened' : ''}`}
                        onClick={toggleDeafen}
                        title={isDeafened ? 'Включить звук' : 'Выключить звук'}
                    >
                        {isDeafened ? <DeafenedIcon /> : <SpeakerIcon />}
                    </button>
                    <button
                        className="control-button return-to-chat"
                        onClick={onReturn}
                        title="Вернуться в голосовой чат"
                    >
                        <MaximizeIcon />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActiveVoiceOverlay;
