import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Server } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { getAvatarUrl, getFullUrl } from '../utils/avatar';
import { CloseIcon, PlusIcon } from './Icons';
import UserAvatar from './UserAvatar';
import './UserServerProfileModal.css';

interface UserServerProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    serverId: string;
    onUpdate?: (updatedServer: Server) => void;
}

const UserServerProfileModal: React.FC<UserServerProfileModalProps> = ({ isOpen, onClose, serverId, onUpdate }) => {
    const { user } = useAuth();
    const { alert } = useDialog();
    const [server, setServer] = useState<Server | null>(null);
    const [nickname, setNickname] = useState('');
    const [bio, setBio] = useState('');
    const [avatar, setAvatar] = useState<string | null>(null);
    const [banner, setBanner] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchServer = async () => {
            if (!serverId || !user) return;
            setLoading(true);
            try {
                const res = await axios.get(`/api/servers/${serverId}`);
                const s = res.data;
                setServer(s);
                const member = s.members.find((m: any) => (m.user._id || m.user) === user._id);
                if (member) {
                    setNickname(member.nickname || '');
                    setBio(member.bio || '');
                    setAvatar(member.avatar || null);
                    setBanner(member.banner || null);
                }
            } catch (err) { }
            finally { setLoading(false); }
        };
        fetchServer();
    }, [serverId, user]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
        if (e.target.files && e.target.files[0]) {
            const formData = new FormData();
            formData.append('files', e.target.files[0]);
            try {
                const res = await axios.post('/api/upload-files', formData);
                if (type === 'avatar') setAvatar(res.data[0].url);
                else setBanner(res.data[0].url);
            } catch (err) { await alert('Ошибка загрузки'); }
        }
    };

    const handleSave = async () => {
        if (!user || !server) return;
        setSaving(true);
        try {
            await axios.put(`/api/servers/${server._id}/members/${user._id}`, { nickname, bio, avatar, banner });
            const updatedServerRes = await axios.get(`/api/servers/${server._id}`);
            if (onUpdate) onUpdate(updatedServerRes.data);
            onClose();
        } catch (err) { await alert('Не удалось сохранить изменения'); }
        finally { setSaving(false); }
    };

    if (!isOpen || !server || loading || !user) return null;

    return (
        <div className="user-server-profile-overlay" onClick={onClose}>
            <div className="user-server-profile-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header"><h3>Профиль сервера</h3><button className="close-btn" onClick={onClose}><CloseIcon /></button></div>
                <div className="user-server-profile-content">
                    <div className="profile-preview-section">
                        <div className="section-label">ПРЕДПРОСМОТР</div>
                        <div className="profile-preview-card">
                            <div className="preview-banner" style={{ backgroundImage: banner ? `url(${getFullUrl(banner)})` : (user.banner ? `url(${getFullUrl(user.banner)})` : 'none'), backgroundColor: '#5865f2' }}>
                                <button className="edit-banner-btn" onClick={() => bannerInputRef.current?.click()}>Изменить баннер</button>
                            </div>
                            <div className="preview-header">
                                <div className="preview-avatar-container">
                                    <div className="preview-avatar-wrap">
                                        <UserAvatar
                                            user={{ ...user, avatar: avatar || user.avatar }}
                                            size={80}
                                            animate={true}
                                            className="preview-avatar"
                                        />
                                        <div className="avatar-edit-overlay" onClick={() => avatarInputRef.current?.click()}>
                                            <PlusIcon size={20} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="preview-info"><div className="preview-name">{nickname || user.username}</div><div className="preview-username">{user.username}</div><div className="preview-divider" /><div className="preview-bio-label">О СЕБЕ</div><div className="preview-bio">{bio || user.bio || 'Нет описания'}</div></div>
                        </div>
                    </div>
                    <div className="profile-edit-section">
                        <div className="input-group"><label>НИКНЕЙМ СЕРВЕРА</label><div className="input-with-reset"><input type="text" value={nickname} onChange={e => setNickname(e.target.value)} placeholder={user.username} />{nickname && <button className="reset-link" onClick={() => setNickname('')}>Сбросить никнейм</button>}</div></div>
                        <div className="input-group"><label>АВАТАР СЕРВЕРА</label><div className="avatar-actions"><button className="action-btn" onClick={() => avatarInputRef.current?.click()}>Изменить аватар</button>{avatar && <button className="reset-link" onClick={() => setAvatar(null)}>Сбросить аватар</button>}</div></div>
                        <div className="input-group"><label>БАННЕР СЕРВЕРА</label><div className="banner-actions"><button className="action-btn" onClick={() => bannerInputRef.current?.click()}>Изменить баннер</button>{banner && <button className="reset-link" onClick={() => setBanner(null)}>Сбросить баннер</button>}</div></div>
                        <div className="input-group"><label>О СЕБЕ НА СЕРВЕРЕ</label><textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Расскажите что-нибудь о себе в этом сообществе..." maxLength={300} /><div className="char-count">{300 - bio.length}</div></div>
                    </div>
                </div>
                <div className="modal-footer"><button className="cancel-btn" onClick={onClose}>Отмена</button><button className="save-btn" onClick={handleSave} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить изменения'}</button></div>
                <input type="file" ref={avatarInputRef} style={{ display: 'none' }} accept="image/*" onChange={e => handleFileUpload(e, 'avatar')} />
                <input type="file" ref={bannerInputRef} style={{ display: 'none' }} accept="image/*" onChange={e => handleFileUpload(e, 'banner')} />
            </div>
        </div>
    );
};

export default UserServerProfileModal;
