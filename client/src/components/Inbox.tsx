import React from 'react';
import { useInbox, InboxItem } from '../contexts/InboxContext';
import { TrashIcon, CheckIcon, MailIcon, CloseIcon } from './Icons';
import UserAvatar from './UserAvatar';
import './Inbox.css';

interface InboxProps {
    onClose: () => void;
    onItemClick: (item: InboxItem) => void;
}

const Inbox: React.FC<InboxProps> = ({ onClose, onItemClick }) => {
    const { items, markAsRead, markAllAsRead, removeItem, clearInbox } = useInbox();

    const formatDate = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        if (days < 7) return date.toLocaleDateString('ru-RU', { weekday: 'short' });
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    };

    return (
        <div className="inbox-overlay">
            <div className="inbox-header">
                <button className="inbox-mobile-close" onClick={onClose}>
                    <CloseIcon size={20} />
                </button>
                <h3>Входящие</h3>
                <div className="inbox-actions">
                    <button className="inbox-action-btn" onClick={markAllAsRead}>Прочитать все</button>
                    <button className="inbox-action-btn" onClick={clearInbox}>Очистить</button>
                </div>
            </div>
            <div className="inbox-list">
                {items.length === 0 ? (
                    <div className="inbox-empty">
                        <div className="inbox-empty-icon">📫</div>
                        <p>У вас нет новых уведомлений</p>
                    </div>
                ) : (
                    items.map(item => (
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
