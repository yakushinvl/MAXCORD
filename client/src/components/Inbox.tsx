import React from 'react';
import { useInbox, InboxItem } from '../contexts/InboxContext';
import { TrashIcon, CheckIcon, MailIcon } from './Icons';
import UserAvatar from './UserAvatar';
import UserBadges from './UserBadges';
import './Inbox.css';

interface InboxProps {
    onClose: () => void;
    onItemClick: (item: InboxItem) => void;
}

const Inbox: React.FC<InboxProps> = ({ onClose, onItemClick }) => {
    const { items, markAsRead, markAllAsRead, removeItem, clearInbox } = useInbox();
    const [activeTab, setActiveTab] = React.useState<'all' | 'mentions'>('all');
    const isMobile = window.innerWidth <= 768;

    const filteredItems = items.filter(item => {
        if (activeTab === 'mentions') return item.type === 'mention';
        return true;
    });

    const formatDate = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        if (days < 7) return date.toLocaleDateString('ru-RU', { weekday: 'short' });
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    };

    return (
        <div className={`inbox-overlay ${isMobile ? 'is-mobile' : ''}`}>
            <div className="inbox-header">
                {isMobile && (
                    <button className="back-button" onClick={onClose} style={{ marginRight: '12px' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                )}
                <h3>Входящие</h3>
                <div className="inbox-actions">
                    <button className="inbox-action-btn" onClick={markAllAsRead}>Прочитать все</button>
                    {!isMobile && <button className="inbox-action-btn" onClick={clearInbox}>Очистить</button>}
                </div>
            </div>

            <div className="inbox-tabs">
                <div className={`inbox-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>Все</div>
                <div className={`inbox-tab ${activeTab === 'mentions' ? 'active' : ''}`} onClick={() => setActiveTab('mentions')}>Упоминания</div>
            </div>

            <div className="inbox-list">
                {filteredItems.length === 0 ? (
                    <div className="inbox-empty">
                        <div className="inbox-empty-icon">📫</div>
                        <p>{activeTab === 'mentions' ? 'У вас нет новых упоминаний' : 'У вас нет новых уведомлений'}</p>
                    </div>
                ) : (
                    filteredItems.map(item => (
                        <div
                            key={item.id}
                            className={`inbox-item ${item.type} ${!item.read ? 'unread' : ''}`}
                            onClick={() => {
                                onItemClick(item);
                                markAsRead(item.id);
                            }}
                        >
                            <div className="inbox-item-avatar">
                                <UserAvatar user={item.author} size={48} />
                            </div>
                            <div className="inbox-item-body">
                                <div className="inbox-item-title">{item.title}</div>
                                <div className="inbox-item-content">{item.content}</div>
                                <div className="inbox-item-meta">
                                    <span>{item.author?.username}</span>
                                    {item.author && <UserBadges badges={item.author.badges} size={12} />}
                                    <span>{formatDate(item.timestamp)}</span>
                                </div>
                            </div>
                            <div className="inbox-item-actions">
                                {!item.read && (
                                    <button
                                        className="inbox-item-btn"
                                        title="Отметить как прочитанное"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            markAsRead(item.id);
                                        }}
                                    >
                                        <CheckIcon size={14} />
                                    </button>
                                )}
                                <button
                                    className="inbox-item-btn"
                                    title="Удалить"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeItem(item.id);
                                    }}
                                >
                                    <TrashIcon size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Inbox;
