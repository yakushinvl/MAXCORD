import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getFullUrl } from '../utils/avatar';
import { BotIcon, LayoutGridIcon, PlusIcon, MonitorIcon } from './Icons';
import { useDialog } from '../contexts/DialogContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { User } from '../types';
import ActiveContacts from './ActiveContacts';
import './ShowcaseView.css';

interface ShowcaseViewProps {
    onOpenMiniApp: (app: any) => void;
    onBack?: () => void;
    isMobile?: boolean;
    friends?: User[];
    onUserClick?: (userId: string, event?: React.MouseEvent) => void;
}

const ShowcaseView: React.FC<ShowcaseViewProps> = ({ onOpenMiniApp, onBack, isMobile, friends = [], onUserClick = () => {} }) => {
    const { user: currentUser } = useAuth();
    const { socket } = useSocket();
    const [activeTab, setActiveTab] = useState<'all' | 'bots' | 'miniapps'>('all');
    const [showcaseData, setShowcaseData] = useState<{ bots: any[], miniApps: any[] }>({ bots: [], miniApps: [] });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [userServers, setUserServers] = useState<any[]>([]);
    const [showServerSelect, setShowServerSelect] = useState<string | null>(null);
    const { alert, prompt } = useDialog();

    const reportItem = async (type: 'bot' | 'miniapp', id: string, name: string) => {
        const description = await prompt(`Пожаловаться на «${name}». Опиши проблему:`, '');
        if (!description) return;
        try {
            await axios.post('/api/moderation/report', {
                [type === 'bot' ? 'userId' : 'miniAppId']: id,
                reason: 'inappropriate_content',
                description,
            });
            await alert('Спасибо! Жалоба отправлена модераторам.');
        } catch (e: any) {
            await alert('Не удалось отправить жалобу: ' + (e?.response?.data?.message || 'ошибка'));
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [showcaseRes, serversRes] = await Promise.all([
                    axios.get('/api/showcase'),
                    axios.get('/api/servers/me')
                ]);
                setShowcaseData(showcaseRes.data);
                setUserServers(serversRes.data);
            } catch (err) {
                console.error('Failed to fetch showcase data', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const addBotToServer = async (botId: string, serverId: string) => {
        try {
            await axios.post(`/api/bots/${botId}/add-to-server`, { serverId });
            await alert('Бот успешно добавлен на сервер!');
            setShowServerSelect(null);
        } catch (e: any) {
            await alert(e.response?.data?.message || 'Ошибка при добавлении бота');
        }
    };

    const handleOpenApp = (app: any) => {
        // Activity is computed centrally in Main based on game vs open mini-apps.
        onOpenMiniApp(app);
    };

    const filteredBots = showcaseData.bots.filter(b => b.username.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredApps = showcaseData.miniApps.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const renderBotCard = (bot: any) => (
        <div key={bot._id} className="showcase-profile-card">
            <div 
                className="profile-card-banner" 
                style={{ backgroundImage: bot.banner ? `url(${getFullUrl(bot.banner)})` : 'none', backgroundColor: 'var(--primary-neon)' }}
            >
                <div className="profile-card-badge bot">Бот</div>
            </div>
            <div className="profile-card-content">
                <div className="profile-card-header">
                    <div className="profile-card-avatar">
                        {bot.avatar ? <img src={getFullUrl(bot.avatar)!} alt="" /> : <BotIcon size={28} color="var(--primary-neon)" />}
                    </div>
                    <div className="profile-card-main-info">
                        <div className="profile-card-name">{bot.username}</div>
                        <div className="profile-card-bio">{bot.bio || 'У этого бота пока нет описания.'}</div>
                    </div>
                </div>
                <div className="profile-card-actions">
                    <button
                        className="report-icon-btn"
                        title="Пожаловаться"
                        onClick={(e) => { e.stopPropagation(); reportItem('bot', bot._id, bot.username); }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                            <line x1="4" y1="22" x2="4" y2="15"/>
                        </svg>
                    </button>
                    <div className="action-button-container">
                        <button className="profile-action-btn primary" onClick={() => setShowServerSelect(showServerSelect === bot._id ? null : bot._id)}>
                            <PlusIcon size={18} />
                            <span>Добавить</span>
                        </button>
                        {showServerSelect === bot._id && (
                            <div className="card-server-selector custom-scrollbar">
                                {userServers.map(server => (
                                    <div key={server._id} className="server-option" onClick={() => addBotToServer(bot._id, server._id)}>
                                        {server.name}
                                    </div>
                                ))}
                                {userServers.length === 0 && <div className="server-option" style={{ opacity: 0.5, cursor: 'default' }}>Нет серверов</div>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderAppCard = (app: any) => (
        <div key={app._id} className="showcase-profile-card">
            <div 
                className="profile-card-banner" 
                style={{ backgroundImage: app.banner ? `url(${getFullUrl(app.banner)})` : 'none', backgroundColor: 'var(--secondary-neon)' }}
            >
                <div className="profile-card-badge app">Приложение</div>
            </div>
            <div className="profile-card-content">
                <div className="profile-card-header">
                    <div className="profile-card-avatar">
                        {app.avatar ? <img src={getFullUrl(app.avatar)!} alt="" /> : <LayoutGridIcon size={28} color="var(--secondary-neon)" />}
                    </div>
                    <div className="profile-card-main-info">
                        <div className="profile-card-name">{app.name}</div>
                        <div className="profile-card-bio">{app.description || 'У этого приложения пока нет описания.'}</div>
                    </div>
                </div>
                <div className="profile-card-actions">
                    <button
                        className="report-icon-btn"
                        title="Пожаловаться"
                        onClick={(e) => { e.stopPropagation(); reportItem('miniapp', app._id, app.name); }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                            <line x1="4" y1="22" x2="4" y2="15"/>
                        </svg>
                    </button>
                    <button className="profile-action-btn secondary" onClick={() => handleOpenApp(app)}>
                        <MonitorIcon size={18} />
                        <span>Открыть</span>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="showcase-panel">
            <div className="showcase-hero-bg" aria-hidden="true">
                <div className="showcase-hero-blob showcase-hero-blob--cyan" />
                <div className="showcase-hero-blob showcase-hero-blob--purple" />
                <div className="showcase-hero-blob showcase-hero-blob--pink" />
                <svg className="showcase-hero-wave showcase-hero-wave--cyan" viewBox="0 0 1200 400" preserveAspectRatio="none">
                    <path d="M0,200 C200,80 400,320 600,200 C800,80 1000,320 1200,200" />
                </svg>
                <svg className="showcase-hero-wave showcase-hero-wave--purple" viewBox="0 0 1200 400" preserveAspectRatio="none">
                    <path d="M0,220 C300,140 500,280 700,180 C900,100 1100,260 1200,220" />
                </svg>
                <div className="showcase-hero-orb">
                    <div className="showcase-hero-orb__ring" />
                    <div className="showcase-hero-orb__core" />
                </div>
            </div>

            <div className="showcase-main-container">
                <div className="showcase-left-section">
                    {isMobile && onBack && (
                        <div className="showcase-mobile-header" style={{ display: 'flex', alignItems: 'center', padding: '12px 18px', flexShrink: 0 }}>
                            <button className="back-button" onClick={onBack} title="Назад" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', color: '#fff', width: '36px', height: '36px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginRight: '12px' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"></line>
                                    <polyline points="12 19 5 12 12 5"></polyline>
                                </svg>
                            </button>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#fff' }}>Витрина</h3>
                        </div>
                    )}

                    <header className="showcase-hero-header">
                        <span className="showcase-hero-eyebrow">MAXCORD · Экосистема</span>
                        <h1 className="showcase-hero-title">
                            {activeTab === 'bots' ? <>Наши <span className="showcase-hero-title__accent">умные боты</span></>
                                : activeTab === 'miniapps' ? <>Лучшие <span className="showcase-hero-title__accent">мини-приложения</span></>
                                : <>Витрина <span className="showcase-hero-title__accent">интеграций</span></>}
                        </h1>
                        <p className="showcase-hero-sub">
                            {activeTab === 'bots' ? 'Автоматизируйте свои серверы с помощью мощных инструментов.'
                                : activeTab === 'miniapps' ? 'Игры, утилиты и развлечения прямо внутри вашего окна чата.'
                                : 'Исследуйте мир МАКСимальных возможностей MAXCORD. Добавляйте ботов или запускайте приложения в один клик.'}
                        </p>
                    </header>

                    <div className="showcase-tabs">
                        <button className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}>Все</button>
                        <button className={activeTab === 'bots' ? 'active' : ''} onClick={() => setActiveTab('bots')}>Боты</button>
                        <button className={activeTab === 'miniapps' ? 'active' : ''} onClick={() => setActiveTab('miniapps')}>Приложения</button>
                        
                        <div className="showcase-search-wrapper">
                            <input
                                type="text"
                                placeholder="Поиск интеграций..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="showcase-search-input"
                            />
                        </div>
                    </div>

                    <div className="showcase-list custom-scrollbar">
                        {loading ? (
                            <div className="showcase-loading" style={{ height: '200px', border: 'none', background: 'transparent' }}>
                                <span>Загрузка витрины...</span>
                            </div>
                        ) : (
                            <>
                                {(activeTab === 'all' || activeTab === 'bots') && filteredBots.map(renderBotCard)}
                                {(activeTab === 'all' || activeTab === 'miniapps') && filteredApps.map(renderAppCard)}
                                {filteredBots.length === 0 && filteredApps.length === 0 && (
                                    <div className="showcase-empty" style={{ height: '200px', border: 'none', background: 'transparent' }}>
                                        <LayoutGridIcon size={48} color="var(--text-dim)" />
                                        <p>Ничего не найдено</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
                {!isMobile && (
                    <ActiveContacts 
                        friends={currentUser ? [...friends, currentUser] : friends} 
                        onUserClick={onUserClick} 
                    />
                )}
            </div>
        </div>
    );
};

export default ShowcaseView;
