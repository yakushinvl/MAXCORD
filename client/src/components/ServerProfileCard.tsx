import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Server } from '../types';
import { getAvatarUrl } from '../utils/avatar';
import { useDialog } from '../contexts/DialogContext';
import { CloseIcon } from './Icons';
import UserBadges from './UserBadges';
import './ServerProfileCard.css';


interface ServerProfileCardProps {
    server: Server;
    onClose: () => void;
    onLeave: (serverId: string) => void;
    position?: { x: number, y: number } | null;
    onUserClick?: (userId: string, event?: React.MouseEvent) => void;
}

const ServerProfileCard: React.FC<ServerProfileCardProps> = ({ server, onClose, onLeave, position, onUserClick }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const { confirm, alert } = useDialog();
    const [adjustedPos, setAdjustedPos] = useState({ top: position?.y || 0, left: (position?.x || 0) + 20 });
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!position || !cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        let finalX = position.x + 20;
        let finalY = position.y;

        if (finalX + rect.width > window.innerWidth) {
            finalX = position.x - rect.width - 20;
        }

        if (finalY + rect.height > window.innerHeight) {
            finalY = position.y - rect.height;
        }

        if (finalY + rect.height > window.innerHeight) finalY = window.innerHeight - rect.height - 10;
        if (finalY < 10) finalY = 10;
        if (finalX < 10) finalX = 10;
        if (finalX + rect.width > window.innerWidth) finalX = window.innerWidth - rect.width - 10;

        setAdjustedPos({ top: finalY, left: finalX });
        setIsVisible(true);
    }, [position]);
    const handleLeave = async () => {
        if (await confirm(`Вы уверены, что хотите покинуть сервер "${server.name}"?`)) {
            try {
                await axios.post(`/api/servers/${server._id}/leave`);
                onLeave(server._id);
                onClose();
            } catch (err) {
                await alert('Не удалось покинуть сервер');
            }
        }
    };

    return (
        <div className={`server-profile-overlay ${position ? 'transparent' : ''}`} onClick={onClose}>
            <div
                className={`server-profile-card ${position ? 'popout' : ''}`}
                onClick={e => e.stopPropagation()}
                style={position ? {
                    position: 'absolute',
                    top: adjustedPos.top,
                    left: adjustedPos.left,
                    visibility: isVisible ? 'visible' : 'hidden',
                    opacity: isVisible ? 1 : 0
                } : undefined}
                ref={cardRef}
            >
                <div
                    className="server-profile-banner"
                    style={{
                        backgroundColor: server.bannerColor || '#5865f2',
                        backgroundImage: server.banner ? `url(${getAvatarUrl(server.banner)})` : 'none'
                    }}
                >
                    <button className="server-profile-close" onClick={onClose}>
                        <CloseIcon />
                    </button>
                </div>

                <div className="server-profile-header">
                    <div className="server-profile-icon-container">
                        <div className="server-profile-icon">
                            {server.icon ? (
                                <img src={getAvatarUrl(server.icon)!} alt={server.name} />
                            ) : (
                                <span>{server.name.charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="server-profile-body">
                    <span className="server-profile-name">{server.name}</span>

                    <div className="server-profile-divider"></div>

                    <div className="server-profile-section">
                        <h4>О ПАБЛИКЕ</h4>
                        <p>{server.description || 'Описание отсутствует.'}</p>
                    </div>

                    <div className="server-profile-stats">
                        <div className="stat-item">
                            <span className="stat-value">{server.members.length}</span>
                            <span className="stat-label">Участников</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">
                                {new Date(server.createdAt).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })}
                            </span>
                            <span className="stat-label">Создан</span>
                        </div>
                    </div>

                    <div className="server-profile-divider"></div>

                    <div className="server-profile-section">
                        <h4>ВЛАДЕЛЕЦ</h4>
                        <div className="owner-info" onClick={(e) => typeof server.owner === 'object' && onUserClick?.((server.owner as any)._id, e)} style={{ cursor: 'pointer' }}>
                            {typeof server.owner === 'object' && (
                                <>
                                    <img
                                        src={getAvatarUrl((server.owner as any).avatar) || ''}
                                        alt=""
                                        className="owner-avatar"
                                    />
                                    <div className="owner-name-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>
                                            {(server.owner as any).username}
                                        </span>
                                        <UserBadges badges={(server.owner as any).badges} size={14} />
                                    </div>

                                </>
                            )}
                        </div>
                    </div>

                    <div className="server-profile-divider"></div>

                    <div className="server-profile-actions">
                        <button className="leave-server-btn" onClick={handleLeave}>
                            Покинуть сервер
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServerProfileCard;
