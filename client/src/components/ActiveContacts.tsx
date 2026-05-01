import React from 'react';
import { User } from '../types';
import UserAvatar from './UserAvatar';
import { getFullUrl } from '../utils/avatar';
import './ActiveContacts.css';

interface ActiveContactsProps {
    friends: User[];
    onUserClick: (userId: string, event?: React.MouseEvent) => void;
}

const ActiveContacts: React.FC<ActiveContactsProps> = ({ friends, onUserClick }) => {
    // Filter friends who have an active activity
    const activeFriends = friends.filter(f => f.activity && (f.activity.name || f.activity.details));

    if (activeFriends.length === 0) {
        return (
            <div className="active-contacts-sidebar empty">
                <h3 className="section-title">Активные контакты</h3>
                <div className="empty-active-state">
                    <div className="empty-active-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 12h.01M9 12h.01M15 12h.01M18 12h.01" />
                            <rect x="2" y="6" width="20" height="12" rx="2" />
                            <path d="M12 12h.01" />
                        </svg>
                    </div>
                    <h4>Тишина...</h4>
                    <p>Пока никто не играет. Когда ваши друзья начнут во что-то играть, это появится здесь!</p>
                </div>
            </div>
        );
    }

    const formatTime = (startTime: string | number) => {
        const start = new Date(startTime).getTime();
        const now = Date.now();
        const diffMs = now - start;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);

        if (diffHours > 0) return `${diffHours} ч.`;
        return `${diffMins} мин.`;
    };

    return (
        <div className="active-contacts-sidebar">
            <h3 className="section-title">Активные контакты</h3>
            <div className="active-contacts-list custom-scrollbar">
                {activeFriends.map(friend => (
                    <div
                        key={friend._id}
                        className="active-card glass-panel-base"
                        data-type={friend.activity?.type || 'playing'}
                        onClick={(e) => onUserClick(friend._id, e)}
                    >
                        {friend.activity?.assets?.largeImage && (
                            <div 
                                className="active-card-glow" 
                                style={{ backgroundImage: `url(${getFullUrl(friend.activity.assets.largeImage)})` }}
                            />
                        )}
                        <div className="active-card-header">
                            <div className="active-user-info">
                                <UserAvatar user={friend} size={32} className="active-avatar" />
                                <div className="active-user-details">
                                    <span className="active-username">{friend.username}</span>
                                    <span className="active-activity-name">
                                        {friend.activity?.name} — {friend.activity?.timestamps?.start ? formatTime(friend.activity.timestamps.start) : 'только что'}
                                    </span>
                                </div>
                            </div>
                            {friend.activity?.assets?.largeImage && (
                                <div className="active-game-mini-icon">
                                    <img src={getFullUrl(friend.activity.assets.largeImage)!} alt="" />
                                </div>
                            )}
                        </div>

                        <div className="active-card-content">
                            <div className="active-game-info">
                                {friend.activity?.assets?.largeImage && (
                                    <div className="active-game-icon">
                                        <img src={getFullUrl(friend.activity.assets.largeImage)!} alt="" />
                                    </div>
                                )}
                                <div className="active-game-details">
                                    <div className="active-game-title">
                                        {friend.activity?.name}
                                    </div>
                                    <div className="active-game-subtitle">
                                        {friend.activity?.state || (friend.activity?.type === 'playing' ? 'Играет' : 'В эфире')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ActiveContacts;
