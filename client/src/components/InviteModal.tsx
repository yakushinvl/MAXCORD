import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { CloseIcon, SearchIcon } from './Icons';
import { User } from '../types';
import { getAvatarUrl } from '../utils/avatar';
import UserAvatar from './UserAvatar';
import './InviteModal.css';

interface InviteModalProps { isOpen: boolean; onClose: () => void; serverId: string; serverName?: string; }

const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, serverId, serverName }) => {
    const [inviteLink, setInviteLink] = useState('');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [friends, setFriends] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [invitedFriends, setInvitedFriends] = useState<Set<string>>(new Set());
    const [error, setError] = useState('');

    const generateInvite = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await axios.post('/api/invites', { serverId, expiresIn: 604800 });
            let baseUrl = (window.location.protocol === 'file:') ? (import.meta.env.VITE_SERVER_URL || 'https://maxcord.fun').replace(/\/$/, '') : `${window.location.protocol}//${window.location.host}`;
            setInviteLink(`${baseUrl}/invite/${res.data.code}`);
        } catch (err: any) { setError(err.response?.data?.message || 'Не удалось создать приглашение'); }
        finally { setLoading(false); }
    }, [serverId]);

    const fetchFriends = useCallback(async () => { try { setFriends((await axios.get('/api/friends')).data); } catch (e) { } }, []);

    useEffect(() => {
        if (isOpen) { if (!inviteLink) generateInvite(); fetchFriends(); }
    }, [isOpen, inviteLink, generateInvite, fetchFriends]);

    const handleInviteFriend = async (friendId: string) => {
        if (invitedFriends.has(friendId)) return;
        try {
            const dmRes = await axios.get(`/api/direct-messages/user/${friendId}`);
            await axios.post(`/api/direct-messages/${dmRes.data._id}/messages`, { content: `Привет! Присоединяйся к моему серверу ${serverName || ''}: ${inviteLink}` });
            setInvitedFriends(prev => new Set(prev).add(friendId));
        } catch (err) { }
    };

    const copyToClipboard = async () => {
        const electron = (window as any).electron;
        if (electron?.clipboard?.writeText) { try { electron.clipboard.writeText(inviteLink); setCopied(true); return; } catch (e) { } }
        try {
            if (navigator.clipboard) { await navigator.clipboard.writeText(inviteLink); setCopied(true); }
            else { const ta = document.createElement("textarea"); ta.value = inviteLink; ta.style.position = "fixed"; ta.style.left = "-9999px"; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); setCopied(true); }
        } catch (e) { }
    };

    useEffect(() => { if (copied) { const t = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(t); } }, [copied]);
    if (!isOpen) return null;
    const filteredFriends = friends.filter(f => f.username.toLowerCase().includes(searchQuery.toLowerCase()));

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="invite-modal-v2" onClick={e => e.stopPropagation()}>
                <div className="invite-header"><div className="header-title"><h3>Пригласить друзей в {serverName || 'на сервер'}</h3></div><button className="close-btn" onClick={onClose}><CloseIcon /></button></div>
                <div className="invite-body">
                    <div className="search-container"><input type="text" placeholder="Поиск друзей" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /><SearchIcon size={18} /></div>
                    <div className="friends-invite-list">{filteredFriends.length === 0 ? <div className="no-friends">Друзья не найдены</div> : filteredFriends.map(f => (
                        <div key={f._id} className="invite-friend-item">
                            <div className="friend-info">
                                <UserAvatar user={f} size={36} className="friend-avatar-comp" />
                                <span className="friend-name">{f.username}</span>
                            </div>
                            <button className={`invite-btn ${invitedFriends.has(f._id) ? 'sent' : ''}`} onClick={() => handleInviteFriend(f._id)} disabled={invitedFriends.has(f._id) || !inviteLink}>{invitedFriends.has(f._id) ? 'Отправлено' : 'Пригласить'}</button>
                        </div>
                    ))}</div>
                </div>
                <div className="invite-footer">
                    <p className="footer-label">ИЛИ ОТПРАВЬТЕ ССЫЛКУ-ПРИГЛАШЕНИЕ ДРУГУ</p>
                    <div className="link-copy-container"><input type="text" value={inviteLink} readOnly /><button className={`copy-btn ${copied ? 'success' : ''}`} onClick={copyToClipboard}>{copied ? 'Скопировано' : 'Копировать'}</button></div>
                    <p className="link-expiry">Срок действия вашей ссылки-приглашения истечет через 7 дней.</p>
                    {error && <div className="invite-error">{error}</div>}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default InviteModal;
