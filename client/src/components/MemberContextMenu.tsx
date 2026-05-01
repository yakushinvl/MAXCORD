import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { User, Server } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useVoice } from '../contexts/VoiceContext';
import { useDialog } from '../contexts/DialogContext';
import axios from 'axios';
import { Permissions, hasPermission, computePermissions } from '../utils/permissions';
import './MemberContextMenu.css';
import InputModal from './InputModal';
import ReportModal from './ReportModal';

interface MemberContextMenuProps {
    user: User;
    server: Server;
    x: number;
    y: number;
    onClose: () => void;
    onMention?: (username: string) => void;
    onOpenProfile?: (userId: string, event?: React.MouseEvent) => void;
}

const MemberContextMenu: React.FC<MemberContextMenuProps> = ({
    user: targetUser,
    server,
    x,
    y,
    onClose,
    onMention,
    onOpenProfile
}) => {
    if (!targetUser) return null;

    const { user: currentUser } = useAuth();
    const { socket } = useSocket();
    const { userVolumes, setUserVolume, localMutes, toggleLocalMute } = useVoice();
    const { confirm, alert } = useDialog();
    const [isFriend, setIsFriend] = useState(false);
    const [friendshipId, setFriendshipId] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);

    const [showInputModal, setShowInputModal] = useState(false);
    const [inputModalConfig, setInputModalConfig] = useState<{
        title: string;
        label?: string;
        initialValue?: string;
        type?: 'text' | 'number';
        onSubmit: (val: string) => void;
    }>({ title: '', onSubmit: () => { } });
    const [showReportModal, setShowReportModal] = useState(false);
    const [adjustedPos, setAdjustedPos] = useState({ top: y, left: x });
    const [isVisible, setIsVisible] = useState(false);

    const currentVolume = userVolumes.get(targetUser._id) ?? 1;
    const isLocalMuted = localMutes.has(targetUser._id);
    const isSelf = currentUser?._id === targetUser._id;
    const userPerms = currentUser ? computePermissions(currentUser._id, server) : 0n;
    const canManageRoles = hasPermission(userPerms, Permissions.MANAGE_ROLES);
    const canKick = hasPermission(userPerms, Permissions.KICK_MEMBERS);
    const canBan = hasPermission(userPerms, Permissions.BAN_MEMBERS);
    const canManageNicknames = hasPermission(userPerms, Permissions.MANAGE_NICKNAMES);
    const canChangeNickname = hasPermission(userPerms, Permissions.CHANGE_NICKNAME);
    const canMove = hasPermission(userPerms, Permissions.MOVE_MEMBERS);
    const isOwner = (typeof server.owner === 'object' ? (server.owner as any)._id : server.owner) === currentUser?._id;

    const { userStates, activeChannelId } = useVoice();
    const targetVoiceState = userStates.get(targetUser._id);
    const isInVoice = !!targetVoiceState;
    const isServerMuted = targetVoiceState?.isServerMuted || false;
    const isServerDeafened = targetVoiceState?.isServerDeafened || false;

    const voiceChannels = server.channels.filter(c => c.type === 'voice');

    const handleServerMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (socket) socket.emit('admin-voice-mute', { userId: targetUser._id, muted: !isServerMuted, serverId: server._id });
        // Don't close immediately to let the checkbox update
    };

    const handleServerDeafen = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (socket) socket.emit('admin-voice-deafen', { userId: targetUser._id, deafened: !isServerDeafened, serverId: server._id });
        // Don't close immediately to let the checkbox update
    };

    const handleMoveTo = (channelId: string) => {
        if (socket) socket.emit('admin-voice-move', { userId: targetUser._id, channelId });
        onClose();
    };

    const handleBan = async () => {
        if (await confirm(`Вы уверены, что хотите забанить ${targetUser.username}?`)) {
            try {
                await axios.post(`/api/servers/${server._id}/bans`, { userId: targetUser._id });
            } catch (err) { await alert('Не удалось забанить пользователя.'); }
            onClose();
        }
    };

    useEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            let finalX = x;
            let finalY = y;

            if (finalX + rect.width > window.innerWidth) {
                finalX = window.innerWidth - rect.width - 20;
            }
            if (finalY + rect.height > window.innerHeight) {
                finalY = window.innerHeight - rect.height - 20;
            }

            setAdjustedPos({
                top: Math.max(10, finalY),
                left: Math.max(10, finalX)
            });
            setIsVisible(true);
        }
    }, [x, y]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showInputModal) return;
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, showInputModal]);

    // ... (friendship effect existing code)
    useEffect(() => {
        const checkFriendship = async () => {
            try {
                const res = await axios.get('/api/friends');
                const friend = res.data.find((f: any) => f._id === targetUser._id);
                if (friend) {
                    setIsFriend(true);
                    setFriendshipId(friend.friendshipId);
                }
            } catch (err) { }
        };
        checkFriendship();
        if (currentUser?.notes) {
            const userNote = currentUser.notes[targetUser._id];
            if (userNote) setNote(userNote);
        }
    }, [targetUser._id, currentUser]);

    const handleAction = async (action: string) => {
        try {
            switch (action) {
                // ... (existing cases)
                case 'profile':
                    if (onOpenProfile) onOpenProfile(targetUser._id, { clientX: x, clientY: y } as any);
                    break;
                case 'mention':
                    if (onMention) onMention(targetUser.username);
                    break;
                case 'message':
                    const dmRes = await axios.get(`/api/direct-messages/user/${targetUser._id}`);
                    window.dispatchEvent(new CustomEvent('start-dm', { detail: { dm: dmRes.data } }));
                    break;
                case 'call':
                    const dmCallRes = await axios.get(`/api/direct-messages/user/${targetUser._id}`);
                    window.dispatchEvent(new CustomEvent('start-call', { detail: { user: targetUser, dmId: dmCallRes.data._id } }));
                    break;
                case 'add-friend':
                    await axios.post('/api/friends/request', { userId: targetUser._id });
                    break;
                case 'remove-friend':
                    if (friendshipId) await axios.delete(`/api/friends/${friendshipId}`);
                    setIsFriend(false);
                    break;
                case 'block':
                    await axios.post('/api/users/block', { userId: targetUser._id });
                    onClose();
                    break;
                case 'update-note':
                    setInputModalConfig({
                        title: 'Заметка',
                        label: 'Заметка для ' + targetUser.username,
                        initialValue: note,
                        onSubmit: async (val) => {
                            try {
                                await axios.post('/api/users/note', { userId: targetUser._id, note: val });
                                setNote(val);
                            } catch (err) { }
                        }
                    });
                    setShowInputModal(true);
                    return;
                case 'nickname':
                    const m = server.members.find(m => (m.user._id || m.user) === targetUser._id);
                    setInputModalConfig({
                        title: 'Изменить никнейм',
                        label: 'Никнейм',
                        initialValue: (m as any)?.nickname || '',
                        onSubmit: async (val) => {
                            try {
                                await axios.put(`/api/servers/${server._id}/members/${targetUser._id}`, { nickname: val });
                            } catch (err) { }
                        }
                    });
                    setShowInputModal(true);
                    return;
                case 'toggle-role':
                    return;
                case 'server-profile':
                    window.dispatchEvent(new CustomEvent('open-server-profile-settings', { detail: { serverId: server._id } }));
                    break;
                case 'report':
                    setShowReportModal(true);
                    return;
                case 'assign-moderator':
                    if (await confirm(`Вы уверены, что хотите назначить ${targetUser.username} модератором?`)) {
                        try {
                            await axios.post('/api/moderation/assign-role', { userId: targetUser._id, role: 'moderator' });
                            await alert('Пользователь теперь модератор.');
                        } catch (err) { await alert('Ошибка назначения роли.'); }
                    }
                    break;
                case 'assign-user':
                    if (await confirm(`Вы уверены, что хотите снять права модератора с ${targetUser.username}?`)) {
                        try {
                            await axios.post('/api/moderation/assign-role', { userId: targetUser._id, role: 'user' });
                            await alert('Пользователь теперь обычный пользователь.');
                        } catch (err) { await alert('Ошибка снятия роли.'); }
                    }
                    break;
            }
        } catch (err) {
            await alert('Действие не удалось.');
        }
        onClose();
    };

    const handleVoiceKick = () => {
        // Kick user from voice channel (disconnect)
        if (socket && activeChannelId) socket.emit('admin-voice-kick', { userId: targetUser._id, channelId: activeChannelId });
        onClose();
    };

    const flipSubmenu = adjustedPos.left > window.innerWidth - 440;

    if (showInputModal) {
        return ReactDOM.createPortal(
            <InputModal
                isOpen={showInputModal}
                title={inputModalConfig.title}
                label={inputModalConfig.label}
                initialValue={inputModalConfig.initialValue}
                type={inputModalConfig.type}
                onClose={() => { setShowInputModal(false); onClose(); }}
                onSubmit={inputModalConfig.onSubmit}
            />,
            document.body
        );
    }

    if (showReportModal) {
        return ReactDOM.createPortal(
            <ReportModal
                isOpen={showReportModal}
                username={targetUser.username}
                onClose={() => { setShowReportModal(false); onClose(); }}
                onSubmit={async (data) => {
                    setShowReportModal(false);
                    onClose();
                    try {
                        await axios.post('/api/moderation/report', { ...data, userId: targetUser._id });
                        await alert('Жалоба отправлена. Модераторы проверят её в ближайшее время.');
                    } catch (err) { await alert('Не удалось отправить жалобу.'); }
                }}
            />,
            document.body
        );
    }

    return ReactDOM.createPortal(
        <div
            className="member-context-menu"
            ref={menuRef}
            style={{
                top: adjustedPos.top,
                left: adjustedPos.left,
                visibility: isVisible ? 'visible' : 'hidden',
                opacity: isVisible ? 1 : 0
            }}
        >
            <div className="menu-group">
                <div className="menu-item" onClick={() => handleAction('profile')}>Профиль</div>
                {isSelf && <div className="menu-item" onClick={() => handleAction('server-profile')}>Настроить профиль на сервере</div>}
                {!isSelf && (
                    <>
                        <div className="menu-item" onClick={() => handleAction('mention')}>Упомянуть</div>
                        <div className="menu-item" onClick={() => handleAction('message')}>Написать сообщение</div>
                        <div className="menu-item" onClick={() => handleAction('call')}>Позвонить</div>
                    </>
                )}
            </div>
            <div className="menu-separator" />
            <div className="menu-group">
                <div className="menu-item" onClick={() => handleAction('update-note')}>
                    {note ? 'Изменить заметку' : 'Добавить заметку'}
                </div>
            </div>
            <div className="menu-separator" />

            {(isInVoice && !isSelf && (hasPermission(userPerms, Permissions.MUTE_MEMBERS) || hasPermission(userPerms, Permissions.DEAFEN_MEMBERS) || hasPermission(userPerms, Permissions.MOVE_MEMBERS))) && (
                <>
                    <div className="menu-group">
                        {hasPermission(userPerms, Permissions.MUTE_MEMBERS) && (
                            <div className="menu-item check-item" onClick={handleServerMute}>
                                <span>Отключить микрофон (Сервер)</span>
                                <div className={`checkbox ${isServerMuted ? 'checked' : ''}`}>{isServerMuted && '✓'}</div>
                            </div>
                        )}
                        {hasPermission(userPerms, Permissions.DEAFEN_MEMBERS) && (
                            <div className="menu-item check-item" onClick={handleServerDeafen}>
                                <span>Отключить звук (Сервер)</span>
                                <div className={`checkbox ${isServerDeafened ? 'checked' : ''}`}>{isServerDeafened && '✓'}</div>
                            </div>
                        )}
                        {hasPermission(userPerms, Permissions.MOVE_MEMBERS) && (
                            <div className={`menu-item has-submenu ${flipSubmenu ? 'flip-left' : ''}`}>
                                <span>Переместить в</span>
                                <span className="submenu-arrow">{flipSubmenu ? '‹' : '›'}</span>
                                <div className="submenu">
                                    {voiceChannels.map(vc => (
                                        <div key={vc._id} className="menu-item" onClick={(e) => { e.stopPropagation(); handleMoveTo(vc._id); }}>
                                            {vc.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="menu-separator" />
                </>
            )}

            <div className="menu-group">
                {(isSelf ? canChangeNickname : canManageNicknames) && (
                    <div className="menu-item" onClick={() => handleAction('nickname')}>Изменить никнейм</div>
                )}
                {canManageRoles && !isSelf && (
                    <div className={`menu-item has-submenu ${flipSubmenu ? 'flip-left' : ''}`}>
                        <span>Роли</span>
                        <span className="submenu-arrow">{flipSubmenu ? '‹' : '›'}</span>
                        <div className="submenu">
                            {(server.roles || []).filter(r => r.name !== '@everyone').map(role => {
                                const m = server.members.find(me => String(me.user._id || me.user) === String(targetUser._id));
                                const hasRole = (m?.roles || []).includes(role._id);
                                return (
                                    <div
                                        key={role._id}
                                        className="menu-item role-item"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            const newRoles = hasRole
                                                ? (m?.roles || []).filter(rid => rid !== role._id)
                                                : [...(m?.roles || []), role._id];
                                            try {
                                                await axios.put(`/api/servers/${server._id}/members/${targetUser._id}`, { roles: newRoles });
                                            } catch (err) { }
                                        }}
                                    >
                                        <div className="role-info">
                                            <div className={`role-checkbox ${hasRole ? 'checked' : ''}`}>
                                                {hasRole && '✓'}
                                            </div>
                                            <div className="role-dot-mini" style={{ backgroundColor: role.color, color: role.color }} />
                                            <span className="role-name-text" style={{ color: role.color }}>{role.name}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {!isSelf && (isFriend ? <div className="menu-item destructive" onClick={() => handleAction('remove-friend')}>Удалить из друзей</div> : <div className="menu-item" onClick={() => handleAction('add-friend')}>Добавить в друзья</div>)}
                {!isSelf && <div className="menu-item destructive" onClick={() => handleAction('block')}>Заблокировать</div>}
                {!isSelf && <div className="menu-item destructive" onClick={() => handleAction('report')}>Пожаловаться</div>}
            </div>
            {currentUser?.role === 'admin' && !isSelf && (
                <>
                    <div className="menu-separator" />
                    <div className="menu-group">
                        <div className="menu-label">АДМИН: ПРАВА</div>
                        {targetUser.role !== 'moderator' ? (
                            <div className="menu-item" onClick={() => handleAction('assign-moderator')}>Назначить модератором</div>
                        ) : (
                            <div className="menu-item destructive" onClick={() => handleAction('assign-user')}>Снять права модератора</div>
                        )}
                    </div>
                </>
            )}
            {!isSelf && (
                <>
                    <div className="menu-separator" />
                    <div className="menu-group">
                        <div className="menu-label">
                            <span>Громкость пользователя</span>
                            <span className="volume-percent">{Math.round(currentVolume * 100)}%</span>
                        </div>
                        <div className="volume-slider-container">
                            <input type="range" min="0" max="2" step="0.01" value={currentVolume} onChange={(e) => setUserVolume(targetUser._id, parseFloat(e.target.value))} className="menu-volume-slider" onClick={(e) => e.stopPropagation()} />
                        </div>
                        <div className="menu-item check-item" onClick={(e) => { e.stopPropagation(); toggleLocalMute(targetUser._id); }}>
                            <span>Заглушить (для себя)</span>
                            <div className={`checkbox ${isLocalMuted ? 'checked' : ''}`}>{isLocalMuted && '✓'}</div>
                        </div>
                    </div>
                </>
            )}
            {!isSelf && (canBan || (isInVoice && canMove)) && (
                <>
                    <div className="menu-separator" />
                    <div className="menu-group">
                        {isInVoice && canMove && <div className="menu-item destructive" onClick={handleVoiceKick}>Отключить (Голос)</div>}
                        {canBan && <div className="menu-item destructive" onClick={handleBan}>Забанить</div>}
                    </div>
                </>
            )}
        </div>,
        document.body
    );
};

export default MemberContextMenu;
