import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useVoice } from '../contexts/VoiceContext';
import { MicIcon, MicMutedIcon, DeafenedIcon, SpeakerIcon, PhoneIcon, ScreenShareIcon, StopScreenShareIcon, VideoIcon, CameraIcon } from './Icons';
import ScreenSourceSelector from './ScreenSourceSelector';
import { ConnectionState } from 'livekit-client';
import './VoiceControlPanel.css';

const VoiceControlPanel: React.FC = () => {
    const {
        activeChannelId,
        isMuted,
        toggleMute,
        isDeafened,
        toggleDeafen,
        leaveChannel,
        isScreenSharing,
        startScreenShare,
        stopScreenShare,
        ping,
        connectionQuality,
        roomConnectionState,
        isVideoOn,
        toggleVideo
    } = useVoice();

    const [showSourceSelector, setShowSourceSelector] = React.useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    if (!activeChannelId) return null;

    const getConnectionQualityText = (quality: string) => {
        switch (quality) {
            case 'excellent': return 'Отличное';
            case 'good': return 'Хорошее';
            case 'poor': return 'Низкое';
            case 'lost': return 'Потеряно';
            default: return 'Ожидание...';
        }
    };

    const handleShareClick = () => {
        if (isScreenSharing) {
            stopScreenShare();
        } else {
            setShowSourceSelector(true);
        }
    };

    const handleSourceSelect = (sourceId: string, options: { resolution: string, frameRate: string, videoCodec: 'av1' | 'vp9' | 'h264' }) => {
        startScreenShare(sourceId, options);
        setShowSourceSelector(false);
    };

    return (
        <div className="voice-control-panel glass-panel-base">
            <div className="voice-info">
                <div 
                    className={`voice-status-indicator ${roomConnectionState === ConnectionState.Connecting || roomConnectionState === ConnectionState.Reconnecting ? 'connecting' : ''}`}
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                >
                    <div className="pulse-ring"></div>
                    <div className="voice-status-dot"></div>
                    
                    {showTooltip && (
                        <div className="voice-connection-tooltip glass-panel-base">
                            <div className="tooltip-header">
                                <div className="tooltip-header-dot"></div>
                                <span>Статус соединения</span>
                            </div>
                            <div className="tooltip-content">
                                <div className="tooltip-row">
                                    <span className="label">Задержка</span>
                                    <span className="value">{ping} мс</span>
                                </div>
                                <div className="tooltip-row">
                                    <span className="label">Качество</span>
                                    <span className={`value quality-${connectionQuality}`}>
                                        {getConnectionQualityText(connectionQuality)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="voice-details">
                    <span className={`voice-connection-status ${roomConnectionState === ConnectionState.Connecting || roomConnectionState === ConnectionState.Reconnecting ? 'connecting' : ''}`}>
                        {roomConnectionState === ConnectionState.Connecting ? 'Подключение...' : 
                         roomConnectionState === ConnectionState.Reconnecting ? 'Переподключение...' : 
                         'Голосовая связь'}
                    </span>
                    <span className={`voice-channel-name ${roomConnectionState === ConnectionState.Connecting || roomConnectionState === ConnectionState.Reconnecting ? 'connecting' : ''}`}>
                        {roomConnectionState === ConnectionState.Connecting ? 'Соединение' : 
                         roomConnectionState === ConnectionState.Reconnecting ? 'Восстановление' : 
                         'Подключено'}
                    </span>
                </div>
                <button className="voice-disconnect-btn" onClick={leaveChannel} title="Отключиться">
                    <PhoneIcon size={20} color="#ff4d4d" />
                </button>
            </div>

            <div className="voice-actions">
                <button
                    className={`voice-action-btn ${isMuted ? 'active' : ''}`}
                    onClick={toggleMute}
                    title={isMuted ? "Включить микрофон" : "Выключить микрофон"}
                >
                    {isMuted ? <MicMutedIcon size={20} color="#ff4d4d" /> : <MicIcon size={20} />}
                </button>
                <button
                    className={`voice-action-btn ${isDeafened ? 'active' : ''}`}
                    onClick={toggleDeafen}
                    title={isDeafened ? "Включить звук" : "Выключить звук"}
                >
                    {isDeafened ? <DeafenedIcon size={20} color="#ff4d4d" /> : <SpeakerIcon size={20} />}
                </button>
                <button
                    className={`voice-action-btn ${isVideoOn ? 'active' : ''}`}
                    onClick={toggleVideo}
                    title={isVideoOn ? "Выключить камеру" : "Включить камеру"}
                >
                    {isVideoOn ? <VideoIcon size={20} color="var(--primary-neon)" /> : <CameraIcon size={20} />}
                </button>
                <button
                    className={`voice-action-btn ${isScreenSharing ? 'sharing' : ''}`}
                    onClick={handleShareClick}
                    title={isScreenSharing ? "Остановить стрим" : "Начать стрим"}
                >
                    {isScreenSharing ? <StopScreenShareIcon size={20} color="var(--primary-neon)" /> : <ScreenShareIcon size={20} />}
                </button>
            </div>

            {showSourceSelector && createPortal(
                <ScreenSourceSelector
                    onSelect={handleSourceSelect}
                    onClose={() => setShowSourceSelector(false)}
                />,
                document.body
            )}
        </div>
    );
};

export default VoiceControlPanel;
