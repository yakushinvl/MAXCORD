import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Server, User } from '../types';
import { getAvatarUrl } from '../utils/avatar';
import { CloseIcon, TrashIcon, PlusIcon, ChevronUpIcon, ChevronDownIcon, ChevronLeftIcon } from './Icons';
import ImageCropper from './ImageCropper';
import { Permissions, hasPermission, computePermissions } from '../utils/permissions';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import './ServerSettingsModal.css';

interface ServerSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    server: Server;
    onServerUpdate: (updatedServer: Server) => void;
    onServerDelete: (serverId: string) => void;
}

type SettingsTab = 'overview' | 'roles' | 'emojis' | 'members' | 'audit_log';

const PermissionMetadata: Record<string, { label: string; description: string; category: string }> = {
    ADMINISTRATOR: { category: 'ОСНОВНЫЕ ПРАВА', label: 'Администратор', description: 'Предоставляет все права доступа, а также позволяет обходить ограничения в каналах. Это опасное право.' },
    MANAGE_GUILD: { category: 'ОСНОВНЫЕ ПРАВА', label: 'Управление сервером', description: 'Позволяет менять название сервера, иконку, баннер и регион.' },
    MANAGE_ROLES: { category: 'ОСНОВНЫЕ ПРАВА', label: 'Управление ролями', description: 'Позволяет создавать новые роли и редактировать роли ниже этой.' },
    MANAGE_CHANNELS: { category: 'ОСНОВНЫЕ ПРАВА', label: 'Управление каналами', description: 'Позволяет создавать, редактировать и удалять каналы.' },
    VIEW_AUDIT_LOG: { category: 'ОСНОВНЫЕ ПРАВА', label: 'Просмотр журнала аудита', description: 'Позволяет видеть историю изменений на сервере.' },

    KICK_MEMBERS: { category: 'УПРАВЛЕНИЕ УЧАСТНИКАМИ', label: 'Исключать участников', description: 'Позволяет выгонять пользователей с сервера.' },
    BAN_MEMBERS: { category: 'УПРАВЛЕНИЕ УЧАСТНИКАМИ', label: 'Банить участников', description: 'Позволяет навсегда блокировать доступ пользователей к серверу.' },
    CREATE_INSTANT_INVITE: { category: 'УПРАВЛЕНИЕ УЧАСТНИКАМИ', label: 'Создание приглашения', description: 'Позволяет создавать ссылки для приглашения новых людей.' },
    CHANGE_NICKNAME: { category: 'УПРАВЛЕНИЕ УЧАСТНИКАМИ', label: 'Изменение никнейма', description: 'Позволяет пользователю менять свой никнейм на этом сервере.' },
    MANAGE_NICKNAMES: { category: 'УПРАВЛЕНИЕ УЧАСТНИКАМИ', label: 'Управление никнеймами', description: 'Позволяет менять никнеймы других участников.' },

    VIEW_CHANNEL: { category: 'ТЕКСТОВЫЕ КАНАЛЫ', label: 'Просмотр каналов', description: 'Позволяет видеть список каналов и читать сообщения.' },
    SEND_MESSAGES: { category: 'ТЕКСТОВЫЕ КАНАЛЫ', label: 'Отправка сообщений', description: 'Позволяет отправлять текстовые сообщения в каналы.' },
    MANAGE_MESSAGES: { category: 'ТЕКСТОВЫЕ КАНАЛЫ', label: 'Управление сообщениями', description: 'Позволяет удалять и закреплять сообщения других пользователей.' },
    EMBED_LINKS: { category: 'ТЕКСТОВЫЕ КАНАЛЫ', label: 'Встраивание ссылок', description: 'Ссылки в сообщениях будут преобразовываться в предпросмотр.' },
    ATTACH_FILES: { category: 'ТЕКСТОВЫЕ КАНАЛЫ', label: 'Отправка файлов', description: 'Позволяет загружать и отправлять файлы и изображения.' },
    READ_MESSAGE_HISTORY: { category: 'ТЕКСТОВЫЕ КАНАЛЫ', label: 'Чтение истории сообщений', description: 'Позволяет видеть сообщения, отправленные до входа в канал.' },
    MENTION_EVERYONE: { category: 'ТЕКСТОВЫЕ КАНАЛЫ', label: 'Упоминание @everyone', description: 'Позволяет использовать теги @everyone и @here для уведомления всех.' },
    ADD_REACTIONS: { category: 'ТЕКСТОВЫЕ КАНАЛЫ', label: 'Добавление реакций', description: 'Позволяет ставить эмодзи-реакции на сообщения.' },
    PIN_MESSAGES: { category: 'ТЕКСТОВЫЕ КАНАЛЫ', label: 'Закрепление сообщений', description: 'Позволяет закреплять и откреплять сообщения.' },

    CONNECT: { category: 'ГОЛОСОВЫЕ КАНАЛЫ', label: 'Подключение', description: 'Позволяет заходить в голосовые каналы.' },
    SPEAK: { category: 'ГОЛОСОВЫЕ КАНАЛЫ', label: 'Говорить', description: 'Позволяет говорить в голосовых каналах.' },
    STREAM: { category: 'ГОЛОСОВЫЕ КАНАЛЫ', label: 'Видеостриминг', description: 'Позволяет транслировать экран или включать камеру.' },
    MUTE_MEMBERS: { category: 'ГОЛОСОВЫЕ КАНАЛЫ', label: 'Отключать микрофон участников', description: 'Позволяет выключать микрофон другим людям в голосовом канале.' },
    DEAFEN_MEMBERS: { category: 'ГОЛОСОВЫЕ КАНАЛЫ', label: 'Отключать звук участникам', description: 'Позволяет выключать звук (наушники) другим людям.' },
    MOVE_MEMBERS: { category: 'ГОЛОСОВЫЕ КАНАЛЫ', label: 'Перемещать участников', description: 'Позволяет перетаскивать людей между голосовыми каналами.' },
};

const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
    isOpen,
    onClose,
    server,
    onServerUpdate,
    onServerDelete
}) => {
    const { user: currentUser } = useAuth();
    const { confirm, alert } = useDialog();
    const [activeTab, setActiveTab] = useState<SettingsTab>('overview');
    const isMobile = window.innerWidth <= 768;
    const [mobileViewState, setMobileViewState] = useState<'tabs' | 'content'>('tabs');
    const [serverName, setServerName] = useState(server.name);
    const [serverDescription, setServerDescription] = useState(server.description || '');
    const [serverIcon, setServerIcon] = useState(server.icon);
    const [serverBanner, setServerBanner] = useState(server.banner);
    const [bannerColor, setBannerColor] = useState(server.bannerColor || '#5865f2');
    const [hasChanges, setHasChanges] = useState(false);
    const [originalRoles, setOriginalRoles] = useState(server.roles || []);
    const [loading, setLoading] = useState(false);

    const [editingRole, setEditingRole] = useState<string | null>(null); // Role ID
    const [roles, setRoles] = useState(server.roles || []);
    const [members, setMembers] = useState(server.members);
    const [editingMemberRoles, setEditingMemberRoles] = useState<string | null>(null); // User ID

    const userPerms = currentUser ? computePermissions(currentUser._id, server) : 0n;
    const isOwner = (server.owner && (typeof server.owner === 'object' ? (server.owner as any)._id : server.owner)) === currentUser?._id;
    const canManageRoles = hasPermission(userPerms, Permissions.MANAGE_ROLES) || isOwner;
    const canViewAuditLog = hasPermission(userPerms, Permissions.VIEW_AUDIT_LOG) || isOwner;

    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [isAuditLoading, setIsAuditLoading] = useState(false);
    const [hasMoreAudit, setHasMoreAudit] = useState(true);

    const [cropModal, setCropModal] = useState<{
        isOpen: boolean;
        image: string;
        type: 'icon' | 'banner';
    }>({ isOpen: false, image: '', type: 'icon' });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const isRolesDirty = JSON.stringify(roles) !== JSON.stringify(originalRoles);

    useEffect(() => {
        setHasChanges(
            serverName !== server.name ||
            serverDescription !== (server.description || '') ||
            bannerColor !== (server.bannerColor || '#5865f2') ||
            isRolesDirty
        );
    }, [serverName, serverDescription, bannerColor, server.name, server.description, server.bannerColor, isRolesDirty]);

    useEffect(() => {
        setMembers(server.members);
    }, [server.members]);

    useEffect(() => {
        setRoles(server.roles || []);
        setOriginalRoles(server.roles || []);
    }, [server.roles]);

    useEffect(() => {
        setBannerColor(server.bannerColor || '#5865f2');
        if (activeTab === 'audit_log') fetchAuditLogs(true);
    }, [server, activeTab]);

    const fetchAuditLogs = async (refresh = false) => {
        if (!canViewAuditLog) return;
        setIsAuditLoading(true);
        try {
            const lastLog = !refresh && auditLogs.length > 0 ? auditLogs[auditLogs.length - 1] : null;
            const res = await axios.get(`/api/servers/${server._id}/audit-logs`, {
                params: {
                    limit: 30,
                    before: lastLog ? lastLog.createdAt : undefined
                }
            });
            if (refresh) {
                setAuditLogs(res.data);
            } else {
                setAuditLogs(prev => [...prev, ...res.data]);
            }
            setHasMoreAudit(res.data.length === 30);
        } catch (err) {
            console.error('Failed to fetch audit logs:', err);
        } finally {
            setIsAuditLoading(false);
        }
    };

    // Sync editingRole if it was a placeholder or if it's not found by ID but found by name (@everyone)
    useEffect(() => {
        if (editingRole && activeTab === 'roles' && roles.length > 0) {
            const currentRole = roles.find(r => String(r._id) === String(editingRole));
            if (!currentRole) {
                const everyone = roles.find(r => r.name === '@everyone');
                if (everyone) {
                    const isLikelyEveryone = editingRole === 'everyone' ||
                        editingRole === '0' ||
                        String(editingRole).length < 5 ||
                        everyone.name === '@everyone';

                    if (isLikelyEveryone) {
                        setEditingRole(everyone._id);
                    }
                }
            }
        }
    }, [roles, editingRole, activeTab]);

    const handleSaveGlobal = async () => {
        setLoading(true);
        try {
            // Save Overview
            if (serverName !== server.name || serverDescription !== (server.description || '') || bannerColor !== (server.bannerColor || '#5865f2')) {
                const res = await axios.put(`/api/servers/${server._id}`, {
                    name: serverName,
                    description: serverDescription,
                    bannerColor: bannerColor
                });
                onServerUpdate(res.data);
            }

            // Save Roles if dirty
            if (isRolesDirty) {
                // Find changed roles
                for (const role of roles) {
                    const originalRole = originalRoles.find(r => r._id === role._id);
                    if (originalRole && JSON.stringify(role) !== JSON.stringify(originalRole)) {
                        await axios.patch(`/api/servers/${server._id}/roles/${role._id}`, role);
                    }
                }
                const res = await axios.get(`/api/servers/${server._id}`);
                onServerUpdate(res.data);
                setOriginalRoles(res.data.roles);
            }

            setHasChanges(false);
        } catch (err) {
            await alert('Ошибка при сохранении настроек');
        } finally {
            setLoading(false);
        }
    };

    const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type === 'image/gif') {
            const formData = new FormData();
            formData.append('icon', file);
            try {
                setLoading(true);
                const res = await axios.post(`/api/servers/${server._id}/icon`, formData);
                setServerIcon(res.data.icon);
                onServerUpdate({ ...server, icon: res.data.icon });
            } catch (err) {
                await alert('Ошибка при загрузке иконки');
            } finally {
                setLoading(false);
            }
            return;
        }

        const reader = new FileReader();
        reader.onload = () => setCropModal({ isOpen: true, image: reader.result as string, type: 'icon' });
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type === 'image/gif') {
            const formData = new FormData();
            formData.append('banner', file);
            try {
                setLoading(true);
                const res = await axios.post(`/api/servers/${server._id}/banner`, formData);
                setServerBanner(res.data.banner);
                onServerUpdate({ ...server, banner: res.data.banner });
            } catch (err) {
                await alert('Ошибка при загрузке баннера');
            } finally {
                setLoading(false);
            }
            return;
        }

        const reader = new FileReader();
        reader.onload = () => setCropModal({ isOpen: true, image: reader.result as string, type: 'banner' });
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        const type = cropModal.type;
        setCropModal(prev => ({ ...prev, isOpen: false }));
        const formData = new FormData();
        formData.append(type === 'icon' ? 'icon' : 'banner', croppedBlob, `${type}.jpg`);

        try {
            setLoading(true);
            const endpoint = `/api/servers/${server._id}/${type === 'icon' ? 'icon' : 'banner'}`;
            const res = await axios.post(endpoint, formData);
            if (type === 'icon') {
                setServerIcon(res.data.icon);
                onServerUpdate({ ...server, icon: res.data.icon });
            } else {
                setServerBanner(res.data.banner);
                onServerUpdate({ ...server, banner: res.data.banner });
            }
        } catch (err) {
            await alert(`Ошибка при загрузке ${type === 'icon' ? 'иконки' : 'баннера'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteServer = async () => {
        if (await confirm('Вы уверены, что хотите удалить сервер? Это действие необратимо.')) {
            try {
                await axios.delete(`/api/servers/${server._id}`);
                onServerDelete(server._id);
                onClose();
            } catch (err) {
                await alert('Ошибка при удалении сервера');
            }
        }
    };

    const handleKickMember = async (userId: string) => {
        if (await confirm('Выгнать этого участника?')) {
            try {
                await axios.delete(`/api/servers/${server._id}/members/${userId}`);
                setMembers(members.filter(m => (m.user as any)._id !== userId));
            } catch (err) { }
        }
    };

    const handleCreateRole = async () => {
        try {
            const res = await axios.post(`/api/servers/${server._id}/roles`, { name: 'New Role' });
            const newRole = res.data;
            setRoles([...roles, newRole]);
            onServerUpdate({ ...server, roles: [...roles, newRole] });
            setEditingRole(newRole._id);
        } catch (err) { await alert('Ошибка при создании роли'); }
    };

    const handleUpdateRole = (roleId: string | null, updates: any) => {
        if (!roleId) return;

        let resolvedId = roleId;
        const currentRole = roles.find(r =>
            String(r._id) === String(roleId) ||
            (r.name === '@everyone' && (roleId === 'everyone' || roleId === '0' || String(roleId).length < 5))
        );

        if (currentRole && currentRole._id) {
            resolvedId = currentRole._id;
        }

        setRoles(prev => prev.map(r => (String(r._id) === String(resolvedId)) ? { ...r, ...updates } : r));
    };

    const handleDeleteRole = async (roleId: string | null) => {
        if (!roleId) return;
        if (!(await confirm('Удалить эту роль?'))) return;
        try {
            await axios.delete(`/api/servers/${server._id}/roles/${roleId}`);
            const updatedRoles = roles.filter(r => r._id !== roleId);
            setRoles(updatedRoles);
            onServerUpdate({ ...server, roles: updatedRoles });
            if (editingRole === roleId) setEditingRole(null);
        } catch (err) { await alert('Ошибка при удалении роли'); }
    };

    const handleToggleMemberRole = async (userId: string, roleId: string) => {
        const member = members.find(m => (m.user as any)._id === userId);
        if (!member) return;

        const currentRoles = member.roles || [];
        const newRoles = currentRoles.includes(roleId)
            ? currentRoles.filter(id => id !== roleId)
            : [...currentRoles, roleId];

        try {
            const res = await axios.put(`/api/servers/${server._id}/members/${userId}`, { roles: newRoles });
            const updatedMembers = members.map(m => (m.user as any)._id === userId ? { ...m, roles: res.data.roles } : m);
            setMembers(updatedMembers);
            onServerUpdate({ ...server, members: updatedMembers });
        } catch (err) { await alert('Ошибка при обновлении ролей участника'); }
    };

    const handleMoveRole = async (roleId: string, direction: 'up' | 'down') => {
        const sortedRoles = [...roles].sort((a, b) => b.position - a.position);
        const currentIndex = sortedRoles.findIndex(r => r._id === roleId);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= sortedRoles.length) return;

        const targetRole = sortedRoles[targetIndex];
        const tempPos = sortedRoles[currentIndex].position;

        const updates = [
            { id: roleId, position: targetRole.position },
            { id: targetRole._id, position: sortedRoles[currentIndex].position }
        ];

        const newRoles = roles.map(r => {
            if (r._id === roleId) return { ...r, position: targetRole.position };
            if (r._id === targetRole._id) return { ...r, position: sortedRoles[currentIndex].position };
            return r;
        });
        setRoles(newRoles);

        try {
            await axios.patch(`/api/servers/${server._id}/roles/positions`, { roles: updates });
            onServerUpdate({ ...server, roles: newRoles });
        } catch (err) {
            setRoles(roles);
            await alert('Не удалось переместить роль');
        }
    };

    if (!isOpen) return null;

    const modalContent = (
        <div className="server-settings-modal-overlay">
            <div className="server-settings-modal">
                {(!isMobile || mobileViewState === 'tabs') && (
                    <div className="server-settings-sidebar">
                        <div className="sidebar-header">{server.name}</div>
                        <div className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => { setActiveTab('overview'); setEditingRole(null); if (isMobile) setMobileViewState('content'); }}>Обзор</div>
                        <div className={`sidebar-item ${activeTab === 'roles' ? 'active' : ''}`} onClick={() => { setActiveTab('roles'); setEditingRole(null); if (isMobile) setMobileViewState('content'); }}>Роли</div>
                        <div className={`sidebar-item ${activeTab === 'emojis' ? 'active' : ''}`} onClick={() => { setActiveTab('emojis'); setEditingRole(null); if (isMobile) setMobileViewState('content'); }}>Эмодзи</div>
                        {canViewAuditLog && <div className={`sidebar-item ${activeTab === 'audit_log' ? 'active' : ''}`} onClick={() => { setActiveTab('audit_log'); setEditingRole(null); if (isMobile) setMobileViewState('content'); }}>Журнал аудита</div>}
                        <div className="sidebar-header">Управление</div>
                        <div className={`sidebar-item ${activeTab === 'members' ? 'active' : ''}`} onClick={() => { setActiveTab('members'); setEditingRole(null); if (isMobile) setMobileViewState('content'); }}>Участники</div>
                        <div style={{ flex: 1 }} />
                        {isOwner && <div className="sidebar-item danger" onClick={handleDeleteServer}>Удалить сервер</div>}
                        {isMobile && <div className="sidebar-item" onClick={onClose} style={{ marginTop: 'auto', background: 'rgba(255,255,254,0.05)' }}>Закрыть</div>}
                    </div>
                )}

                {(!isMobile || mobileViewState === 'content') && (
                    <div className="server-settings-content">
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
                                <span style={{ fontWeight: 800, fontSize: '18px' }}>
                                    {activeTab === 'overview' && 'Обзор'}
                                    {activeTab === 'roles' && 'Роли'}
                                    {activeTab === 'emojis' && 'Эмодзи'}
                                    {activeTab === 'audit_log' && 'Аудит'}
                                    {activeTab === 'members' && 'Участники'}
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
                                <h2>Обзор сервера</h2>
                                <div className="overview-grid">
                                    <div className="avatar-upload-section">
                                        <div className="server-avatar-preview" onClick={() => fileInputRef.current?.click()}>
                                            {getAvatarUrl(serverIcon) ? (
                                                <img src={getAvatarUrl(serverIcon)!} alt="" />
                                            ) : (
                                                <div className="avatar-placeholder">{serverName ? serverName.charAt(0).toUpperCase() : '?'}</div>
                                            )}
                                            <div className="avatar-overlay">
                                                <PlusIcon size={32} color="white" />
                                            </div>
                                        </div>
                                        <div className="avatar-hint">СМЕНИТЬ ИКОНКУ</div>
                                        <input type="file" ref={fileInputRef} onChange={handleIconUpload} style={{ display: 'none' }} accept="image/*" />
                                    </div>
                                    <div className="input-section">
                                        <div className="settings-input-group">
                                            <label>Название сервера</label>
                                            <input className="settings-input" value={serverName} onChange={(e) => setServerName(e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                <div className="banner-settings-section">
                                    <div className="banner-upload-group">
                                        <h3>Баннер сервера</h3>
                                        <p>Это изображение будет отображаться в верхней части списка каналов.</p>
                                        <div
                                            className="banner-preview-small"
                                            onClick={() => bannerInputRef.current?.click()}
                                            style={serverBanner ? { backgroundImage: `url(${getAvatarUrl(serverBanner)})`, border: 'none' } : {}}
                                        >
                                            {!serverBanner && 'Загрузить баннер'}
                                        </div>
                                        <input type="file" ref={bannerInputRef} onChange={handleBannerUpload} style={{ display: 'none' }} accept="image/*" />
                                    </div>

                                    <div className="banner-color-group">
                                        <label>Цвет баннера</label>
                                        <div className="color-picker-row">
                                            <div className="role-color-editor">
                                                <input type="color" value={bannerColor} onChange={(e) => setBannerColor(e.target.value)} />
                                                <input type="text" className="settings-input" value={bannerColor} onChange={(e) => setBannerColor(e.target.value)} style={{ width: '120px' }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>


                            </div>
                        )}

                        {activeTab === 'roles' && (
                            <div className="settings-section roles-tab">
                                {editingRole ? (
                                    (() => {
                                        let currentRole = roles.find(r => String(r._id) === String(editingRole));
                                        if (!currentRole) {
                                            const everyone = roles.find(r => r.name === '@everyone');
                                            if (everyone && (editingRole === 'everyone' || editingRole === '0' || String(editingRole).length < 5)) {
                                                currentRole = everyone;
                                            }
                                        }
                                        if (!currentRole && roles.length > 0) {
                                            const everyone = roles.find(r => r.name === '@everyone');
                                            if (everyone && (editingRole === everyone._id || String(editingRole).includes('everyone'))) {
                                                currentRole = everyone;
                                            }
                                        }

                                        if (!currentRole) return (
                                            <div className="role-editor-container">
                                                <button className="back-button-liquid" onClick={() => setEditingRole(null)}>
                                                    <div className="back-button-icon-wrapper">
                                                        <ChevronLeftIcon size={18} />
                                                    </div>
                                                    <span className="back-button-text">Все роли</span>
                                                </button>
                                                <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>Загрузка...</div>
                                            </div>
                                        );

                                        return (
                                            <div className="role-editor-container">
                                                <div className="role-editor-header">
                                                    <button className="back-button-liquid" onClick={() => setEditingRole(null)}>
                                                        <div className="back-button-icon-wrapper">
                                                            <ChevronLeftIcon size={18} />
                                                        </div>
                                                        <span className="back-button-text">Все роли</span>
                                                    </button>
                                                    <div className="editor-title">
                                                        <h2>{currentRole.name}</h2>
                                                        <span className="editor-subtitle">Редактирование роли</span>
                                                    </div>
                                                </div>

                                                <div className="role-editor-scrollable">
                                                    <div className="settings-input-group">
                                                        <label>Название роли</label>
                                                        <input
                                                            className="settings-input"
                                                            value={currentRole.name || ''}
                                                            onChange={(e) => handleUpdateRole(editingRole, { name: e.target.value })}
                                                            disabled={currentRole.name === '@everyone'}
                                                        />
                                                    </div>

                                                    <div className="settings-input-group">
                                                        <label>Цвет роли</label>
                                                        <div className="role-color-editor">
                                                            <input
                                                                type="color"
                                                                value={currentRole.color || '#99aab5'}
                                                                onChange={(e) => handleUpdateRole(editingRole, { color: e.target.value })}
                                                            />
                                                            <input
                                                                className="settings-input"
                                                                value={currentRole.color || '#99aab5'}
                                                                onChange={(e) => handleUpdateRole(editingRole, { color: e.target.value })}
                                                                style={{ width: '120px' }}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="permission-item">
                                                        <div className="permission-info">
                                                            <div className="permission-name">Показывать отдельно</div>
                                                            <div className="permission-description">Участники будут отображаться в отдельной категории.</div>
                                                        </div>
                                                        <label className="switch">
                                                            <input
                                                                type="checkbox"
                                                                checked={currentRole.hoist || false}
                                                                onChange={(e) => handleUpdateRole(editingRole, { hoist: e.target.checked })}
                                                            />
                                                            <span className="slider round"></span>
                                                        </label>
                                                    </div>

                                                    <div className="permissions-group-container">
                                                        {Array.from(new Set(Object.values(PermissionMetadata).map(m => m.category))).map(category => (
                                                            <div key={category} className="permission-category-wrapper">
                                                                <div className="permissions-divider">{category}</div>
                                                                <div className="permissions-list">
                                                                    {Object.entries(PermissionMetadata)
                                                                        .filter(([_, data]) => data.category === category)
                                                                        .map(([key, data]) => {
                                                                            const bit = (Permissions as any)[key];
                                                                            const hasPerm = hasPermission(BigInt(currentRole!.permissions || '0'), bit);
                                                                            return (
                                                                                <div key={key} className="permission-item">
                                                                                    <div className="permission-info">
                                                                                        <div className="permission-name">{data.label}</div>
                                                                                        <div className="permission-description">{data.description}</div>
                                                                                    </div>
                                                                                    <label className="switch">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={hasPerm}
                                                                                            onChange={(e) => {
                                                                                                const currentPerms = BigInt(currentRole!.permissions || '0');
                                                                                                const newPerms = e.target.checked ? currentPerms | bit : currentPerms & ~BigInt(bit);
                                                                                                handleUpdateRole(editingRole!, { permissions: newPerms.toString() });
                                                                                            }}
                                                                                        />
                                                                                        <span className="slider round"></span>
                                                                                    </label>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {currentRole.name !== '@everyone' && (
                                                        <div className="role-editor-footer">
                                                            <button className="reset-button delete-role-btn" onClick={() => handleDeleteRole(editingRole!)} style={{ color: '#ff3b30', border: '1px solid rgba(255, 59, 48, 0.3)', padding: '12px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <TrashIcon size={16} />
                                                                Удалить роль
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <>
                                        <div className="roles-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                            <h2>Роли сервера</h2>
                                            <button className="save-button" onClick={handleCreateRole}><PlusIcon size={16} /> Создать роль</button>
                                        </div>
                                        <div className="role-list">
                                            {[...roles].sort((a, b) => b.position - a.position).map(role => (
                                                <div key={role._id} className="role-item" onClick={() => setEditingRole(role._id)} style={{ cursor: 'pointer' }}>
                                                    <div className="role-name-container" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div className="role-dot" style={{ backgroundColor: role.color }} />
                                                        <span style={{ color: role.color, fontWeight: 700 }}>{role.name}</span>
                                                    </div>
                                                    <div className="role-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <button className="action-button" onClick={(e: any) => { e.stopPropagation(); handleMoveRole(role._id, 'up'); }} style={{ width: '24px', height: '24px' }}><ChevronUpIcon size={10} /></button>
                                                            <button className="action-button" onClick={(e: any) => { e.stopPropagation(); handleMoveRole(role._id, 'down'); }} style={{ width: '24px', height: '24px' }}><ChevronDownIcon size={10} /></button>
                                                        </div>
                                                        <button className="action-button danger" onClick={(e: any) => { e.stopPropagation(); handleDeleteRole(role._id); }}><TrashIcon size={16} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 'emojis' && (
                            <div className="settings-section emojis-tab">
                                <div className="roles-header" style={{ marginBottom: '16px' }}>
                                    <h2>Эмодзи сервера</h2>
                                    <p style={{ opacity: 0.6, fontSize: '14px', marginTop: '8px' }}>
                                        Добавьте до 50 пользовательских эмодзи, которыми сможет пользоваться любой участник этого сервера.
                                    </p>
                                </div>

                                <div className="emoji-upload-area" style={{ marginBottom: '32px' }}>
                                    <button
                                        className="save-button"
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.onchange = async (e: any) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;

                                                const formData = new FormData();
                                                formData.append('emoji', file);
                                                formData.append('name', file.name.split('.')[0].replace(/[^a-zA-Z0-9_]/g, ''));

                                                try {
                                                    setLoading(true);
                                                    const res = await axios.post(`/api/servers/${server._id}/emojis`, formData);
                                                    onServerUpdate(res.data);
                                                } catch (err: any) {
                                                    await alert(err.response?.data?.message || 'Ошибка при загрузке эмодзи');
                                                } finally {
                                                    setLoading(false);
                                                }
                                            };
                                            input.click();
                                        }}
                                        disabled={loading}
                                    >
                                        <PlusIcon size={16} /> Загрузить эмодзи
                                    </button>
                                </div>

                                <div className="server-emojis-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '20px' }}>
                                    {(server.emojis || []).map(emoji => (
                                        <div key={emoji.id} className="server-emoji-card" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'relative' }}>
                                            <img src={getAvatarUrl(emoji.url)!} alt={emoji.name} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                                            <span style={{ fontSize: '12px', fontWeight: 600, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>:{emoji.name}:</span>
                                            <button
                                                className="action-button danger mini"
                                                style={{ position: 'absolute', top: '4px', right: '4px', padding: '4px' }}
                                                onClick={async () => {
                                                    if (await confirm(`Удалить эмодзи :${emoji.name}:?`)) {
                                                        try {
                                                            setLoading(true);
                                                            const res = await axios.delete(`/api/servers/${server._id}/emojis/${emoji.id}`);
                                                            onServerUpdate(res.data);
                                                        } catch (err) {
                                                            await alert('Ошибка при удалении эмодзи');
                                                        } finally {
                                                            setLoading(false);
                                                        }
                                                    }
                                                }}
                                            >
                                                <TrashIcon size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {(server.emojis || []).length === 0 && (
                                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                                            У вас пока нет пользовательских эмодзи.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'audit_log' && (
                            <div className="settings-section audit-tab">
                                <h2>Журнал аудита</h2>
                                <p style={{ opacity: 0.6, fontSize: '14px', marginBottom: '32px' }}>
                                    Здесь отображаются все административные действия, совершенные на этом сервере.
                                </p>
                                <div className="audit-logs-list">
                                    {auditLogs.map(log => (
                                        <div key={log._id} className="audit-log-item">
                                            <div className="audit-log-header">
                                                <div className="audit-log-avatar">
                                                    {getAvatarUrl(log.executor?.avatar) ? <img src={getAvatarUrl(log.executor?.avatar)!} alt="" /> : <span>{log.executor?.username?.charAt(0).toUpperCase()}</span>}
                                                </div>
                                                <div className="audit-log-text">
                                                    <div className="audit-log-main">
                                                        <strong>{log.executor?.username}</strong> 
                                                        <span className="audit-action-text"> {formatAuditAction(log.action)} </span>
                                                        {log.target && <span className="audit-target">{(log.target as any).username || (log.target as any).name || (log.target as any).content}</span>}
                                                    </div>
                                                    <div className="audit-log-date">{new Date(log.createdAt).toLocaleString('ru-RU')}</div>
                                                </div>
                                            </div>
                                            {log.changes && log.changes.length > 0 && (
                                                <div className="audit-log-changes">
                                                    {log.changes.map((c: any, i: number) => (
                                                        <div key={i} className="audit-change-entry">
                                                            <span className="change-key">{translateKey(c.key)}:</span>
                                                            {c.oldValue !== undefined && <span className="change-old">{String(c.oldValue)}</span>}
                                                            <span className="change-arrow">→</span>
                                                            <span className="change-new">{String(c.newValue)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {log.reason && <div className="audit-log-reason">Причина: {log.reason}</div>}
                                        </div>
                                    ))}
                                    {auditLogs.length === 0 && !isAuditLoading && (
                                        <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>Журнал пуст.</div>
                                    )}
                                    {hasMoreAudit && (
                                        <button className="load-more-btn-simple" onClick={() => fetchAuditLogs()} disabled={isAuditLoading}>
                                            {isAuditLoading ? 'Загрузка...' : 'Загрузить еще'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                        {activeTab === 'members' && (
                            <div className="settings-section">
                                <h2>Участники ({members.length})</h2>
                                <div className="members-list-settings">
                                    {members.map((member: any) => (
                                        <div key={member.user._id} className="member-row-wrapper">
                                            <div className="member-row" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div className="member-user-info" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    <div className="member-avatar-small">
                                                        {getAvatarUrl(member.user.avatar) ? <img src={getAvatarUrl(member.user.avatar)!} alt="" /> : <span>{member.user.username.charAt(0).toUpperCase()}</span>}
                                                    </div>
                                                    <div className="member-meta">
                                                        <span style={{ fontWeight: 700, fontSize: '16px' }}>{member.nickname || member.user.username}</span>
                                                        <div className="member-roles-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                                            {(member.roles || []).map((rid: string) => {
                                                                const r = roles.find(ro => ro._id === rid);
                                                                if (!r) return null;
                                                                return (
                                                                    <div key={rid} className="role-tag" style={{ color: r.color, borderColor: r.color + '44' }}>
                                                                        {r.name}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="member-actions" style={{ display: 'flex', gap: '10px' }}>
                                                    <button className="action-button" onClick={() => setEditingMemberRoles(editingMemberRoles === member.user._id ? null : member.user._id)}>
                                                        <PlusIcon size={18} />
                                                    </button>
                                                    <button className="action-button danger" onClick={() => handleKickMember(member.user._id)}><TrashIcon size={18} /></button>
                                                </div>
                                            </div>
                                            {editingMemberRoles === member.user._id && (
                                                <div className="member-role-editor" style={{ padding: '20px', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <h4 style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '16px', color: 'rgba(255,255,255,0.4)' }}>Управление ролями</h4>
                                                    <div className="role-selection-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                                                        {roles.filter(r => r.name !== '@everyone').map(role => (
                                                            <div
                                                                key={role._id}
                                                                className={`role-select-item ${member.roles?.includes(role._id) ? 'selected' : ''}`}
                                                                onClick={() => handleToggleMemberRole(member.user._id, role._id)}
                                                                style={{
                                                                    padding: '10px 14px', borderRadius: '10px', background: member.roles?.includes(role._id) ? 'rgba(0,229,255,0.1)' : 'rgba(255,255,255,0.03)',
                                                                    border: '1px solid', borderColor: member.roles?.includes(role._id) ? 'var(--primary-neon)' : 'rgba(255,255,255,0.1)', cursor: 'pointer',
                                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                                                }}
                                                            >
                                                                <span style={{ color: role.color, fontWeight: 700, fontSize: '13px' }}>{role.name}</span>
                                                                {member.roles?.includes(role._id) && <span style={{ color: 'var(--primary-neon)', fontWeight: 800 }}>✓</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {hasChanges && (
                        <div className="save-changes-bar slide-up">
                            <span className="save-changes-text">Осторожно! У вас есть несохраненные изменения!</span>
                            <div className="save-changes-buttons">
                                <button className="reset-button" onClick={() => {
                                    setServerName(server.name);
                                    setServerDescription(server.description || '');
                                    setBannerColor(server.bannerColor || '#5865f2');
                                    setRoles(originalRoles);
                                }}>Сбросить</button>
                                <button className="save-button" onClick={handleSaveGlobal} disabled={loading}>
                                    {loading ? 'Загрузка...' : 'Сохранить изменения'}
                                </button>
                            </div>
                        </div>
                    )}
                    </div>
                )}
            </div>
            {cropModal.isOpen && <ImageCropper image={cropModal.image} onCropComplete={handleCropComplete} onCancel={() => setCropModal(prev => ({ ...prev, isOpen: false }))} aspect={cropModal.type === 'icon' ? 1 : 16 / 9} />}
        </div>
    );

    return createPortal(modalContent, document.body);
};

const formatAuditAction = (action: string) => {
    const actions: Record<string, string> = {
        'SERVER_UPDATE': 'обновил настройки сервера',
        'CHANNEL_CREATE': 'создал канал',
        'CHANNEL_UPDATE': 'изменил канал',
        'CHANNEL_DELETE': 'удалил канал',
        'MEMBER_KICK': 'выгнал пользователя',
        'MEMBER_BAN': 'забанил пользователя',
        'MEMBER_UNBAN': 'разбанил пользователя',
        'MEMBER_UPDATE': 'обновил профиль участника',
        'ROLE_CREATE': 'создал роль',
        'ROLE_UPDATE': 'изменил роль',
        'ROLE_DELETE': 'удалил роль',
        'INVITE_CREATE': 'создал приглашение',
        'INVITE_DELETE': 'удалил приглашение',
        'MESSAGE_DELETE': 'удалил сообщение',
        'MESSAGE_PIN': 'закрепил сообщение',
        'MESSAGE_UNPIN': 'открепил сообщение',
        'EMOJI_CREATE': 'добавил эмодзи',
        'EMOJI_DELETE': 'удалил эмодзи',
        'MEMBER_VOICE_KICK': 'выгнал из голосового канала',
        'MEMBER_VOICE_SELF_STATE': 'изменил состояние микрофона/звука',
        'MEMBER_VOICE_SERVER_MUTE': 'отключил микрофон участнику (сервер)',
        'MEMBER_VOICE_SERVER_DEAFEN': 'отключил звук участнику (сервер)'
    };
    return actions[action] || action;
};

const translateKey = (key: string) => {
    const keys: Record<string, string> = {
        'name': 'Название',
        'description': 'Описание',
        'icon': 'Иконка',
        'banner': 'Баннер',
        'permissions': 'Права',
        'color': 'Цвет',
        'hoist': 'Отображение',
        'topic': 'Тема',
        'roles': 'Роли',
        'nickname': 'Никнейм',
        'isMuted': 'Микрофон',
        'isDeafened': 'Звук',
        'isServerMuted': 'Микрофон (сервер)',
        'isServerDeafened': 'Звук (сервер)'
    };
    return keys[key] || key;
};

export default ServerSettingsModal;
