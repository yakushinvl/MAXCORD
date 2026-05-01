import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Channel, Server, Role, PermissionOverwrite } from '../types';
import { Permissions, hasPermission } from '../utils/permissions';
import { getAvatarUrl } from '../utils/avatar';
import { useDialog } from '../contexts/DialogContext';
import { CloseIcon, TrashIcon, PlusIcon } from './Icons';
import './ChannelSettingsModal.css';

interface ChannelSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    channel: Channel;
    server: Server;
    onChannelUpdate: (updatedChannel: Channel) => void;
    onChannelDelete: (channelId: string) => void;
}

type Tab = 'overview' | 'permissions';

const ChannelSettingsModal: React.FC<ChannelSettingsModalProps> = ({
    isOpen,
    onClose,
    channel,
    server,
    onChannelUpdate,
    onChannelDelete
}) => {
    const { confirm } = useDialog();
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const isMobile = window.innerWidth <= 768;
    const [mobileViewState, setMobileViewState] = useState<'tabs' | 'content'>('tabs');
    const [name, setName] = useState(channel.name);
    const [topic, setTopic] = useState(channel.topic || '');
    const [overwrites, setOverwrites] = useState<PermissionOverwrite[]>(channel.permissionOverwrites || []);
    const [loading, setLoading] = useState(false);
    const [showAddAccessDropdown, setShowAddAccessDropdown] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Voice specific placeholders (since our type doesn't have them yet, we simulate them for the UI)
    const [bitrate, setBitrate] = useState(64);
    const [userLimit, setUserLimit] = useState(0);

    useEffect(() => {
        setName(channel.name);
        setTopic(channel.topic || '');
        setOverwrites(channel.permissionOverwrites || []);
        if (channel.type === 'voice') {
            setBitrate((channel as any).bitrate / 1000 || 64);
            setUserLimit((channel as any).userLimit || 0);
        }
        setActiveTab('overview');
    }, [channel]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const payload: any = {
                name,
                topic,
                permissionOverwrites: overwrites
            };
            if (channel.type === 'voice') {
                payload.bitrate = bitrate * 1000;
                payload.userLimit = userLimit;
            }
            const res = await axios.put(`/api/channels/${channel._id}`, payload);
            onChannelUpdate(res.data);
            // We can add a success toast here if available, or just clear the dirty state
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (await confirm(`Вы уверены, что хотите удалить ${channel.type === 'voice' ? 'голосовой' : 'текстовый'} канал "${channel.name}"? Это действие невозможно отменить.`)) {
            try {
                await axios.delete(`/api/channels/${channel._id}`);
                onChannelDelete(channel._id);
                onClose();
            } catch (err) {
                console.error(err);
            }
        }
    };

    const updateOverwrite = (id: string, type: 'role' | 'member', allow: bigint, deny: bigint) => {
        const index = overwrites.findIndex(o => o.id === id);
        const newOverwrites = [...overwrites];
        if (index === -1) {
            newOverwrites.push({ id, type, allow: allow.toString(), deny: deny.toString() });
        } else {
            newOverwrites[index] = { id, type, allow: allow.toString(), deny: deny.toString() };
        }
        setOverwrites(newOverwrites);
    };

    const removeOverwrite = (id: string) => {
        setOverwrites(overwrites.filter(o => o.id !== id));
    };

    if (!isOpen) return null;

    const isDirty = name !== channel.name ||
        topic !== (channel.topic || '') ||
        (channel.type === 'voice' && (bitrate !== ((channel as any).bitrate / 1000 || 64) || userLimit !== ((channel as any).userLimit || 0))) ||
        JSON.stringify(overwrites) !== JSON.stringify(channel.permissionOverwrites);

    return createPortal(
        <div className="channel-settings-modal-overlay">
            <div className="channel-settings-modal" onClick={(e) => e.stopPropagation()}>
                {(!isMobile || mobileViewState === 'tabs') && (
                    <div className="channel-settings-sidebar">
                        <div className="sidebar-header">{channel.type === 'voice' ? '🔊' : '# '} {channel.name}</div>

                        <div className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => { setActiveTab('overview'); if (isMobile) setMobileViewState('content'); }}>
                            Обзор
                        </div>
                        <div className={`sidebar-item ${activeTab === 'permissions' ? 'active' : ''}`} onClick={() => { setActiveTab('permissions'); if (isMobile) setMobileViewState('content'); }}>
                            Права доступа
                        </div>

                        <div style={{ flex: 1 }} />
                        <div className="sidebar-item danger" onClick={handleDelete}>
                            Удалить канал
                        </div>
                        {isMobile && <div className="sidebar-item" onClick={onClose} style={{ marginTop: 'auto', background: 'rgba(255,255,254,0.05)' }}>Закрыть</div>}
                    </div>
                )}

                {(!isMobile || mobileViewState === 'content') && (
                    <div className="channel-settings-content">
                        {isMobile ? (
                            <div className="mobile-settings-header" style={{ 
                                height: '56px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                padding: 'max(env(safe-area-inset-top), 40px) 16px 8px', 
                                borderBottom: '1px solid rgba(255,255,255,0.1)',
                                boxSizing: 'content-box',
                                background: 'rgba(0,0,0,0.2)',
                                backdropFilter: 'blur(10px)'
                            }}>
                                <button className="back-button" onClick={() => setMobileViewState('tabs')} style={{ marginRight: '16px' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                </button>
                                <span style={{ fontWeight: 800, fontSize: '16px' }}>
                                    {activeTab === 'overview' && 'Обзор'}
                                    {activeTab === 'permissions' && 'Права'}
                                </span>
                            </div>
                        ) : (
                            <div className="close-settings-button" onClick={onClose}>
                                <div className="close-icon-wrapper"><CloseIcon size={20} /></div>
                                <span className="close-text">ESC</span>
                            </div>
                        )}

                    <div className="content-scroll-area">
                        {activeTab === 'overview' && (
                            <div className="settings-section">
                                <h2 className="settings-title">Обзор</h2>

                                <div className="settings-input-group">
                                    <label>Название канала</label>
                                    <div className="input-wrapper-with-icon">
                                        <input
                                            className="settings-input"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            maxLength={100}
                                            placeholder="Напишите название..."
                                        />
                                        <span className="input-emoji-icon">✨</span>
                                    </div>
                                </div>

                                {channel.type === 'text' && (
                                    <>
                                        <div className="settings-divider" />
                                        <div className="settings-input-group">
                                            <label>Тема канала</label>
                                            <div className="textarea-container">
                                                <div className="textarea-toolbar">
                                                    <button title="Bold">B</button>
                                                    <button title="Italic">I</button>
                                                    <button title="Strike">S</button>
                                                    <button title="Code">{"< >"}</button>
                                                </div>
                                                <textarea
                                                    className="settings-textarea"
                                                    value={topic}
                                                    onChange={(e) => setTopic(e.target.value)}
                                                    placeholder="Расскажите всем, о чем этот канал..."
                                                    maxLength={1024}
                                                />
                                                <div className="textarea-footer">
                                                    <span className="char-counter">{1024 - topic.length} символов осталось</span>
                                                    <span className="input-emoji-icon" style={{ position: 'relative', top: 0, right: 0, transform: 'none' }}>😊</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="settings-divider" />
                                        <div className="settings-input-group">
                                            <label>Медленный режим</label>
                                            <div className="slow-mode-container">
                                                <div className="slow-mode-labels">
                                                    <span>Без задержки</span>
                                                    <span>6 часов</span>
                                                </div>
                                                <input type="range" min="0" max="10" step="1" className="slow-mode-slider" defaultValue="0" />
                                                <p className="settings-description">
                                                    Участники смогут отправлять сообщения только один раз в заданный промежуток времени.
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {channel.type === 'voice' && (
                                    <>
                                        <div className="settings-divider" />
                                        <div className="settings-input-group">
                                            <label>Битрейт — {bitrate} kbps</label>
                                            <div className="slow-mode-container">
                                                <div className="slow-mode-labels">
                                                    <span>8kbps</span>
                                                    <span>96kbps</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="8"
                                                    max="96"
                                                    step="8"
                                                    className="slow-mode-slider"
                                                    value={bitrate}
                                                    onChange={(e) => setBitrate(parseInt(e.target.value))}
                                                />
                                                <p className="settings-description">
                                                    Более высокий битрейт улучшает качество звука, но требует больше трафика.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="settings-divider" />
                                        <div className="settings-input-group">
                                            <label>Лимит пользователей — {userLimit === 0 ? 'Без лимита' : userLimit}</label>
                                            <div className="slow-mode-container">
                                                <div className="slow-mode-labels">
                                                    <span>0</span>
                                                    <span>99</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="99"
                                                    step="1"
                                                    className="slow-mode-slider"
                                                    value={userLimit}
                                                    onChange={(e) => setUserLimit(parseInt(e.target.value))}
                                                />
                                                <p className="settings-description">
                                                    Ограничьте количество пользователей, которые могут одновременно находиться в канале.
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 'permissions' && (
                            <div className="settings-section">
                                <h2 className="settings-title">Права доступа</h2>
                                <p className="settings-subtitle">Настройте, кто может видеть и взаимодействовать с этим каналом.</p>

                                <div className="private-channel-card">
                                    <div className="private-header">
                                        <div className="private-title-group">
                                            <div className="private-icon-lock">🛡️</div>
                                            <div className="private-text-group">
                                                <div className="private-title">Приватный канал</div>
                                                <div className="private-description">Только выбранные участники и роли смогут видеть этот канал.</div>
                                            </div>
                                        </div>
                                        <div
                                            className={`toggle-switch ${overwrites.find(o => String(o.id) === String(server._id))?.deny ? 'active' : ''}`}
                                            onClick={() => {
                                                const everyoneId = String(server._id);
                                                const existing = overwrites.find(o => String(o.id) === everyoneId);
                                                const isPrivate = !!existing?.deny;

                                                if (!isPrivate) {
                                                    updateOverwrite(everyoneId, 'role', 0n, Permissions.VIEW_CHANNEL);
                                                } else {
                                                    removeOverwrite(everyoneId);
                                                }
                                            }}
                                        >
                                            <div className="toggle-knob" />
                                        </div>
                                    </div>

                                    <div className="access-divider" />

                                    <div className="access-section">
                                        <div className="access-header">
                                            <span className="access-label">Доступ к каналу</span>
                                            <div className="add-access-container" style={{ position: 'relative' }}>
                                                <button className="add-access-btn" onClick={() => setShowAddAccessDropdown(!showAddAccessDropdown)}>
                                                    Добавить роли/участников
                                                </button>

                                                {showAddAccessDropdown && (
                                                    <div className="add-access-dropdown">
                                                        <div className="search-input-wrapper">
                                                            <input
                                                                type="text"
                                                                placeholder="Поиск..."
                                                                autoFocus
                                                                value={searchTerm}
                                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="dropdown-list">
                                                            <div className="dropdown-section-title">Роли</div>
                                                            {server.roles
                                                                .filter(r =>
                                                                    r.name !== '@everyone' &&
                                                                    !overwrites.find(o => String(o.id) === String(r._id)) &&
                                                                    r.name.toLowerCase().includes(searchTerm.toLowerCase())
                                                                )
                                                                .map(role => (
                                                                    <div key={role._id} className="dropdown-item" onClick={() => {
                                                                        updateOverwrite(String(role._id), 'role', Permissions.VIEW_CHANNEL, 0n);
                                                                        setShowAddAccessDropdown(false);
                                                                        setSearchTerm('');
                                                                    }}>
                                                                        <div className="role-shield-icon" style={{ background: role.color, width: 24, height: 24, fontSize: 12 }}>🛡️</div>
                                                                        <span>{role.name}</span>
                                                                    </div>
                                                                ))
                                                            }

                                                            <div className="dropdown-section-title">Участники</div>
                                                            {server.members
                                                                .filter(m => {
                                                                    const userId = String(m.user._id || m.user);
                                                                    const username = m.user.username || '';
                                                                    return !overwrites.find(o => String(o.id) === userId) &&
                                                                        username.toLowerCase().includes(searchTerm.toLowerCase());
                                                                })
                                                                .map(member => {
                                                                    const userId = String(member.user._id || member.user);
                                                                    return (
                                                                        <div key={userId} className="dropdown-item" onClick={() => {
                                                                            updateOverwrite(userId, 'member', Permissions.VIEW_CHANNEL, 0n);
                                                                            setShowAddAccessDropdown(false);
                                                                            setSearchTerm('');
                                                                        }}>
                                                                            <div className="member-avatar-mini" style={{ width: 24, height: 24 }}>
                                                                                {member.user.avatar ? <img src={getAvatarUrl(member.user.avatar)!} alt="" /> : <span>{member.user.username?.charAt(0)}</span>}
                                                                            </div>
                                                                            <span>{member.user.username}</span>
                                                                        </div>
                                                                    );
                                                                })
                                                            }
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="roles-access-list">
                                            <div className="access-list-header">Роли и участники с доступом</div>
                                            {overwrites.filter(o => String(o.id) !== String(server._id)).map(ow => {
                                                const role = server.roles.find(r => String(r._id) === String(ow.id));
                                                const member = !role ? server.members.find(m => String(m.user._id || m.user) === String(ow.id)) : null;

                                                if (!role && !member) return null;

                                                const name = role ? role.name : member?.user.username;
                                                const color = role ? role.color : '#b5bac1';
                                                const isAdmin = role ? (BigInt(role.permissions) & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR : false;

                                                return (
                                                    <div key={ow.id} className="role-access-item">
                                                        <div className="role-access-left">
                                                            {role ? (
                                                                <div className="role-shield-icon" style={{ background: color }}>🛡️</div>
                                                            ) : (
                                                                <div className="member-avatar-mini">
                                                                    {member?.user.avatar ? <img src={getAvatarUrl(member.user.avatar)!} alt="" /> : <span>{name?.charAt(0)}</span>}
                                                                </div>
                                                            )}
                                                            <span className="role-access-name">{name}</span>
                                                        </div>
                                                        <div className="role-access-right">
                                                            <span className="role-type-badge">{isAdmin ? 'Администратор' : (role ? 'Роль' : 'Участник')}</span>
                                                            <button className="remove-role-access" onClick={() => removeOverwrite(ow.id)}>✕</button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {isDirty && (
                        <div className="save-changes-bar slide-up">
                            <span className="save-changes-text">Осторожно! У вас есть несохраненные изменения!</span>
                            <div className="save-changes-buttons">
                                <button className="reset-button" onClick={() => {
                                    setName(channel.name);
                                    setTopic(channel.topic || '');
                                    setOverwrites(channel.permissionOverwrites || []);
                                }}>Сбросить</button>
                                <button className="save-button" onClick={handleSave} disabled={loading}>
                                    {loading ? 'Загрузка...' : 'Сохранить изменения'}
                                </button>
                            </div>
                        </div>
                    )}
                        </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default ChannelSettingsModal;
