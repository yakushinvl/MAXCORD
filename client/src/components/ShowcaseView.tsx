import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getFullUrl } from '../utils/avatar';
import { BotIcon, LayoutGridIcon, PlusIcon, SearchIcon, MonitorIcon } from './Icons';
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
    const { alert } = useDialog();

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
        // Update user activity status via socket
        if (socket) {
            socket.emit('activity-update', {
                name: app.name,
                type: 'playing',
                state: 'В приложении',
                details: app.description ? app.description.slice(0, 100) : '',
                assets: {
                    largeImage: app.avatar || null,
                    largeText: app.name
                },
                timestamps: {
                    start: Date.now()
                }
            });
        }
        onOpenMiniApp(app);
    };

    const filteredBots = showcaseData.bots.filter(b => b.username.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredApps = showcaseData.miniApps.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const renderBotCard = (bot: any) => (
        <div key={bot._id} className="showcase-profile-card">
            <div className="profile-card-banner" style={{ background: bot.banner ? `url(${getFullUrl(bot.banner)}) center/cover` : 'var(--primary-neon)' }}>
                <div className="profile-card-badge bot">Бот</div>
            </div>
            <div className="profile-card-content">
                <div className="profile-card-header">
                    <div className="profile-card-avatar-wrap">
                        <div className="profile-card-avatar">
                            {bot.avatar ? <img src={getFullUrl(bot.avatar)!} alt="" /> : <BotIcon size={32} color="black" />}
                        </div>
                    </div>
                    <div className="profile-card-main-info">
                        <h4 className="profile-card-name">{bot.username}</h4>
                        <p className="profile-card-bio">{bot.bio || 'У этого бота пока нет описания.'}</p>
                    </div>
                    <div className="profile-card-actions">
                        <div className="action-button-container">
                            <button className="profile-action-btn primary" onClick={() => setShowServerSelect(showServerSelect === bot._id ? null : bot._id)}>
                                <PlusIcon size={18} />
                                <span>Добавить</span>
                            </button>
                            {showServerSelect === bot._id && (
                                <div className="card-server-selector">
                                    {userServers.map(server => (
                                        <div key={server._id} className="server-option" onClick={() => addBotToServer(bot._id, server._id)}>
                                            {server.name}
                                        </div>
                                    ))}
                                    {userServers.length === 0 && <div className="no-servers">Нет серверов</div>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderAppCard = (app: any) => (
        <div key={app._id} className="showcase-profile-card">
            <div className="profile-card-banner" style={{ background: app.banner ? `url(${getFullUrl(app.banner)}) center/cover` : 'var(--secondary-neon)' }}>
                <div className="profile-card-badge app">Приложение</div>
            </div>
            <div className="profile-card-content">
                <div className="profile-card-header">
                    <div className="profile-card-avatar-wrap">
                        <div className="profile-card-avatar app">
                            {app.avatar ? <img src={getFullUrl(app.avatar)!} alt="" /> : <LayoutGridIcon size={32} color="black" />}
                        </div>
                    </div>
                    <div className="profile-card-main-info">
                        <h4 className="profile-card-name">{app.name}</h4>
                        <p className="profile-card-bio">{app.description || 'У этого приложения пока нет описания.'}</p>
                    </div>
                    <div className="profile-card-actions">
                        <button className="profile-action-btn secondary" onClick={() => handleOpenApp(app)}>
                            <MonitorIcon size={18} />
                            <span>Открыть приложение</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="showcase-panel">
            <div className="showcase-main-container">
                <div className="showcase-left-section">
                    <div className="showcase-tabs">
                        {isMobile && onBack && (
                            <button className="back-button" onClick={onBack} title="Назад">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"></line>
                                    <polyline points="12 19 5 12 12 5"></polyline>
                                </svg>
                            </button>
                        )}
                        {!isMobile && <h3 className="showcase-title">Витрина</h3>}
                        <button className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}>Все</button>
                        <button className={activeTab === 'bots' ? 'active' : ''} onClick={() => setActiveTab('bots')}>Боты</button>
                        <button className={activeTab === 'miniapps' ? 'active' : ''} onClick={() => setActiveTab('miniapps')}>Приложения</button>
                        
                        <div className="showcase-search-wrapper">
                            <input
                                type="text"
                                placeholder="Поиск в витрине..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="showcase-search-input"
                            />
                        </div>
                    </div>

                    <div className="showcase-list custom-scrollbar">
                        {loading ? (
                            <div className="showcase-loading">
                                <div className="loading-spinner-rings"><div></div><div></div><div></div><div></div></div>
                                <span>Загрузка витрины...</span>
                            </div>
                        ) : (
                            <>
                                {(activeTab === 'all' || activeTab === 'bots') && filteredBots.map(renderBotCard)}
                                {(activeTab === 'all' || activeTab === 'miniapps') && filteredApps.map(renderAppCard)}
                                {filteredBots.length === 0 && filteredApps.length === 0 && (
                                    <div className="showcase-empty">
                                        <LayoutGridIcon size={64} color="var(--text-dim)" />
                                        <p>В этом разделе пока ничего нет</p>
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
