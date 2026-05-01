import React from 'react';
import { DirectMessage, User } from '../types';
import { getAvatarUrl } from '../utils/avatar';
import { UsersIcon, PlusIcon } from './Icons';
import UserAvatar from './UserAvatar';
import VoiceControlPanel from './VoiceControlPanel';
import UserBadges from './UserBadges';
import './DMSidebar.css';

interface DMSidebarProps {
    dms: DirectMessage[];
    selectedDM: DirectMessage | null;
    onDMSelect: (dm: DirectMessage) => void;
    onShowFriends: () => void;
    showFriends: boolean;
    currentUser: User;
    unreadCounts: Record<string, number>;
    onAddDM?: () => void;
    style?: React.CSSProperties;
}

const DMSidebar: React.FC<DMSidebarProps> = ({
    dms,
    selectedDM,
    onDMSelect,
    onShowFriends,
    showFriends,
    currentUser,
    unreadCounts,
    onAddDM,
    style
}) => {
    return (
        <div className="dm-sidebar" style={style}>
            <div className="dm-sidebar-header">
                <button
                    className={`friends-tab-button ${showFriends ? 'active' : ''}`}
                    onClick={onShowFriends}
                >
                    <div className="icon-wrapper">
                        <UsersIcon size={20} />
                    </div>
                    <span>Друзья</span>
                </button>
            </div>

            <div className="dm-list-container custom-scrollbar">
                <div className="dm-list-title">
                    <span>ЛИЧНЫЕ СООБЩЕНИЯ</span>
                    <button
                        className="add-dm-button"
                        title="Начать переписку"
                        onClick={onAddDM}
                    >
                        <PlusIcon size={16} />
                    </button>
                </div>

                <div className="dm-list">
                    {dms.map(dm => {
                        const isGroup = dm.participants.length > 2 || !!dm.name;
                        const otherParticipants = dm.participants.filter(p => p._id !== currentUser._id);
                        const otherUser = otherParticipants[0];
                        if (!otherUser && !isGroup) return null;

                        const isSelected = selectedDM?._id === dm._id;
                        const unreadCount = unreadCounts[dm._id] || 0;
                        const displayName = dm.name || (isGroup ? otherParticipants.map(p => p.username).join(', ') : otherUser?.username);

                        return (
                            <div
                                key={dm._id}
                                className={`dm-item ${isSelected ? 'active' : ''} ${unreadCount > 0 ? 'unread' : ''} ${isGroup ? 'group-dm' : ''}`}
                                onClick={() => onDMSelect(dm)}
                            >
                                <div className="dm-avatar-wrap">
                                    <UserAvatar
                                        user={isGroup ? null : otherUser}
                                        size={32}
                                        className="dm-avatar"
                                    />
                                    {!isGroup && otherUser && <div className={`status-indicator ${otherUser.status}`}></div>}
                                </div>
                                <div className="dm-info">
                                    <div className="dm-name-row">
                                        <span className="dm-name">{displayName}</span>
                                        {!isGroup && otherUser && <UserBadges badges={otherUser.badges} size={12} />}
                                    </div>
                                    {!isGroup && otherUser?.activity && (
                                        <span className="dm-activity">Играет в {otherUser.activity.name}</span>
                                    )}
                                    {isGroup && (
                                        <span className="dm-activity">{dm.participants.length} участников</span>
                                    )}
                                </div>
                                {unreadCount > 0 && (
                                    <div className="dm-unread-badge">{unreadCount}</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            <VoiceControlPanel />
        </div>
    );
};

export default DMSidebar;
