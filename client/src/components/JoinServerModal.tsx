import React, { useState } from 'react';
import axios from 'axios';
import './SettingsModal.css'; // Reusing existing modal styles

interface JoinServerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onJoin: (server: any) => void;
    onCreate: (name: string) => void;
}

const JoinServerModal: React.FC<JoinServerModalProps> = ({ isOpen, onClose, onJoin, onCreate }) => {
    const [view, setView] = useState<'initial' | 'join' | 'create'>('initial');
    const [serverName, setServerName] = useState('');
    const [inviteLink, setInviteLink] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (serverName.trim()) {
            onCreate(serverName.trim());
            onClose();
        }
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Extract code from URL or raw code
            const code = inviteLink.split('/').pop();
            const response = await axios.post(`/api/invites/${code}/join`);
            onJoin(response.data);
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Не удалось присоединиться к серверу');
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 3000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
            <div className="glass-panel-base" onClick={e => e.stopPropagation()} style={{
                width: '100%',
                maxWidth: '480px',
                padding: '50px 40px',
                textAlign: 'center',
                boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
                margin: '20px',
                overflow: 'hidden'
            }}>
                {view === 'initial' && (
                    <>
                        <div style={{
                            width: '80px', height: '80px', background: 'var(--primary-neon)',
                            borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 30px', boxShadow: '0 15px 30px rgba(0, 229, 255, 0.3)'
                        }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
                                <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <h2 style={{ color: 'white', fontSize: '28px', fontWeight: 800, marginBottom: '15px' }}>Создайте свой мир</h2>
                        <p style={{ color: 'var(--text-dim)', marginBottom: '40px', fontSize: '15px', lineHeight: '1.6' }}>
                            Ваш сервер — это приватное пространство для общения с друзьями.
                            Выберите путь: объединитесь или создайте новое.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <button
                                className="neon-btn"
                                onClick={() => setView('create')}
                                style={{ padding: '18px', width: '100%' }}
                            >
                                Создать свой сервер
                            </button>
                            <button
                                className="test-action-btn"
                                onClick={() => setView('join')}
                                style={{ 
                                    padding: '18px', 
                                    width: '100%', 
                                    height: 'auto', 
                                    border: '1px solid var(--primary-neon)', 
                                    background: 'rgba(255,255,255,0.03)',
                                    color: 'var(--primary-neon)',
                                    fontWeight: 700,
                                    borderRadius: '16px',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                У меня есть приглашение
                            </button>
                        </div>
                    </>
                )}

                {view === 'create' && (
                    <form onSubmit={handleCreate}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', textAlign: 'left' }}>
                            <div onClick={() => setView('initial')} style={{ cursor: 'pointer', color: 'var(--text-dim)' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                            </div>
                            <h2 style={{ color: 'white', fontSize: '24px', fontWeight: 800, margin: 0 }}>Настройка сервера</h2>
                        </div>

                        <p style={{ color: 'var(--text-dim)', marginBottom: '30px', fontSize: '14px', textAlign: 'left' }}>
                            Дайте вашему серверу имя. Вы всегда сможете добавить иконку и изменить описание позже.
                        </p>

                        <div style={{ textAlign: 'left', marginBottom: '35px' }}>
                            <label className="auth-label-neon">НАЗВАНИЕ СЕРВЕРА</label>
                            <input
                                type="text"
                                className="auth-input-glass"
                                value={serverName}
                                onChange={(e) => setServerName(e.target.value)}
                                placeholder="Например: Cyber Bunker"
                                autoFocus
                                required
                            />
                        </div>

                        <button type="submit" className="neon-btn" style={{ width: '100%', padding: '18px' }} disabled={!serverName.trim()}>
                            Вперёд к звёздам
                        </button>
                    </form>
                )}

                {view === 'join' && (
                    <form onSubmit={handleJoin}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', textAlign: 'left' }}>
                            <div onClick={() => setView('initial')} style={{ cursor: 'pointer', color: 'var(--text-dim)' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                            </div>
                            <h2 style={{ color: 'white', fontSize: '24px', fontWeight: 800, margin: 0 }}>Присоединиться</h2>
                        </div>

                        <p style={{ color: 'var(--text-dim)', marginBottom: '30px', fontSize: '14px', textAlign: 'left' }}>
                            Введите ссылку-приглашение или код доступа, чтобы мгновенно оказаться на сервере.
                        </p>

                        <div style={{ textAlign: 'left', marginBottom: '35px' }}>
                            <label className="auth-label-neon">ИНВАЙТ-КОД ИЛИ ССЫЛКА</label>
                            <input
                                type="text"
                                className="auth-input-glass"
                                value={inviteLink}
                                onChange={(e) => setInviteLink(e.target.value)}
                                placeholder="h7f2kL или maxcord.fun/invite/..."
                                autoFocus
                                required
                            />
                            {error && <div style={{ color: 'var(--accent-pink)', fontSize: '13px', marginTop: '10px', textAlign: 'center' }}>{error}</div>}
                        </div>

                        <button type="submit" className="neon-btn" style={{ width: '100%', padding: '18px' }} disabled={!inviteLink.trim() || loading}>
                            {loading ? 'Синхронизация...' : 'Войти на сервер'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default JoinServerModal;
