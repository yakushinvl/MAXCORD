import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { User } from '../types';
import { getAvatarUrl, getFullUrl } from '../utils/avatar';
import { CloseIcon, PlusIcon, CheckIcon, TrashIcon, BotIcon } from './Icons';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { Permissions, hasPermission, computePermissions } from '../utils/permissions';
import UserAvatar from './UserAvatar';
import UserBadges from './UserBadges';
import './UserProfileCard.css';

interface UserProfileCardProps {
    userId: string;
    onClose: () => void;
    serverId?: string;
    position?: { x: number, y: number } | null;
    onUserClick?: (userId: string, event?: React.MouseEvent) => void;
}

const ActivityTimer: React.FC<{ startTime: number }> = ({ startTime }) => {
    const [elapsed, setElapsed] = useState('');
    useEffect(() => {
        const update = () => {
            const diff = Math.floor((Date.now() - startTime) / 1000);
            const hours = Math.floor(diff / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            const seconds = diff % 60;
            if (hours > 0) setElapsed(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} прошло`);
            else setElapsed(`${minutes}:${seconds.toString().padStart(2, '0')} прошло`);
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [startTime]);
    return <div className="activity-time">{elapsed}</div>;
};

const UserProfileCard: React.FC<UserProfileCardProps> = ({ userId, onClose, serverId, position, onUserClick }) => {
    const { socket } = useSocket();
    const { user: currentUser, refreshUser } = useAuth();
    const { alert, confirm } = useDialog();
    const [profileData, setProfileData] = useState<{
        user: User;
        mutualServers: Array<{ _id: string; name: string; icon: string }>;
        mutualFriends: User[];
        friendship?: { _id: string, status: string, requester: string, recipient: string } | null;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'info' | 'mutualFriends' | 'mutualServers'>('info');
    const [memberData, setMemberData] = useState<any>(null);
    const [server, setServer] = useState<any>(null);
    const [showRoleSelector, setShowRoleSelector] = useState(false);
    const [userServers, setUserServers] = useState<any[]>([]);
    const [showBotServerSelect, setShowBotServerSelect] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const [adjustedPos, setAdjustedPos] = useState({ top: position?.y || 0, left: (position?.x || 0) + 20 });
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!position || !cardRef.current) return;

        let isDisposed = false;

        const updatePosition = () => {
            if (!cardRef.current || isDisposed) return;
            const rect = cardRef.current.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            const winW = window.innerWidth;
            const winH = window.innerHeight;

            let finalX = position.x + 20;
            let finalY = position.y;

            // Horizontal flip logic
            if (finalX + rect.width > winW - 20) {
                finalX = position.x - rect.width - 20;
            }

            // Vertical flip logic
            if (finalY + rect.height > winH - 20) {
                finalY = position.y - rect.height;
            }

            // Safety boundaries (clamping)
            if (finalY + rect.height > winH - 10) finalY = winH - rect.height - 10;
            if (finalY < 10) finalY = 10;
            if (finalX < 10) finalX = 10;
            if (finalX + rect.width > winW - 10) finalX = winW - rect.width - 10;

            setAdjustedPos({ top: finalY, left: finalX });
            setIsVisible(true);
        };

        // Initial attempt
        updatePosition();

        // Sequence of checks as content renders
        const t1 = setTimeout(updatePosition, 30);
        const t2 = setTimeout(updatePosition, 100);
        const t3 = setTimeout(updatePosition, 300);

        return () => {
            isDisposed = true;
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [position, profileData, loading]);

    const userPerms = (currentUser && server) ? computePermissions(currentUser._id, server) : 0n;
    const canManageRoles = hasPermission(userPerms, Permissions.MANAGE_ROLES);

    useEffect(() => {
        if (socket && userId) {
            const handleUserUpdate = (updatedUser: any) => {
                if (updatedUser._id === userId) {
                    setProfileData(prev => prev ? { ...prev, user: { ...prev.user, ...updatedUser } } : prev);
                }
            };
            socket.on('user-updated', handleUserUpdate);
            return () => { socket.off('user-updated', handleUserUpdate); };
        }
    }, [socket, userId]);

    const fetchProfile = async () => {
        if (!userId) return;
        setLoading(true);
        setError('');
        try {
            const response = await axios.get(`/api/users/profile/${userId}`);
            setProfileData(response.data);
            if (serverId) {
                try {
                    const [memberRes, serverRes] = await Promise.all([
                        axios.get(`/api/servers/${serverId}/members/${userId}`),
                        axios.get(`/api/servers/${serverId}`)
                    ]);
                    setMemberData(memberRes.data);
                    setServer(serverRes.data);
                } catch (memberErr) {
                    setMemberData(null);
                    setServer(null);
                }
            }

            if (response.data.user.isBot) {
                const serversRes = await axios.get('/api/servers/me');
                setUserServers(serversRes.data);
            }
        } catch (err) {
            setError('Не удалось загрузить профиль');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [userId, serverId]);

    const handleAddFriend = async () => {
        try {
            await axios.post('/api/friends/request', { userId });
            await alert('Запрос в друзья отправлен');
            fetchProfile();
        } catch (err: any) {
            await alert(err.response?.data?.message || 'Ошибка отправки запроса');
        }
    };

    const handleAcceptFriend = async (friendshipId: string) => {
        try {
            await axios.post(`/api/friends/accept/${friendshipId}`);
            await alert('Запрос принят');
            fetchProfile();
        } catch (err: any) {
            await alert('Ошибка при принятии запроса');
        }
    };

    const handleRemoveFriend = async (friendshipId: string) => {
        const confirmed = await confirm('Вы уверены, что хотите удалить этого пользователя из друзей?');
        if (!confirmed) return;
        try {
            await axios.delete(`/api/friends/${friendshipId}`);
            await alert('Пользователь удален из друзей');
            fetchProfile();
        } catch (err: any) {
            await alert('Ошибка при удалении из друзей');
        }
    };

    const handleAddBotToServer = async (targetServerId: string) => {
        try {
            await axios.post(`/api/bots/${userId}/add-to-server`, { serverId: targetServerId });
            await alert('Бот добавлен на сервер!');
            setShowBotServerSelect(false);
            fetchProfile();
        } catch (err: any) {
            await alert(err.response?.data?.message || 'Ошибка добавления бота');
        }
    };

    if (error) return (
        <div className={`user-profile-overlay ${position ? 'transparent' : ''}`} onClick={onClose}>
            <div
                className={`user-profile-card error ${position ? 'popout' : ''}`}
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
                <p>{error}</p>
                <button onClick={onClose}>Закрыть</button>
            </div>
        </div>
    );

    if (loading || !profileData) return (
        <div className={`user-profile-overlay ${position ? 'transparent' : ''}`} onClick={onClose}>
            <div
                className={`user-profile-card loading-skeleton ${position ? 'popout' : ''}`}
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
                <div className="profile-banner skeleton"></div>
                <div className="profile-header"><div className="profile-avatar-container"><div className="profile-avatar skeleton"></div></div></div>
                <div className="profile-body"><div className="skeleton-text large" style={{ width: '60%' }}></div></div>
            </div>
        </div>
    );

    const handleToggleRole = async (roleId: string) => {
        if (!serverId || !userId || !memberData) return;
        const currentRoles = memberData.roles || [];
        const isRemoving = currentRoles.includes(roleId);
        const newRoles = isRemoving
            ? currentRoles.filter((id: string) => id !== roleId)
            : [...currentRoles, roleId];

        try {
            const res = await axios.put(`/api/servers/${serverId}/members/${userId}`, { roles: newRoles });
            setMemberData({ ...memberData, roles: res.data.roles });
        } catch (err) {
            await alert('Не удалось обновить роли');
        }
    };

    const { user, mutualServers, mutualFriends, friendship } = profileData;
    const isMe = currentUser?._id === userId;

    return (
        <div className={`user-profile-overlay ${position ? 'transparent' : ''}`} onClick={onClose}>
            <div
                className={`user-profile-card ${position ? 'popout' : ''}`}
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
                <div className="profile-banner" style={{ backgroundColor: '#5865f2', backgroundImage: (memberData?.banner || user.banner) ? `url(${getFullUrl(memberData?.banner || user.banner)})` : 'none', backgroundSize: 'cover' }}>
                    <button className="profile-close-button" onClick={onClose}><CloseIcon /></button>
                </div>

                <div className="profile-header">
                    <div className="profile-avatar-container">
                        <UserAvatar
                            user={user}
                            size={80}
                            className={`profile-avatar ${user.status}`}
                            animate={true}
                        />
                        <div className={`profile-status-indicator ${user.status}`}></div>
                    </div>

                    {!isMe && (
                        <div className="profile-actions-header">
                            {user.isBot ? (
                                <div className="bot-action-wrapper">
                                    <button className="profile-action-btn primary" onClick={() => setShowBotServerSelect(!showBotServerSelect)}>
                                        <PlusIcon size={16} />
                                        <span>Добавить на сервер</span>
                                    </button>
                                    {showBotServerSelect && (
                                        <div className="bot-server-selector">
                                            {userServers.map(s => (
                                                <div key={s._id} className="bot-server-item" onClick={() => handleAddBotToServer(s._id)}>
                                                    {s.name}
                                                </div>
                                            ))}
                                            {userServers.length === 0 && <div className="no-servers">Нет серверов для приглашения</div>}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {!friendship && (
                                        <button className="profile-action-btn primary" onClick={handleAddFriend}>
                                            <PlusIcon size={16} />
                                            <span>Добавить в друзья</span>
                                        </button>
                                    )}
                                    {friendship?.status === 'pending' && friendship.recipient === currentUser?._id && (
                                        <button className="profile-action-btn success" onClick={() => handleAcceptFriend(friendship._id)}>
                                            <CheckIcon size={16} />
                                            <span>Принять запрос</span>
                                        </button>
                                    )}
                                    {friendship?.status === 'pending' && friendship.requester === currentUser?._id && (
                                        <button className="profile-action-btn secondary disabled">
                                            <span>Ожидание ответа</span>
                                        </button>
                                    )}
                                    {friendship?.status === 'accepted' && (
                                        <button className="profile-action-btn friends-status" onClick={() => handleRemoveFriend(friendship._id)}>
                                            <CheckIcon size={16} />
                                            <span className="btn-text-content">Друзья</span>
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="profile-body">
                    <div className="profile-names">
                        <div className="profile-names-top">
                            {memberData?.nickname ? (
                                <>
                                    <span className="profile-nickname">{memberData.nickname}</span>
                                    {user.isBot && <span className="bot-badge-mini">BOT</span>}
                                    <UserBadges badges={user.badges} size={18} className="profile-badges" />
                                </>
                            ) : (
                                <>
                                    <span className="profile-username">{user.username}</span>
                                    {user.isBot && <span className="bot-badge-mini">BOT</span>}
                                    <UserBadges badges={user.badges} size={18} className="profile-badges" />
                                </>
                            )}
                        </div>
                        {memberData?.nickname && <span className="profile-username sub">{user.username}</span>}
                    </div>


                    {user.activity && (
                        <div className="profile-activity-section">
                            <h4 className="section-title">ЗАНИМАЕТСЯ:</h4>
                            <div className="activity-content">
                                {user.activity.assets?.largeImage && (
                                    <div className="activity-image-wrapper">
                                        <img src={getFullUrl(user.activity.assets.largeImage)!} alt="" className="activity-large-image" />
                                    </div>
                                )}
                                <div className="activity-details">
                                    <div className="activity-name">{user.activity.name}</div>
                                    <div className="activity-state">Играет в {user.activity.name}</div>
                                    {user.activity.timestamps?.start && <ActivityTimer startTime={user.activity.timestamps.start} />}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="profile-divider"></div>

                    <div className="profile-tabs">
                        <button className={activeTab === 'info' ? 'active' : ''} onClick={() => setActiveTab('info')}>Информация</button>
                        <button className={activeTab === 'mutualFriends' ? 'active' : ''} onClick={() => setActiveTab('mutualFriends')}>Общие друзья ({mutualFriends.length})</button>
                        <button className={activeTab === 'mutualServers' ? 'active' : ''} onClick={() => setActiveTab('mutualServers')}>Общие серверы ({mutualServers.length})</button>
                    </div>

                    <div className="profile-tab-content">
                        {activeTab === 'info' && (
                            <div className="info-tab">
                                <section><h4>О СЕБЕ</h4><p className="bio-text">{memberData?.bio || user.bio || 'Пользователь ничего не рассказал о себе.'}</p></section>

                                {serverId && server && (
                                    <section>
                                        <div className="roles-list-header">
                                            <h4>РОЛИ</h4>
                                            {canManageRoles && (
                                                <button className="add-role-btn" onClick={() => setShowRoleSelector(!showRoleSelector)}>
                                                    <PlusIcon size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="roles-list">
                                            {(memberData?.roles || []).length > 0 ? (
                                                memberData.roles.map((rid: string) => {
                                                    const role = server.roles.find((r: any) => r._id === rid);
                                                    if (!role) return null;
                                                    return (
                                                        <div key={rid} className="role-chip" style={{ borderColor: role.color + '44' }}>
                                                            <div className="role-dot" style={{ backgroundColor: role.color }} />
                                                            <span style={{ color: role.color || '#fff' }}>{role.name}</span>
                                                            {canManageRoles && (
                                                                <div className="role-remove-icon" onClick={() => handleToggleRole(rid)}>×</div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <span className="no-roles">Нет ролей</span>
                                            )}

                                            {showRoleSelector && (
                                                <div className="role-selector-dropdown">
                                                    {server.roles.filter((r: any) => r.name !== '@everyone' && !memberData.roles?.includes(r._id)).map((role: any) => (
                                                        <div key={role._id} className="role-select-item-mini" onClick={() => { handleToggleRole(role._id); setShowRoleSelector(false); }}>
                                                            <div className="role-dot" style={{ backgroundColor: role.color }} />
                                                            {role.name}
                                                        </div>
                                                    ))}
                                                    {server.roles.filter((r: any) => r.name !== '@everyone' && !memberData.roles?.includes(r._id)).length === 0 && (
                                                        <div className="no-roles-av">Нет доступных ролей</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                )}

                                <section><h4>ДАТА РЕГИСТРАЦИИ</h4><p>{new Date(user.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p></section>
                            </div>
                        )}
                        {activeTab === 'mutualFriends' && (
                            <div className="mutual-list">
                                {mutualFriends.length > 0 ? mutualFriends.map(friend => (
                                    <div key={friend._id} className="mutual-item" onClick={(e) => onUserClick?.(friend._id, e)} style={{ cursor: 'pointer' }}>
                                        <UserAvatar user={friend} size={32} className="mutual-avatar" />
                                        <span>{friend.username}</span>
                                        <UserBadges badges={friend.badges} size={14} />
                                    </div>
                                )) : <div className="empty-mutual">Нет общих друзей.</div>}
                            </div>
                        )}
                        {activeTab === 'mutualServers' && (
                            <div className="mutual-list">
                                {mutualServers.length > 0 ? mutualServers.map(server => (
                                    <div key={server._id} className="mutual-item">
                                        <div className="mutual-avatar server">{server.icon ? <img src={getAvatarUrl(server.icon)!} alt="" /> : <span>{server.name.charAt(0).toUpperCase()}</span>}</div>
                                        <span>{server.name}</span>
                                    </div>
                                )) : <div className="empty-mutual">Нет общих серверов.</div>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfileCard;