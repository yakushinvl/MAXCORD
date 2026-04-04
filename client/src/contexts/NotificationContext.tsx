import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { getAvatarUrl } from '../utils/avatar';
import './Notification.css';

interface Notification {
    id: string;
    title: string;
    content: string;
    type: 'info' | 'success' | 'warning' | 'error' | 'message';
    avatar?: string;
    onClick?: () => void;
}

interface NotificationContextType {
    addNotification: (notification: Omit<Notification, 'id'>) => void;
    removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationProvider');
    }
    return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newNotification = { ...notification, id };

        setNotifications(prev => [...prev, newNotification]);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            removeNotification(id);
        }, 5000);
    }, [removeNotification]);

    const value = useMemo(() => ({ addNotification, removeNotification }), [addNotification, removeNotification]);

    return (
        <NotificationContext.Provider value={value}>
            {children}
            <div className="notification-container">
                {notifications.map(n => (
                    <div
                        key={n.id}
                        className={`notification-toast ${n.type}`}
                        onClick={() => {
                            if (n.onClick) n.onClick();
                            removeNotification(n.id);
                        }}
                    >
                        {n.type === 'message' && (
                            <div className="notification-avatar-container">
                                {n.avatar ? (
                                    <img src={getAvatarUrl(n.avatar)!} alt="" className="notification-avatar" />
                                ) : (
                                    <div className="notification-avatar-placeholder">
                                        {n.title.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="notification-body">
                            <div className="notification-title">{n.title}</div>
                            <div className="notification-content">{n.content}</div>
                        </div>
                        <button className="notification-close" onClick={(e) => {
                            e.stopPropagation();
                            removeNotification(n.id);
                        }}>×</button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
};
