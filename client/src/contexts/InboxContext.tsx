import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { Message, User } from '../types';
import { SOUNDS, soundManager } from '../utils/sounds';
import { getAvatarUrl } from '../utils/avatar';

export interface InboxItem {
    id: string;
    type: 'mention' | 'dm' | 'friend_request';
    title: string;
    content: string;
    timestamp: Date;
    author?: {
        _id: string;
        username: string;
        avatar: string | null;
        badges?: string[];
    };
    link?: {
        serverId?: string;
        channelId?: string;
        dmId?: string;
    };
    data?: any;
    read: boolean;
}

interface InboxContextType {
    items: InboxItem[];
    unreadCount: number;
    addItem: (item: Omit<InboxItem, 'id' | 'timestamp' | 'read'>) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    removeItem: (id: string) => void;
    clearInbox: () => void;
}

const InboxContext = createContext<InboxContextType | undefined>(undefined);

export const useInbox = () => {
    const context = useContext(InboxContext);
    if (!context) throw new Error('useInbox must be used within InboxProvider');
    return context;
};

export const InboxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { socket } = useSocket();
    const { user } = useAuth();
    const { addNotification } = useNotifications();
    const [items, setItems] = useState<InboxItem[]>(() => {
        const saved = localStorage.getItem('maxcord_inbox');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.map((item: any) => ({ ...item, timestamp: new Date(item.timestamp) }));
            } catch (e) { return []; }
        }
        return [];
    });

    useEffect(() => {
        localStorage.setItem('maxcord_inbox', JSON.stringify(items));
    }, [items]);

    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    const sendNativeNotification = useCallback((title: string, body: string, iconUrl?: string | null) => {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        // Don't show if window is focused (optional, but requested "all in windows")
        // if (document.hasFocus()) return;

        const notification = new Notification(title, {
            body,
            icon: iconUrl ? iconUrl : undefined,
            silent: true // We use our own sound manager
        });

        notification.onclick = () => {
            window.focus();
            // Optional: navigate to the item
        };
    }, []);

    const addItem = useCallback((item: Omit<InboxItem, 'id' | 'timestamp' | 'read'>) => {
        const newItem: InboxItem = {
            ...item,
            id: Math.random().toString(36).substring(2, 11),
            timestamp: new Date(),
            read: false
        };
        setItems(prev => [newItem, ...prev].slice(0, 50)); // Keep last 50 items
        soundManager.play(SOUNDS.MESSAGE_NOTIFY, 0.4);

        addNotification({
            title: item.title,
            content: item.content,
            type: item.type === 'mention' ? 'message' : 'info',
            avatar: item.author?.avatar || undefined,
            onClick: () => {
                // Clicking toast could open inbox or directly the item
            }
        });

        sendNativeNotification(
            item.title,
            item.content,
            item.author?.avatar ? getAvatarUrl(item.author.avatar) : null
        );
    }, [addNotification, sendNativeNotification]);

    const markAsRead = useCallback((id: string) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, read: true } : item));
    }, []);

    const markAllAsRead = useCallback(() => {
        setItems(prev => prev.map(item => ({ ...item, read: true })));
    }, []);

    const removeItem = useCallback((id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    }, []);

    const clearInbox = useCallback(() => {
        setItems([]);
    }, []);

    const unreadCount = useMemo(() => items.filter(i => !i.read).length, [items]);

    useEffect(() => {
        if (!socket || !user) return;

        const handleMention = (message: Message) => {
            addItem({
                type: 'mention',
                title: `@${user.username} упомянут в #${(message.channel as any)?.name || 'канале'}`,
                content: message.content,
                author: {
                    _id: message.author._id,
                    username: message.author.username,
                    avatar: message.author.avatar || null,
                    badges: message.author.badges || []
                },
                link: {
                    serverId: (message.channel as any)?.server,
                    channelId: message.channel as string
                },
                data: message
            });
        };

        const handleFriendRequest = (friendship: any) => {
            const requester = friendship.requester;
            addItem({
                type: 'friend_request',
                title: 'Новый запрос в друзья',
                content: `${requester.username} хочет добавить вас в друзья`,
                author: {
                    _id: requester._id,
                    username: requester.username,
                    avatar: requester.avatar || null,
                    badges: requester.badges || []
                },
                data: friendship
            });
        };

        const handleFriendRequestAccepted = (friendship: any) => {
            const other = friendship.recipient._id === user._id ? friendship.requester : friendship.recipient;
            addItem({
                type: 'friend_request',
                title: 'Запрос в друзья принят',
                content: `${other.username} принял ваш запрос в друзья`,
                author: {
                    _id: other._id,
                    username: other.username,
                    avatar: other.avatar || null,
                    badges: (other as any).badges || []
                },
                data: friendship
            });
        };

        socket.on('mention', handleMention);
        socket.on('friend-request', handleFriendRequest);
        socket.on('friend-request-accepted', handleFriendRequestAccepted);

        return () => {
            socket.off('mention', handleMention);
            socket.off('friend-request', handleFriendRequest);
            socket.off('friend-request-accepted', handleFriendRequestAccepted);
        };
    }, [socket, user, addItem]);

    const value = useMemo(() => ({
        items,
        unreadCount,
        addItem,
        markAsRead,
        markAllAsRead,
        removeItem,
        clearInbox
    }), [items, unreadCount, addItem, markAsRead, markAllAsRead, removeItem, clearInbox]);

    return (
        <InboxContext.Provider value={value}>
            {children}
        </InboxContext.Provider>
    );
};
