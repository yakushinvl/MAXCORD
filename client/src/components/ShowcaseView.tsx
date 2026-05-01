import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getFullUrl } from '../utils/avatar';
import { BotIcon, LayoutGridIcon, PlusIcon, SearchIcon, MonitorIcon } from './Icons';
import { useDialog } from '../contexts/DialogContext';
import './ShowcaseView.css';

interface ShowcaseViewProps {
    onOpenMiniApp: (app: any) => void;
    onBack?: () => void;
    isMobile?: boolean;
}

const ShowcaseView: React.FC<ShowcaseViewProps> = ({ onOpenMiniApp, onBack, isMobile }) => {
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

    const filteredBots = showcaseData.bots.filter(b => b.username.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredApps = showcaseData.miniApps.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const renderBotCard = (bot: any) => (
        <div key={bot._id} className="showcase-card">
            <div className="card-banner" style={{ background: bot.banner ? `url(${getFullUrl(bot.banner)}) center/cover` : 'var(--primary-neon)' }} />
            <div className="card-content">
                <div className="card-header">
                    <div className="card-avatar">
                        {bot.avatar ? <img src={getFullUrl(bot.avatar)!} alt="" /> : <BotIcon size={32} color="black" />}
                    </div>
                    <div className="card-info">
                        <div className="card-name">{bot.username}</div>
                        <div className="card-type">Бот</div>
                    </div>
                </div>
                <div className="card-description">{bot.bio || 'У этого бота пока нет описания.'}</div>
                <div className="card-actions">
                    <button className="card-button primary" onClick={() => setShowServerSelect(showServerSelect === bot._id ? null : bot._id)}>
                        <PlusIcon size={16} /> Добавить на сервер
                    </button>
                </div>
                {showServerSelect === bot._id && (
                    <div className="card-server-selector">
                        {userServers.map(server => (
                            <div key={server._id} className="server-option" onClick={() => addBotToServer(bot._id, server._id)}>
                                {server.name}
                            </div>
                        ))}
                        {userServers.length === 0 && <div className="no-servers">Нет доступных серверов</div>}
                    </div>
                )}
            </div>
        </div>
    );

    const renderAppCard = (app: any) => (
        <div key={app._id} className="showcase-card">
            <div className="card-banner" style={{ background: app.banner ? `url(${getFullUrl(app.banner)}) center/cover` : 'var(--secondary-neon)', opacity: app.banner ? 1 : 0.6 }} />
            <div className="card-content">
                <div className="card-header">
                    <div className="card-avatar">
                        {app.avatar ? <img src={getFullUrl(app.avatar)!} alt="" /> : <LayoutGridIcon size={32} color="black" />}
                    </div>
                    <div className="card-info">
                        <div className="card-name">{app.name}</div>
                        <div className="card-type">Мини-приложение</div>
                    </div>
                </div>
                <div className="card-description">{app.description || 'У этого приложения пока нет описания.'}</div>
                <div className="card-actions">
                    <button className="card-button secondary" onClick={() => onOpenMiniApp(app)}>
                        <MonitorIcon size={16} /> Открыть
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="showcase-panel">
            <div className="showcase-header">
                <div className="header-left">
                    {isMobile && onBack && (
                        <button className="back-button" onClick={onBack}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        </button>
                    )}
                    <h3>Витрина</h3>
                    <div className="header-tabs">
                        <button className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}>Все</button>
                        <button className={activeTab === 'bots' ? 'active' : ''} onClick={() => setActiveTab('bots')}>Боты</button>
                        <button className={activeTab === 'miniapps' ? 'active' : ''} onClick={() => setActiveTab('miniapps')}>Мини-приложения</button>
                    </div>
                </div>
                <div className="header-search">
                    <div className="search-input-wrapper">
                        <SearchIcon size={18} />
                        <input
                            type="text"
                            placeholder="Поиск..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="showcase-content">
                {loading ? (
                    <div className="showcase-loading">
                        <div className="loading-spinner-rings"><div></div><div></div><div></div><div></div></div>
                        <span>Загрузка витрины...</span>
                    </div>
                ) : (
                    <div className="showcase-grid">
                        {(activeTab === 'all' || activeTab === 'bots') && filteredBots.map(renderBotCard)}
                        {(activeTab === 'all' || activeTab === 'miniapps') && filteredApps.map(renderAppCard)}
                        {filteredBots.length === 0 && filteredApps.length === 0 && (
                            <div className="showcase-empty">
                                <LayoutGridIcon size={64} color="var(--text-dim)" />
                                <p>Ничего не найдено</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShowcaseView;
